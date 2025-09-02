// src/services/vicEmergency.ts
import type { Priority, Category } from "../components/AlertItem";

/** Incident model returned to pages */
export type AlertModel = {
  id: string;
  title: string;
  description: string;
  location: string;
  timestamp: number; // ms
  priority: Priority;
  category: Category;
  /** Distance from user in km (used for UI hinting / grouping) */
  distanceKm?: number;
};

/* ---------------- config ---------------- */
const API = import.meta.env.VITE_LAMBDA_URL as string | undefined;

const DIRECT_EVENTS  = "https://emergency.vic.gov.au/public/events-geojson.json";
const DIRECT_IMPACTS = "https://emergency.vic.gov.au/public/impact-areas-geojson.json";

// Primary & extended radii (km → meters)
const RADIUS_KM      = Number(import.meta.env.VITE_VIC_RADIUS_KM ?? 5);
const EXT_RADIUS_KM  = Number(import.meta.env.VITE_VIC_EXT_RADIUS_KM ?? 30);
const R1_METERS      = Math.max(0, RADIUS_KM) * 1000;
const R2_METERS_RAW  = Math.max(0, EXT_RADIUS_KM) * 1000;
const R2_METERS      = Math.max(R2_METERS_RAW, R1_METERS); // ensure ext >= primary

// Cache the RAW feeds (not location-filtered)
const FEED_TTL_MS = 120_000; // 2 minutes

type FeedCache = {
  at: number;
  events: any | null;
  impacts: any | null;
};
let _feedCache: FeedCache | null = null;

/* ---------------- geometry ---------------- */
const toRad = (v: number) => (v * Math.PI) / 180;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6_371_000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Return [lat, lon] or null — supports GeometryCollection
function centroid(geom: any): [number, number] | null {
  if (!geom) return null;
  const t = geom.type;

  if (t === "GeometryCollection" && Array.isArray(geom.geometries)) {
    const pts: [number, number][] = [];
    for (const g of geom.geometries) {
      const c = centroid(g);
      if (c) pts.push(c);
    }
    if (pts.length) {
      let sx = 0, sy = 0;
      for (const [lat, lon] of pts) { sx += lat; sy += lon; }
      return [sx / pts.length, sy / pts.length];
    }
    return null;
  }

  if (t === "Point" && Array.isArray(geom.coordinates)) {
    const [lon, lat] = geom.coordinates;
    return [lat, lon];
  }

  if (t === "MultiPoint" && Array.isArray(geom.coordinates) && geom.coordinates.length) {
    let sx = 0, sy = 0, n = 0;
    for (const p of geom.coordinates) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const [lon, lat] = p;
      sx += lat; sy += lon; n++;
    }
    if (n) return [sx / n, sy / n];
  }

  if (t === "LineString" && Array.isArray(geom.coordinates) && geom.coordinates.length) {
    let sx = 0, sy = 0, n = 0;
    for (const p of geom.coordinates) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const [lon, lat] = p;
      sx += lat; sy += lon; n++;
    }
    if (n) return [sx / n, sy / n];
  }

  if (t === "MultiLineString" && Array.isArray(geom.coordinates) && geom.coordinates.length) {
    let sx = 0, sy = 0, n = 0;
    for (const line of geom.coordinates) {
      for (const p of line || []) {
        if (!Array.isArray(p) || p.length < 2) continue;
        const [lon, lat] = p;
        sx += lat; sy += lon; n++;
      }
    }
    if (n) return [sx / n, sy / n];
  }

  // polygon-ish: take first ring
  const ring =
    t === "Polygon" ? geom.coordinates?.[0] :
    t === "MultiPolygon" ? geom.coordinates?.[0]?.[0] : null;

  if (Array.isArray(ring) && ring.length) {
    let sx = 0, sy = 0, n = 0;
    for (const pair of ring) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const [lon, lat] = pair;
      sx += lat; sy += lon; n++;
    }
    if (n) return [sx / n, sy / n];
  }

  return null;
}

/* ---------------- mapping helpers ---------------- */
function priorityFromVic(props: Record<string, any>): Priority {
  const level = String(props.status || props.category1 || props.name || props.sourceTitle || "").toLowerCase();
  const severity = String(props.cap?.severity || "").toLowerCase();
  const urgency  = String(props.cap?.urgency  || "").toLowerCase();

  if (level.includes("watch and act") || level.includes("emergency") || level.includes("evacuate")) return "CRITICAL";
  if (level.includes("warning") || severity === "severe" || urgency === "immediate") return "HIGH";
  if (level.includes("advice") || level.includes("community information") || severity === "moderate") return "MEDIUM";
  if (level.includes("responding") || level.includes("request for assistance")) return "HIGH";
  if (level.includes("under control") || level.includes("safe")) return "LOW";
  return "MEDIUM";
}

function categoryFromVic(props: Record<string, any>): Category {
  const c1 = String(props.category1 || "").toLowerCase();
  const c2 = String(props.category2 || "").toLowerCase();
  const feedType = String(props.feedType || "").toLowerCase();

  if (c1.includes("met") || c2.includes("wind") || c2.includes("weather")) return "WEATHER";
  if (c1.includes("fire") || c2.includes("fire")) return "SAFETY";
  if (c1.includes("tree") || c2.includes("tree") || c1.includes("other")) return "INFRA";
  if (c1.includes("security") || c1.includes("rescue") || c2.includes("security") || c2.includes("rescue")) return "SAFETY";
  if (c1.includes("burn") || feedType.includes("burn")) return "SAFETY";
  return "SAFETY";
}

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanDescription(props: Record<string, any>): string {
  if (props.text) return String(props.text);
  if (props.webBody) return stripHtml(String(props.webBody));
  const loc = props.location || "the area";
  return `Emergency incident at ${loc}. Stay informed and follow official guidance.`;
}

