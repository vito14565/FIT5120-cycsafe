// src/pages/AlertsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AlertsPage.css";
import AlertItem, { type Category, type Priority } from "../components/AlertItem";
import { timeFromNow } from "../lib/time";

import weatherIcon from "../assets/weather.svg";
import trafficIcon from "../assets/traffic.svg";
import infrastructureIcon from "../assets/infrastructure.svg";
import warningIcon from "../assets/warning.svg";

type AlertModel = {
  id: string;
  title: string;
  description: string;
  location: string;
  timestamp: number;       // ms
  priority: Priority;
  category: Category;
};

type RiskResp = {
  ok: boolean;
  address?: string;
  lat?: number;
  lon?: number;
  weather?: { windSpeed?: number; precipitation?: number; temperature?: number };
};

const API =
  import.meta.env.VITE_LAMBDA_URL ??
  "https://dbetjhlyj7smwrgcptcozm6amq0ovept.lambda-url.ap-southeast-2.on.aws/";

const FALLBACK = { lat: -37.8136, lon: 144.9631 }; // Melbourne CBD
const ADDRESS_KEY = "cs.address";
const COORDS_KEY  = "cs.coords";

const DEMO_ON   = String(import.meta.env.VITE_DEMO_ALERTS ?? "0") === "1";

// thresholds for building a WEATHER alert from live wx
const WIND_MED  = Number(import.meta.env.VITE_WIND_MED_MS ?? 10);
const WIND_HIGH = Number(import.meta.env.VITE_WIND_HIGH_MS ?? 14);
const RAIN_MM   = Number(import.meta.env.VITE_RAIN_MM ?? 1.0);

/** Priority sort weight (CRITICAL > HIGH > MEDIUM > LOW) */
const PRI_WEIGHT: Record<Priority, number> = {
  CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0,
};

