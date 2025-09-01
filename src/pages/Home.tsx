import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import RiskHeaderCard from "../components/RiskHeaderCard";
import RiskBodyCard from "../components/RiskBodyCard";
import "../components/AlertCardWrapper.css";
import FlatCard from "../components/FlatCard";
import GeoPrompt, { type Coords } from "../components/GeoPrompt";
import ReportFab from "../components/ReportFab";

import alertIcon from "../assets/alert.svg";
import routeIcon from "../assets/route.svg";
import insightIcon from "../assets/insight.svg";

type RiskText = "Low Risk" | "Medium Risk" | "High Risk";
type Weather = { windSpeed?: number; precipitation?: number; temperature?: number };
type RiskResponse = {
  ok: boolean;
  risk: number;
  riskText: RiskText;
  address?: string;
  lat?: number;
  lon?: number;
  weather?: Weather;
  atmosphere?: string;
  accidentsNearby?: number; // backend crash count within r meters
};

const API =
  import.meta.env.VITE_LAMBDA_URL ??
  "https://dbetjhlyj7smwrgcptcozm6amq0ovept.lambda-url.ap-southeast-2.on.aws/";

// ===== Tunables =====
const PROMPT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const ADDRESS_KEY = "cs.address";
const COORDS_KEY = "cs.coords";
const PROMPTED_ONCE_KEY = "cs.loc.promptedOnce";
const LAST_PROMPT_TS_KEY = "cs.loc.lastPromptTs";

// 🔑 remember the last cell we reverse-geocoded so we don’t geocode every poll
const LAST_GEOCODE_CELL_KEY = "cs.loc.lastGeocodeCell";

const FALLBACK = { lat: -37.8136, lon: 144.9631 }; // Melbourne CBD
const RADIUS_M = 500; // our crash radius
const SCAN_LIMIT = String(import.meta.env.VITE_CRASH_SCAN_LIMIT ?? "4000"); // keep modest in dev
const FETCH_DEDUP_MS = 10_000; // don't refetch same rounded location within 10s

// === Weather alert helpers ===
type WeatherAlert = {
  clusterId: string;
  incidentType: "severe_weather";
  description: string;
  severity: "low" | "medium" | "high";
  expiresAt: number;
  ackable: false;
  photoUrls?: string[];
  address?: string;
  agoText?: string;
};

// ~110m lat cell; lon varies with cos(lat)
function roundCell(lat: number, lon: number, p = 3) {
  const f = 10 ** p;
  const latc = Math.floor(lat * f) / f;
  const lonc = Math.floor(lon * f) / f;
  return `${latc.toFixed(p)}_${lonc.toFixed(p)}`;
}
function upsertWeatherAlert(a: WeatherAlert) {
  let list: WeatherAlert[] = [];
  try { list = JSON.parse(localStorage.getItem("cs.weather.alerts") || "[]") || []; } catch {}
  const idx = list.findIndex((x) => x.clusterId === a.clusterId);
  if (idx === -1) list.push(a); else list[idx] = a;
  localStorage.setItem("cs.weather.alerts", JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("cs:weather:list"));
}
function removeWeatherAlert(clusterId: string) {
  let list: WeatherAlert[] = [];
  try { list = JSON.parse(localStorage.getItem("cs.weather.alerts") || "[]") || []; } catch {}
  const next = list.filter((x) => x.clusterId !== clusterId);
  localStorage.setItem("cs.weather.alerts", JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("cs:weather:list"));
}

