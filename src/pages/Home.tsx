// src/pages/Home.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";

import RiskHeaderCard from "../components/RiskHeaderCard";
import RiskBodyCard from "../components/RiskBodyCard";
import QuickReportButton from "../components/QuickReportButton";
import QuickReportModal from "../components/QuickReportModal";
import "../components/AlertCardWrapper.css";
import FlatCard from "../components/FlatCard";
import GeoPrompt, { type Coords } from "../components/GeoPrompt";
import { submitQuickReport } from "./ReportIncident";

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
  accidentsNearby?: number;
};

const API =
  import.meta.env.VITE_LAMBDA_URL ??
  "https://dbetjhlyj7smwrgcptcozm6amq0ovept.lambda-url.ap-southeast-2.on.aws/";

// ===== Tunables =====
const PROMPT_INTERVAL_MS = 10 * 60 * 1000;
const ADDRESS_KEY = "cs.address";
const COORDS_KEY = "cs.coords";
const PROMPTED_ONCE_KEY = "cs.loc.promptedOnce";
const LAST_PROMPT_TS_KEY = "cs.loc.lastPromptTs";
const LAST_GEOCODE_CELL_KEY = "cs.loc.lastGeocodeCell";

const FALLBACK = { lat: -37.8136, lon: 144.9631 };
const RADIUS_M = 500;
const FETCH_DEDUP_MS = 10_000;

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

const HAPTICS_KEY = "cs.haptics.enabled";
const canVibrate = () =>
  typeof navigator !== "undefined" &&
  "vibrate" in navigator &&
  typeof (navigator as any).vibrate === "function" &&
  typeof window !== "undefined" &&
  window.isSecureContext;