/** Small skeleton list while loading */
function SkeletonList() {
  return (
    <div className="skeleton-list">
      <div className="skeleton-card" />
      <div className="skeleton-card" />
      <div className="skeleton-card" />
    </div>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertModel[]>([]);
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [, setTick] = useState(0);  // re-render every minute for “x minutes ago”

  const coordsRef = useRef<{ lat: number; lon: number }>(FALLBACK);
  const inFlightRef = useRef<AbortController | null>(null);
  const lastFetchTsRef = useRef(0);

  const sanitize = (list: AlertModel[]) =>
    (list || [])
      .filter(Boolean)
      .filter(a => a.title || a.description)
      .filter(a => a.timestamp != null);

  // ========== 1) WEATHER alert from live API ==========
  const buildWeatherAlert = (data: RiskResp): AlertModel | null => {
    const ws   = Number(data.weather?.windSpeed ?? 0);
    const rain = Number(data.weather?.precipitation ?? 0);
    if (ws < WIND_MED && rain < RAIN_MM) return null;

    const addr =
      data.address ||
      localStorage.getItem(ADDRESS_KEY) ||
      [data.lat, data.lon].filter(Boolean).join(", ");

    const isHigh = ws >= WIND_HIGH || rain >= RAIN_MM * 3;
    const priority: Priority = isHigh ? "HIGH" : "MEDIUM";
    const title = isHigh ? "Severe Weather Warning" : "Weather Advisory";
    const description = isHigh
      ? `Strong winds (~${Math.round(ws)} m/s) or heavy rain (${rain.toFixed(1)} mm/h). Reduced visibility & hazardous conditions.`
      : `Gusty winds (~${Math.round(ws)} m/s) or rain (${rain.toFixed(1)} mm/h). Ride with caution.`;

    return {
      id: `wx#${Date.now()}`,
      title,
      description,
      location: addr || "Your area",
      timestamp: Date.now(),
      priority,
      category: "WEATHER",
    };
  };

  // ========== 2) DEMO alerts (optional) for a full Figma look ==========
  const buildDemoAlerts = (addr: string): AlertModel[] => {
    if (!DEMO_ON) return [];
    const now = Date.now();
    return [
      {
        id: "demo#critical-weather",
        title: "Severe Weather Warning",
        description: "Strong winds (40+ km/h) and heavy rain expected between 2–6 PM. Reduced visibility and slippery conditions.",
        location: addr,
        timestamp: now - 5 * 60_000,
        priority: "CRITICAL",
        category: "WEATHER",
      },
      {
        id: "demo#traffic-major",
        title: "Major Accident – Route Blocked",
        description: "Multi-vehicle accident on Swanston Street near Melbourne University. Emergency services on scene.",
        location: "Swanston St, Carlton",
        timestamp: now - 12 * 60_000,
        priority: "HIGH",
        category: "TRAFFIC",
      },
      {
        id: "demo#infra-works",
        title: "Road Works Active",
        description: "Lane closures on Collins Street affecting cycling lanes. Expect delays and exercise extra caution.",
        location: "Collins St, Melbourne",
        timestamp: now - 60 * 60_000,
        priority: "MEDIUM",
        category: "INFRA",
      },
      {
        id: "demo#holiday",
        title: "Holiday Period Alert",
        description: "Increased recreational cycling activity. Higher risk of inexperienced cyclists on popular routes.",
        location: "Capital City Trail",
        timestamp: now - 2 * 60 * 60_000,
        priority: "MEDIUM",
        category: "SAFETY",
      },
      {
        id: "demo#trail-maint",
        title: "Bike Path Maintenance",
        description: "Scheduled maintenance on Yarra Trail between 10 PM – 6 AM. Alternative routes available.",
        location: "Yarra Trail, Richmond",
        timestamp: now - 4 * 60 * 60_000,
        priority: "LOW",
        category: "INFRA",
      },
    ];
  };

  // ========== 3) Fetch + compose alerts (single in-flight, AbortError-safe) ==========
  const fetchAlerts = useCallback(async (lat: number, lon: number) => {
    // throttle visibility-triggered calls
    const now = Date.now();
    if (now - lastFetchTsRef.current < 1500) return;
    lastFetchTsRef.current = now;

    // cancel previous request
    if (inFlightRef.current) inFlightRef.current.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;

    setLoading(prev => prev || alerts.length === 0);

    try {
      const url = new URL(API);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));

      // If we already have an address stored, skip reverse-geocoding on backend
      const hasAddr = !!localStorage.getItem(ADDRESS_KEY);
      url.searchParams.set("geocode", hasAddr ? "0" : "1");

      // This page just needs weather context; keep radius small & cheap
      url.searchParams.set("r", "500");

      const res = await fetch(url.toString(), { cache: "no-store", signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RiskResp = await res.json();

      const addr = data.address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setAddress(addr);

      const next: AlertModel[] = [];

      // live weather (optional)
      const weatherAlert = data.ok ? buildWeatherAlert(data) : null;
      if (weatherAlert) next.push(weatherAlert);

      // demo data (optional)
      next.push(...buildDemoAlerts(addr));

      // sort by priority desc then time desc
      const sorted = sanitize(next).sort((a, b) => {
        const w = PRI_WEIGHT[b.priority] - PRI_WEIGHT[a.priority];
        return w !== 0 ? w : b.timestamp - a.timestamp;
      });

      setAlerts(sorted);

      // broadcast for bell badge
      try {
        localStorage.setItem("cs.alerts.total", String(sorted.length));
        window.dispatchEvent(new CustomEvent("cs:alerts", { detail: { total: sorted.length } }));
      } catch {}
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // silently ignore aborted fetches
        return;
      }
      console.error("fetch alerts failed:", e);
      setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      setAlerts([]);
      try {
        localStorage.setItem("cs.alerts.total", "0");
        window.dispatchEvent(new CustomEvent("cs:alerts", { detail: { total: 0 } }));
      } catch {}
    } finally {
      if (inFlightRef.current === ac) inFlightRef.current = null;
      setLoading(false);
    }
  }, [alerts.length]);

  // init coords + first fetch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COORDS_KEY);
      if (saved) {
        const { lat, lon } = JSON.parse(saved);
        if (Number.isFinite(lat) && Number.isFinite(lon)) coordsRef.current = { lat, lon };
      }
    } catch {}
    fetchAlerts(coordsRef.current.lat, coordsRef.current.lon);
  }, [fetchAlerts]);

  // react to weather list updates (if any)
  useEffect(() => {
    const onWeatherList = () => fetchAlerts(coordsRef.current.lat, coordsRef.current.lon);
    window.addEventListener("cs:weather:list", onWeatherList);
    return () => window.removeEventListener("cs:weather:list", onWeatherList);
  }, [fetchAlerts]);

  // poll when visible + minute ticker for relative time
  useEffect(() => {
    const tickId = window.setInterval(() => setTick(v => v + 1), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchAlerts(coordsRef.current.lat, coordsRef.current.lon);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(tickId); document.removeEventListener("visibilitychange", onVis); };
  }, [fetchAlerts]);

  // Summary counts (Figma: High + Medium emphasized)
  const { critical, high, medium, low } = useMemo(() => ({
    critical: alerts.filter(a => a.priority === "CRITICAL").length,
    high:     alerts.filter(a => a.priority === "HIGH").length,
    medium:   alerts.filter(a => a.priority === "MEDIUM").length,
    low:      alerts.filter(a => a.priority === "LOW").length,
  }), [alerts]);

  const onDismiss = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  return (
    <main className="alerts-page">
      {/* Summary header like your Figma */}
      <section className="alerts-summary">
        <div className="summary-left">
          <img src={warningIcon} alt="" className="summary-icon" />
          <h2>Active Alerts <span className="pill">{alerts.length}</span></h2>
        </div>
        <div className="priority-stats">
          <div className="priority-item high"><span>{high}</span>High Priority</div>
          <div className="priority-item medium"><span>{medium}</span>Medium Priority</div>
        </div>
      </section>

      {/* List / Skeleton */}
      {loading && alerts.length === 0 ? (
        <SkeletonList />
      ) : alerts.length > 0 ? (
        <section className="alerts-list">
          {alerts.map((a) => (
            <AlertItem
              key={a.id}
              title={a.title}
              description={a.description}
              location={a.location}
              time={timeFromNow(a.timestamp)}
              priority={a.priority}
              category={a.category}
              dismissable
              onDismiss={() => onDismiss(a.id)}
            />
          ))}
        </section>
      ) : (
        <section className="alerts-empty">
          <p>No active alerts for your area.</p>
        </section>
      )}

      {/* Category grid */}
      <section className="alerts-categories">
        <h3>Alert Categories</h3>
        <div className="category-list">
          <div className="category-item">
            <span><img src={weatherIcon} alt="Weather" />Weather Alerts</span>
            <small>Conditions affecting cycling safety</small>
            <em className="cat-count">{alerts.filter(a => a.category === "WEATHER").length}</em>
          </div>
          <div className="category-item">
            <span><img src={trafficIcon} alt="Traffic" />Traffic Incidents</span>
            <small>Accidents and road closures</small>
            <em className="cat-count">{alerts.filter(a => a.category === "TRAFFIC").length}</em>
          </div>
          <div className="category-item">
            <span><img src={infrastructureIcon} alt="Infrastructure" />Infrastructure</span>
            <small>Road works and maintenance</small>
            <em className="cat-count">{alerts.filter(a => a.category === "INFRA").length}</em>
          </div>
          <div className="category-item">
            <span><img src={warningIcon} alt="Safety" />Safety Warnings</span>
            <small>General safety information</small>
            <em className="cat-count">{alerts.filter(a => a.category === "SAFETY").length}</em>
          </div>
        </div>
      </section>
    </main>
  );
}