export default function Home() {
  // ===== Display state =====
  const [riskLevel, setRiskLevel] = useState<number>(0); // legacy %
  const [riskText, setRiskText] = useState<RiskText>("Low Risk");
  const [address, setAddress] = useState<string>("");
  const [alertCount, setAlertCount] = useState<number>(0); // ← derive from cs.alerts.list
  const [crashCount, setCrashCount] = useState<number>(0);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [atmosphere, setAtmosphere] = useState<string | undefined>(undefined);

  // dialog
  const [geoOpen, setGeoOpen] = useState<boolean>(false);

  // de-dupe guard
  const lastFetchKeyRef = useRef<string>("");
  const lastFetchAtRef = useRef<number>(0);

  const markPromptedNow = () => {
    sessionStorage.setItem(PROMPTED_ONCE_KEY, "1");
    sessionStorage.setItem(LAST_PROMPT_TS_KEY, String(Date.now()));
  };
  const isDue = () => {
    const last = Number(sessionStorage.getItem(LAST_PROMPT_TS_KEY) || 0);
    return Date.now() - last >= PROMPT_INTERVAL_MS;
  };

  // Write to localStorage + broadcast
  const broadcastAddressAndCoords = useCallback((addr: string, lat: number, lon: number) => {
    try {
      localStorage.setItem(ADDRESS_KEY, addr);
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lon }));
      window.dispatchEvent(new CustomEvent("cs:address", { detail: addr }));
      window.dispatchEvent(new CustomEvent("cs:coords", { detail: { lat, lon } }));
    } catch {}
  }, []);

  // Reflect risk into weather alert list
  const publishWeatherFromRisk = useCallback(
    (rt: RiskText, addr: string, lat: number, lon: number, wx?: Weather) => {
      const cell = roundCell(lat, lon, 3);
      const clusterId = `weather#${cell}`;

      if (rt === "Low Risk") { removeWeatherAlert(clusterId); return; }

      const wind = wx?.windSpeed != null ? `~${Math.round(Number(wx.windSpeed))} m/s` : undefined;
      const rain = wx?.precipitation != null ? `${Number(wx.precipitation).toFixed(1)} mm/h` : undefined;
      const details = [wind && `winds (${wind})`, rain && `rain (${rain})`].filter(Boolean).join(" or ");

      const sev: WeatherAlert["severity"] = rt === "High Risk" ? "high" : "medium";
      const desc =
        rt === "High Risk"
          ? `Severe Weather Warning. ${details || "Strong winds or heavy rain"}. Reduced visibility and hazardous conditions.`
          : `Weather Advisory. ${details || "Gusty winds or rain expected"}. Use caution while cycling.`;
      const ttlMin = rt === "High Risk" ? 30 : 20;

      const alert: WeatherAlert = {
        clusterId,
        incidentType: "severe_weather",
        description: desc,
        severity: sev,
        expiresAt: Math.floor(Date.now() / 1000) + ttlMin * 60,
        ackable: false,
        photoUrls: [],
        address: addr,
        agoText: "0 minutes ago",
      };
      upsertWeatherAlert(alert);
    },
    []
  );

  // Decide when to reverse-geocode (per ~0.001° cell)
  const shouldGeocode = (lat: number, lon: number) => {
    try {
      const cell = roundCell(lat, lon, 3);
      const last = sessionStorage.getItem(LAST_GEOCODE_CELL_KEY);
      return cell !== last;
    } catch {
      return true;
    }
  };

  // Raw fetch (optionally request reverse geocode)
  const fetchRisk = useCallback(
    async (lat: number, lon: number, geocodeNow = false) => {
      try {
        const url = new URL(API);
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lon", String(lon));
        url.searchParams.set("r", String(RADIUS_M));
        url.searchParams.set("limit", String(import.meta.env.VITE_CRASH_SCAN_LIMIT ?? "6000")); // set 6000 in .env
        url.searchParams.set("geocode", geocodeNow ? "1" : "0");

        const res = await fetch(url.toString(), { cache: "no-store" });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
        }

        let data: RiskResponse;
        try { data = JSON.parse(text); }
        catch { throw new Error(`Bad JSON: ${text.slice(0, 200)}`); }

        const addr = data.address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setRiskLevel(Math.round(data.risk || 0));
        setRiskText(data.riskText || "Low Risk");
        setAddress(addr);
        broadcastAddressAndCoords(addr, lat, lon);

        const crashes = Number(data.accidentsNearby ?? 0);
        setCrashCount(Number.isFinite(crashes) ? crashes : 0);
        try { window.dispatchEvent(new CustomEvent("cs:crash", { detail: { count: crashes, radius: RADIUS_M } })); } catch {}

        setWeather(data.weather ?? null);
        setAtmosphere(data.atmosphere);

        publishWeatherFromRisk(data.riskText || "Low Risk", addr, lat, lon, data.weather);

        if (geocodeNow && data.address) {
          try {
            const cell = roundCell(lat, lon, 3);
            sessionStorage.setItem(LAST_GEOCODE_CELL_KEY, cell);
          } catch {}
        }
      } catch (e) {
        console.error("fetch risk failed:", e);
        const addr = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        setAddress(addr);
        broadcastAddressAndCoords(addr, lat, lon);
        setCrashCount(0);
        setWeather(null);
        setAtmosphere(undefined);
        try { window.dispatchEvent(new CustomEvent("cs:crash", { detail: { count: 0, radius: RADIUS_M } })); } catch {}
      }
    },
    [broadcastAddressAndCoords, publishWeatherFromRisk]
  );

  // Guarded wrapper to avoid spamming Lambda with same coords repeatedly
  const fetchRiskGuarded = useCallback(
    async (lat: number, lon: number, forceGeocode = false) => {
      const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
      const now = Date.now();

      const geocodeNow = forceGeocode || shouldGeocode(lat, lon);

      if (!geocodeNow) {
        if (lastFetchKeyRef.current === key && now - lastFetchAtRef.current < FETCH_DEDUP_MS) {
          return; // skip duplicate fetch
        }
      }

      lastFetchKeyRef.current = key;
      lastFetchAtRef.current = now;
      await fetchRisk(lat, lon, geocodeNow);
    },
    [fetchRisk]
  );

  // ===== First load =====
  useEffect(() => {
    try {
      const savedAddr = localStorage.getItem(ADDRESS_KEY);
      if (savedAddr) setAddress(savedAddr);
    } catch {}

    try {
      const saved = localStorage.getItem(COORDS_KEY);
      if (saved) {
        const { lat, lon } = JSON.parse(saved);
        if (Number.isFinite(lat) && Number.isFinite(lon)) fetchRiskGuarded(lat, lon);
        else fetchRiskGuarded(FALLBACK.lat, FALLBACK.lon);
      } else {
        fetchRiskGuarded(FALLBACK.lat, FALLBACK.lon);
      }
    } catch {
      fetchRiskGuarded(FALLBACK.lat, FALLBACK.lon);
    }

    (async () => {
      const perm: PermissionStatus | undefined = await (navigator as any)?.permissions?.query?.({
        name: "geolocation" as PermissionName,
      }).catch(() => undefined as any);
      if (perm?.state === "granted") {
        navigator.geolocation.getCurrentPosition(
          // 🔥 First real GPS fix → force geocode for a human-readable name
          (pos) => fetchRiskGuarded(pos.coords.latitude, pos.coords.longitude, true),
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
        );
      } else {
        const promptedOnce = sessionStorage.getItem(PROMPTED_ONCE_KEY) === "1";
        if (!promptedOnce) setGeoOpen(true);
      }
    })();
  }, [fetchRiskGuarded]);

  // Open GeoPrompt from header action
  useEffect(() => {
    const onPrompt = () => setGeoOpen(true);
    window.addEventListener("cs:prompt-geo", onPrompt);
    return () => window.removeEventListener("cs:prompt-geo", onPrompt);
  }, []);

  // Refresh on focus (respect de-dupe; geocode only if entering new cell)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchRiskGuarded(pos.coords.latitude, pos.coords.longitude),
          () => {},
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
        );
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchRiskGuarded]);

  // ===== Active alerts count (derive from list, stays fresh) =====
  useEffect(() => {
    const recompute = () => {
      try {
        const raw = JSON.parse(localStorage.getItem("cs.alerts.list") || "[]");
        // If you want *incidents only*, uncomment the next line:
        // const onlyIncidents = (Array.isArray(raw) ? raw : []).filter((x: any) => x?.incidentType !== "severe_weather");
        // setAlertCount(onlyIncidents.length);
        setAlertCount(Array.isArray(raw) ? raw.length : 0); // all alerts (weather + incidents)
      } catch {
        setAlertCount(0);
      }
    };

    // initial compute
    recompute();

    // listen to service broadcasts
    const onAlerts = () => recompute();
    const onList = () => recompute();
    window.addEventListener("cs:alerts", onAlerts);
    window.addEventListener("cs:alerts:list", onList);

    // cross-tab/localStorage sync
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cs.alerts.list") recompute();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("cs:alerts", onAlerts);
      window.removeEventListener("cs:alerts:list", onList);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // GeoPrompt returns
  const onGotCoords = (c: Coords) => {
    setGeoOpen(false);
    sessionStorage.setItem(PROMPTED_ONCE_KEY, "1");
    sessionStorage.setItem(LAST_PROMPT_TS_KEY, String(Date.now()));
    // User explicitly chose a new location → force geocode now
    fetchRiskGuarded(c.lat, c.lon, true);
  };
  const onClosePrompt = () => {
    setGeoOpen(false);
    sessionStorage.setItem(PROMPTED_ONCE_KEY, "1");
    sessionStorage.setItem(LAST_PROMPT_TS_KEY, String(Date.now()));
  };

  return (
    <main className="container has-fab">
      <GeoPrompt open={geoOpen} onGotCoords={onGotCoords} onClose={onClosePrompt} />

      <section className="alert-card-wrapper">
        <RiskHeaderCard
          title="Safety Alerts"
          icon={<img src={alertIcon} alt="alert" />}
          riskLevel={riskLevel}   // big % on the right
          riskText={riskText}     // “Low/Medium/High Risk”
        />
        <RiskBodyCard countOverride={alertCount} actionLink="/alerts" actionText="View Details">
          <Link to="/report" className="btn-outline">Report Incident</Link>
        </RiskBodyCard>
      </section>

      <FlatCard
        title="Safe Routing"
        subtitle="Plan your safest route"
        icon={<img src={routeIcon} alt="route" />}
        actionText="Plan Route"
        actionLink="/plan-route"
        links={[
          { text: "4 safe routes available", className: "success" },
          { text: "🤖 AI-powered recommendations", className: "info" },
        ]}
      />

      <FlatCard
        title="Data Insights"
        subtitle="Safety statistics & trends"
        icon={<img src={insightIcon} alt="insight" />}
        actionText="View Insights"
        actionLink="/insights"
        links={[
          { text: "Melbourne cycling data", className: "purple" },
          { text: "30–39 age insights", className: "orange" },
        ]}
      />

      <ReportFab />
    </main>
  );
}