const vibrateOnce = () => (navigator as any).vibrate?.([160]);
const vibrateTwice = () => (navigator as any).vibrate?.([160, 90, 160]);

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
  const [riskLevel, setRiskLevel] = useState<number>(0);
  const [riskText, setRiskText] = useState<RiskText>("Low Risk");
  const [address, setAddress] = useState<string>("");
  const [crashCount, setCrashCount] = useState<number>(0);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [atmosphere, setAtmosphere] = useState<string | undefined>(undefined);

  // dialog
  const [geoOpen, setGeoOpen] = useState<boolean>(false);
  const [showQuickReport, setShowQuickReport] = useState<boolean>(false);

  // Haptics
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(HAPTICS_KEY) === "1"; } catch { return false; }
  });
  const prevRiskRef = useRef<RiskText | null>(null);
  const initializedRef = useRef(false);
  const supported = canVibrate();

  // Small UI styles
  const pillWrapStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: "10px", padding: "10px 12px", borderRadius: 12,
    background: "#f4f6fb", border: "1px solid rgba(0,0,0,0.05)", marginBottom: 10
  };
  const pillNoteStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginTop: 4 };
  const toggleBtnStyle: React.CSSProperties = {
    position: "relative", width: 56, height: 32, borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.1)",
    background: hapticsEnabled ? "linear-gradient(90deg,#22c55e,#16a34a)" : "#e5e7eb",
    cursor: supported ? "pointer" : "not-allowed", transition: "background 200ms ease", outline: "none"
  };
  const knobStyle: React.CSSProperties = {
    position: "absolute", top: 3, left: hapticsEnabled ? 28 : 3, width: 26, height: 26,
    background: "#fff", borderRadius: "50%", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", transition: "left 180ms ease"
  };

  const markPromptedNow = () => {
    sessionStorage.setItem(PROMPTED_ONCE_KEY, "1");
    sessionStorage.setItem(LAST_PROMPT_TS_KEY, String(Date.now()));
  };
  const isDue = () => {
    const last = Number(sessionStorage.getItem(LAST_PROMPT_TS_KEY) || 0);
    return Date.now() - last >= PROMPT_INTERVAL_MS;
  };

  const broadcastAddressAndCoords = useCallback((addr: string, lat: number, lon: number) => {
    try {
      localStorage.setItem(ADDRESS_KEY, addr);
      localStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lon }));
      window.dispatchEvent(new CustomEvent("cs:address", { detail: addr }));
      window.dispatchEvent(new CustomEvent("cs:coords", { detail: { lat, lon } }));
    } catch {}
  }, []);

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
        clusterId, incidentType: "severe_weather", description: desc, severity: sev,
        expiresAt: Math.floor(Date.now() / 1000) + ttlMin * 60, ackable: false,
        photoUrls: [], address: addr, agoText: "0 minutes ago",
      };
      upsertWeatherAlert(alert);
    },
    []
  );

  const shouldGeocode = (lat: number, lon: number) => {
    try {
      const cell = roundCell(lat, lon, 3);
      const last = sessionStorage.getItem(LAST_GEOCODE_CELL_KEY);
      return cell !== last;
    } catch { return true; }
  };

  const fetchRisk = useCallback(
    async (lat: number, lon: number, geocodeNow = false) => {
      try {
        const url = new URL(API);
        url.searchParams.set("lat", String(lat));
        url.searchParams.set("lon", String(lon));
        url.searchParams.set("r", String(RADIUS_M));
        url.searchParams.set("limit", String(import.meta.env.VITE_CRASH_SCAN_LIMIT ?? "6000"));
        url.searchParams.set("geocode", geocodeNow ? "1" : "0");

        const res = await fetch(url.toString(), { cache: "no-store" });
        const text = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);

        let data: RiskResponse;
        try { data = JSON.parse(text); } catch { throw new Error(`Bad JSON: ${text.slice(0, 200)}`); }

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

  const lastFetchKeyRef = useRef<string>("");
  const lastFetchAtRef = useRef<number>(0);

  const fetchRiskGuarded = useCallback(
    async (lat: number, lon: number, forceGeocode = false) => {
      const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
      const now = Date.now();
      const geocodeNow = forceGeocode || shouldGeocode(lat, lon);

      if (!geocodeNow) {
        if (lastFetchKeyRef.current === key && now - lastFetchAtRef.current < FETCH_DEDUP_MS) return;
      }

      lastFetchKeyRef.current = key;
      lastFetchAtRef.current = now;
      await fetchRisk(lat, lon, geocodeNow);
    },
    [fetchRisk]
  );

  const handleIncidentSubmit = async (
    incidentType: string,
    location: { lat: number; lon: number; address: string }
  ) => {
    try {
      await submitQuickReport(incidentType, location);
    } catch (error) {
      console.error("❌ Failed to submit quick report to database:", error);
      throw error;
    }
  };

  // ===== First load =====
  useEffect(() => {
    try { const savedAddr = localStorage.getItem(ADDRESS_KEY); if (savedAddr) setAddress(savedAddr); } catch {}

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

  // Refresh on focus
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

  // Haptics on risk change
  useEffect(() => {
    if (!hapticsEnabled || !supported) {
      prevRiskRef.current = riskText; initializedRef.current = true; return;
    }
    if (document.visibilityState !== "visible") {
      prevRiskRef.current = riskText; initializedRef.current = true; return;
    }
    const prev = prevRiskRef.current;
    const now = riskText;
    if (!initializedRef.current) {
      initializedRef.current = true; prevRiskRef.current = now; return;
    }
    if (prev !== now) {
      if (now === "Medium Risk") vibrateOnce();
      else if (now === "High Risk") vibrateTwice();
    }
    prevRiskRef.current = now;
  }, [riskText, hapticsEnabled, supported]);

  useEffect(() => {
    try { localStorage.setItem(HAPTICS_KEY, hapticsEnabled ? "1" : "0"); } catch {}
  }, [hapticsEnabled]);

  return (
    <main className="container has-fab">
      <GeoPrompt open={geoOpen} onGotCoords={(c: Coords) => {
        setGeoOpen(false);
        sessionStorage.setItem(PROMPTED_ONCE_KEY, "1");
        sessionStorage.setItem(LAST_PROMPT_TS_KEY, String(Date.now()));
        fetchRiskGuarded(c.lat, c.lon, true);
      }} onClose={() => {
        setGeoOpen(false);
        sessionStorage.setItem(PROMPTED_ONCE_KEY, "1");
        sessionStorage.setItem(LAST_PROMPT_TS_KEY, String(Date.now()));
      }} />

      <section className="alert-card-wrapper">
        <RiskHeaderCard
          title="Safety Alerts"
          icon={<img src={alertIcon} alt="alert" />}
          riskLevel={riskLevel}
          riskText={riskText}
        />
        <RiskBodyCard actionLink="/alerts" actionText="View Details">
          <div style={pillWrapStyle} aria-live="polite">
            <div style={{display: "flex", flexDirection: "column"}}>
              <strong style={{fontSize: 14, color: "#111827"}}>Haptic alerts</strong>
              <span style={pillNoteStyle}>
                {supported ? "Vibrate on Medium/High risk (Android Chrome)." : "Not supported on this device/browser."}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={hapticsEnabled}
              aria-label={hapticsEnabled ? "Disable haptic alerts" : "Enable haptic alerts"}
              onClick={() => {
                if (!supported) return;
                setHapticsEnabled((prev) => {
                  const next = !prev;
                  if (next) vibrateOnce();
                  return next;
                });
              }}
              disabled={!supported}
              style={toggleBtnStyle}
            >
              <span style={knobStyle} />
            </button>
          </div>

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

      <QuickReportButton onClick={() => setShowQuickReport(true)} />
      <QuickReportModal
        isOpen={showQuickReport}
        onClose={() => setShowQuickReport(false)}
        onSubmit={handleIncidentSubmit}
      />
    </main>
  );
}