function pickLocation(props: Record<string, any>, lat?: number, lon?: number) {
  if (props.location) return String(props.location).replace(/^VIC\s*[-,]?\s*/i, "").trim();
  if (lat != null && lon != null) return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  return "Victoria";
}

function extractTitle(props: Record<string, any>): string {
  if (props.webHeadline) return String(props.webHeadline);
  if (props.sourceTitle && props.action) return `${props.sourceTitle} - ${props.action}`;
  if (props.name && props.category2) return `${props.category2} ${props.name}`;
  if (props.category1 && props.category2) return `${props.category1} - ${props.category2}`;
  return props.category1 || props.category2 || props.sourceTitle || props.name || "Emergency Incident";
}

function parseWhen(props: Record<string, any>): number {
  const candidates = [props.updated, props.created, props.timestamp, props.time, props.end];
  for (const t of candidates) {
    if (!t) continue;
    const v = Date.parse(String(t));
    if (Number.isFinite(v)) return v;
  }
  return Date.now();
}

/* ---------------- fetching ---------------- */
async function getVicFeed(feed: "events" | "impact", signal?: AbortSignal): Promise<any> {
  const now = Date.now();

  // Serve cached raw feed (not location-filtered)
  if (_feedCache && now - _feedCache.at < FEED_TTL_MS) {
    if (feed === "events" && _feedCache.events) return _feedCache.events;
    if (feed === "impact" && _feedCache.impacts) return _feedCache.impacts;
  }

  const url = API
    ? `${API}?mode=vic&feed=${feed}`
    : (feed === "events" ? DIRECT_EVENTS : DIRECT_IMPACTS);

  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`VIC ${feed} fetch failed: HTTP ${res.status}`);

  const data = await res.json();

  // Lambda returns raw FeatureCollection; if some error wrapper slips through:
  if (data && data.ok === false) {
    throw new Error(`VIC ${feed} upstream error: ${data.error || "unknown"}`);
  }

  _feedCache = _feedCache ?? { at: now, events: null, impacts: null };
  _feedCache.at = now;
  if (feed === "events") _feedCache.events = data;
  else _feedCache.impacts = data;

  return data;
}

/* ---------------- compose (near + extended) ---------------- */
type ExtendedResult = {
  /** within primary radius (e.g. 5 km) */
  nearby: AlertModel[];
  /** 5–30 km, grouped by category */
  within30ByCategory: Record<Category, AlertModel[]>;
};

function sortAlerts(a: AlertModel[], weight: Record<Priority, number>) {
  a.sort((x, y) => {
    const w = weight[y.priority] - weight[x.priority];
    return w !== 0 ? w : y.timestamp - x.timestamp;
  });
}

export async function fetchVicIncidents(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<ExtendedResult> {
  const [events, impacts] = await Promise.all([
    getVicFeed("events", signal).catch(() => null),
    getVicFeed("impact", signal).catch(() => null),
  ]);

  const nearby: AlertModel[] = [];
  const within30: Record<Category, AlertModel[]> = {
    WEATHER: [],
    TRAFFIC: [],
    INFRA:   [],
    SAFETY:  [],
  };

  const seen = new Set<string>();
  const eat = (collection: any) => {
    const feats: any[] = collection?.features || [];
    for (const f of feats) {
      const p = f?.properties ?? {};
      const c = centroid(f?.geometry);
      if (!c) continue; // cannot distance-filter reliably

      const [aLat, aLon] = c;
      const dM = haversineMeters(lat, lon, aLat, aLon);
      if (dM > R2_METERS) continue; // beyond extended window

      const title       = extractTitle(p);
      const description = cleanDescription(p);
      const priority    = priorityFromVic(p);
      const category    = categoryFromVic(p);
      const location    = pickLocation(p, aLat, aLon);
      const when        = parseWhen(p);

      const rawId = String(p.id || p.sourceId || p.eventId || `${title}-${when}`);
      const id = rawId.replace(/[^a-zA-Z0-9-_]/g, "");
      if (seen.has(id)) continue;
      seen.add(id);

      const model: AlertModel = {
        id,
        title: String(title),
        description: String(description),
        location,
        timestamp: when,
        priority,
        category,
        distanceKm: Math.round((dM / 1000) * 10) / 10, // 0.1 km precision
      };

      if (dM <= R1_METERS) nearby.push(model);
      else within30[category].push(model);
    }
  };

  if (events)  eat(events);
  if (impacts) eat(impacts);

  const weight: Record<Priority, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };
  sortAlerts(nearby, weight);
  for (const k of Object.keys(within30) as Category[]) {
    sortAlerts(within30[k], weight);
  }

  return { nearby, within30ByCategory: within30 };
}

/* Back-compat: existing callers that only need the 5 km list */
export async function fetchVicAlertsNearby(
  lat: number,
  lon: number,
  _unused?: number,
  signal?: AbortSignal
): Promise<AlertModel[]> {
  const { nearby } = await fetchVicIncidents(lat, lon, signal);
  return nearby;
}

export function clearVicCache() { _feedCache = null; }