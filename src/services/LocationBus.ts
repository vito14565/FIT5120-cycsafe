// src/services/LocationBus.ts
// Singleton: refresh location every 5s, reverse-geocode via your Lambda, fan-out to subscribers.

type PermissionState = "granted" | "denied" | "prompt" | undefined;

export type Coords = { lat: number; lon: number; accuracy?: number };
export type LocationSnapshot = {
  coords: Coords | null;
  address: string | null;     // formatted human address only (never "lat, lon")
  geocoding: boolean;
  lastUpdated: number;
  permission: PermissionState;
};

// Must be provided by Vite env (no fallback)
const API = import.meta.env.VITE_LAMBDA_URL as string | undefined;

// Storage keys
const ADDRESS_KEY = "cs.address";
const COORDS_KEY  = "cs.coords";

// Geocode throttling (≈110 m)
const LAST_GEOCODE_CELL_KEY = "cs.loc.lastGeocodeCell";
const CELL_PRECISION = 3; // 0.001°

const REFRESH_MS = 5000;
const GEO_TIMEOUT_MS = 8000;

function roundCell(lat: number, lon: number, p = CELL_PRECISION) {
  const f = 10 ** p;
  const latc = Math.floor(lat * f) / f;
  const lonc = Math.floor(lon * f) / f;
  return `${latc.toFixed(p)}_${lonc.toFixed(p)}`;
}

function looksLikeCoords(val: string | null | undefined): boolean {
  if (!val) return false;
  // " -37.81360, 144.96310 " style
  return /^\s*-?\d{1,3}\.\d{3,},\s*-?\d{1,3}\.\d{3,}\s*$/.test(val);
}

function readSaved(): LocationSnapshot {
  let coords: Coords | null = null;
  let address: string | null = null;
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (raw) {
      const { lat, lon } = JSON.parse(raw);
      if (Number.isFinite(lat) && Number.isFinite(lon)) coords = { lat, lon };
    }
  } catch {}

  try {
    const saved = localStorage.getItem(ADDRESS_KEY) || null;
    // Ignore coordinate-like strings; only keep real addresses
    address = looksLikeCoords(saved) ? null : saved;
  } catch {}

  return { coords, address, geocoding: false, lastUpdated: 0, permission: undefined };
}

async function queryPermission(): Promise<PermissionState> {
  try {
    const res: any = await (navigator as any)?.permissions?.query?.({
      name: "geolocation" as PermissionName,
    });
    return (res?.state as PermissionState) ?? undefined;
  } catch {
    return undefined;
  }
}

async function reverseGeocode(lat: number, lon: number, signal?: AbortSignal): Promise<string | null> {
  if (!API) {
    // No env configured -> cannot geocode (and we do not fall back)
    return null;
  }
  try {
    const url = new URL(API);
    url.searchParams.set("mode", "geocode");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    const res = await fetch(url.toString(), { cache: "no-store", signal });
    const data = await res.json().catch(() => ({}));
    const addr = (data?.address as string | undefined) || null;
    return addr && !looksLikeCoords(addr) ? addr : null;
  } catch {
    return null;
  }
}

// -------- Singleton state --------
let snap: LocationSnapshot = readSaved();
const subs = new Set<(s: LocationSnapshot) => void>();
let timerId: number | null = null;
let inFlightGeocode: AbortController | null = null;

function broadcast() {
  try {
    if (snap.coords) localStorage.setItem(COORDS_KEY, JSON.stringify(snap.coords));
    // only persist human addresses (never coords)
    if (snap.address && !looksLikeCoords(snap.address)) localStorage.setItem(ADDRESS_KEY, snap.address);
  } catch {}
  try { window.dispatchEvent(new CustomEvent("cs:loc:update", { detail: snap })); } catch {}
  subs.forEach(fn => fn(snap));
}

async function maybeGeocode(lat: number, lon: number) {
  // throttle by cell — BUT if we don't yet have an address, force geocode even in same cell
  const cell = roundCell(lat, lon, CELL_PRECISION);
  const last = (() => {
    try { return sessionStorage.getItem(LAST_GEOCODE_CELL_KEY) || ""; } catch { return ""; }
  })();
  if (cell === last && snap.address) return;

  if (inFlightGeocode) { try { inFlightGeocode.abort(); } catch {} inFlightGeocode = null; }

  inFlightGeocode = new AbortController();
  snap = { ...snap, geocoding: true };
  broadcast();

  const addr = await reverseGeocode(lat, lon, inFlightGeocode.signal);
  snap = { ...snap, geocoding: false, address: addr ?? snap.address ?? null };

  if (addr) {
    try { sessionStorage.setItem(LAST_GEOCODE_CELL_KEY, cell); } catch {}
  }
  broadcast();
}

function onPosition(pos: GeolocationPosition) {
  const { latitude, longitude, accuracy } = pos.coords;
  const coords: Coords = { lat: latitude, lon: longitude, accuracy };
  snap = { ...snap, coords, lastUpdated: Date.now() };
  broadcast();
  maybeGeocode(coords.lat, coords.lon);
}

function onError(_err: GeolocationPositionError) {
  broadcast();
}

async function tick() {
  if (!("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    onPosition,
    onError,
    { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 4000 }
  );
  snap = { ...snap, permission: await queryPermission() };
  broadcast();
}

// -------- Public API --------
function start() {
  if (timerId != null) return;
  (async () => {
    snap = { ...snap, permission: await queryPermission() };
    broadcast();
  })();
  tick();
  timerId = window.setInterval(tick, REFRESH_MS) as unknown as number;
}

function stop() {
  if (timerId != null) { clearInterval(timerId); timerId = null; }
  if (inFlightGeocode) { try { inFlightGeocode.abort(); } catch {} inFlightGeocode = null; }
}

function subscribe(fn: (s: LocationSnapshot) => void): () => void {
  subs.add(fn);
  try { fn(snap); } catch {}
  return () => { subs.delete(fn); };
}

function getSnapshot(): LocationSnapshot { return snap; }
function getCoords(): Coords | null { return snap.coords; }
function getAddress(): string | null { return snap.address; }

function waitForFirstFix(timeoutMs = 10000): Promise<Coords | null> {
  if (snap.coords) return Promise.resolve(snap.coords);
  return new Promise((resolve) => {
    const t = window.setTimeout(() => { off(); resolve(getCoords()); }, timeoutMs);
    const off = subscribe((s) => {
      if (s.coords) { clearTimeout(t); off(); resolve(s.coords); }
    });
  });
}

export const LocationBus = {
  start,
  stop,
  subscribe,
  getSnapshot,
  getCoords,
  getAddress,
  waitForFirstFix,
};

export default LocationBus;