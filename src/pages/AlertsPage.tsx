// src/pages/AlertsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AlertsPage.css";
import AlertItem, { type Category, type Priority } from "../components/AlertItem";
import NotificationSettings, {
  type NotificationSettings as NotificationSettingsType,
} from "../components/NotificationSettings";
import QuickReportButton from "../components/QuickReportButton";
import QuickReportModal from "../components/QuickReportModal";
import { timeFromNow } from "../lib/time";

// assets
import bellOutlineIcon from "../assets/bell-outline.svg";

import {
  fetchVicAlertsNearby,
  type AlertModel as VicAlert, // (kept if you use this elsewhere)
} from "../services/vicEmergency";

// ---------------- Types ----------------
type WeatherResp = {
  current: {
    weather_code: number;
    rain: number;
    wind_speed_10m: number; // m/s
    wind_gusts_10m: number; // m/s
    snowfall: number;
    showers: number;
  };
};

export type AlertModel = {
  id: string;
  title: string;
  description: string;
  location: string;
  timestamp: number; // ms
  priority: Priority;
  category: Category;
  weatherInfo?: {
    windSpeed: number;
    precipitation: number;
    condition: string;
  };
};

// -------------- Config / env --------------
const FALLBACK = { lat: -37.8136, lon: 144.9631 }; // Melbourne CBD
const COORDS_KEY = "cs.coords";
const ADDRESS_KEY = "cs.address";

const WIND_HIGH = 50; // km/h for severe conditions
const WIND_MED = 25; // km/h for advisory conditions
const RAIN_HIGH = 2.0; // mm for severe conditions
const RAIN_MED = 0.5; // mm for advisory conditions

// ---------------- Helpers ----------------
const PRI_WEIGHT: Record<Priority, number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0,
};

function uniqById<T extends { id: string }>(arr: T[]) {
  const m = new Map<string, T>();
  for (const a of arr) if (!m.has(a.id)) m.set(a.id, a);
  return [...m.values()];
}

function getWeatherCondition(code: number): string {
  // WMO Weather interpretation codes (simplified)
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

// Build a weather alert from the Open-Meteo response
function buildWeatherAlert(weather: WeatherResp, address: string): AlertModel | null {
  const { wind_speed_10m: windMs, rain, wind_gusts_10m: gusts, weather_code } = weather.current;

  // Convert m/s → km/h
  const windKmh = windMs * 3.6;
  const gustsKmh = gusts * 3.6;

  const isSevere = windKmh >= WIND_HIGH || rain >= RAIN_HIGH || gustsKmh >= WIND_HIGH * 1.5;
  const isAdvisory = windKmh >= WIND_MED || rain >= RAIN_MED || gustsKmh >= WIND_MED * 1.5;

  const condition = getWeatherCondition(weather_code);

  let priority: Priority;
  let title: string;
  let description: string;

  if (isSevere) {
    priority = "CRITICAL";
    title = "Severe Weather Warning";
    description = `Strong winds (${Math.round(windKmh)} km/h)${
      gustsKmh > windKmh * 1.2 ? ` with gusts up to ${Math.round(gustsKmh)} km/h` : ""
    } and ${rain > 0 ? `heavy rain (${rain.toFixed(1)} mm/h)` : condition.toLowerCase()} expected. Reduced visibility and slippery conditions.`;
  } else if (isAdvisory) {
    priority = "MEDIUM";
    title = "Weather Advisory";
    description = `${condition} with moderate winds (${Math.round(windKmh)} km/h)${
      gustsKmh > windKmh * 1.2 ? ` and gusts up to ${Math.round(gustsKmh)} km/h` : ""
    }${rain > 0 ? ` and light rain (${rain.toFixed(1)} mm/h)` : ""}. Exercise caution while cycling.`;
  } else {
    priority = "LOW";
    title = "Current Conditions";
    description = `${condition} with light winds (${Math.round(windKmh)} km/h)${
      gustsKmh > windKmh * 1.2 ? ` and occasional gusts to ${Math.round(gustsKmh)} km/h` : ""
    }. Good conditions for cycling.`;
  }

  return {
    id: `weather#${Date.now()}`,
    title,
    description,
    location: address,
    timestamp: Date.now(),
    priority,
    category: "WEATHER",
    weatherInfo: { windSpeed: windKmh, precipitation: rain, condition },
  };
}

async function fetchWeatherData(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<WeatherResp | null> {
  try {
    // Using Vite dev server proxy to avoid CORS
    const url = `/api/weather/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,rain,wind_speed_10m,wind_gusts_10m,snowfall,showers&timezone=Australia%2FSydney`;
    const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
    return await response.json();
  } catch (error: any) {
    console.error("❌ Weather fetch failed:", error?.message || error);
    return null;
  }
}

// Simple reverse-geocode (BigDataCloud)
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const data = await response.json();
    return data.city || data.locality || data.principality || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

// ---------------- Component ----------------
export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showQuickReport, setShowQuickReport] = useState<boolean>(false);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettingsType>({
      enableWeather: true,
      enableTraffic: true,
      enableInfra: true,
      enableSafety: true,
      criticalOnly: false,
      pushNotifications: true,
    });

  const coordsRef = useRef<{ lat: number; lon: number }>(FALLBACK);
  const inFlightRef = useRef<AbortController | null>(null);
  const lastFetchRef = useRef(0);

  // Fetch & compose list (real data only)
  const fetchAll = useCallback(async (lat: number, lon: number) => {
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return; // debounce
    lastFetchRef.current = now;

    if (inFlightRef.current) inFlightRef.current.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;

    setLoading(true);
    try {
      const addressPromise = reverseGeocode(lat, lon);

      let weather: WeatherResp | null = null;
      try {
        weather = await fetchWeatherData(lat, lon, ac.signal);
      } catch (e) {
        console.warn("Weather API failed:", e);
      }

      let vicAlerts: AlertModel[] = [];
      try {
        vicAlerts = (await fetchVicAlertsNearby(lat, lon, undefined, ac.signal)) as AlertModel[];
      } catch (e) {
        console.warn("VIC Emergency API failed:", e);
      }

      const address = await addressPromise;

      try {
        if (address && !address.includes(",")) {
          localStorage.setItem(ADDRESS_KEY, address);
        }
      } catch {}

      const list: AlertModel[] = [];
      if (weather) {
        const weatherAlert = buildWeatherAlert(weather, address);
        if (weatherAlert) list.push(weatherAlert);
      }
      if (vicAlerts.length > 0) list.push(...vicAlerts);

      const sorted = uniqById(list).sort((a, b) => {
        const w = PRI_WEIGHT[b.priority] - PRI_WEIGHT[a.priority];
        return w !== 0 ? w : b.timestamp - a.timestamp;
      });

      setAlerts(sorted);

      try {
        localStorage.setItem("cs.alerts.total", String(sorted.length));
        window.dispatchEvent(new CustomEvent("cs:alerts", { detail: { total: sorted.length } }));
      } catch {}
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("❌ Critical error in fetchAll:", e);
        setAlerts([]);
        try {
          localStorage.setItem("cs.alerts.total", "0");
          window.dispatchEvent(new CustomEvent("cs:alerts", { detail: { total: 0 } }));
        } catch {}
      }
    } finally {
      if (inFlightRef.current === ac) inFlightRef.current = null;
      setLoading(false);
    }
  }, []);

  // Init coords + first fetch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COORDS_KEY);
      if (saved) {
        const { lat, lon } = JSON.parse(saved);
        if (Number.isFinite(lat) && Number.isFinite(lon)) coordsRef.current = { lat, lon };
      }
    } catch {}
    fetchAll(coordsRef.current.lat, coordsRef.current.lon);
  }, [fetchAll]);

  // Refresh on tab visibility
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        fetchAll(coordsRef.current.lat, coordsRef.current.lon);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchAll]);

  // Figma header stats
  const { critical, high, medium, low } = useMemo(
    () => ({
      critical: alerts.filter((a) => a.priority === "CRITICAL").length,
      high: alerts.filter((a) => a.priority === "HIGH").length,
      medium: alerts.filter((a) => a.priority === "MEDIUM").length,
      low: alerts.filter((a) => a.priority === "LOW").length,
    }),
    [alerts]
  );

  // Category counts for the bottom section
  const categories = useMemo(() => {
    type CatItem = { key: Category; name: string; desc: string; count: number };
    const counts = alerts.reduce((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {} as Partial<Record<Category, number>>);

    const val = (k: Category) => counts[k] ?? 0;

    return [
      { key: "WEATHER" as Category, name: "Weather Alerts", desc: "Conditions affecting cycling safety", count: val("WEATHER") },
      { key: "TRAFFIC" as Category, name: "Traffic Incidents", desc: "Accidents and road closures", count: val("TRAFFIC") },
      { key: "INFRA" as Category,   name: "Infrastructure",   desc: "Road works and maintenance",  count: val("INFRA") },
      { key: "SAFETY" as Category,  name: "Safety Warnings",  desc: "General safety information",  count: val("SAFETY") },
    ] as CatItem[];
  }, [alerts]);

  // Filter alerts based on notification settings
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const categoryEnabled =
        {
          WEATHER: notificationSettings.enableWeather,
          TRAFFIC: notificationSettings.enableTraffic,
          INFRA: notificationSettings.enableInfra,
          SAFETY: notificationSettings.enableSafety,
        }[alert.category] ?? true;

      if (!categoryEnabled) return false;

      if (notificationSettings.criticalOnly) {
        return alert.priority === "CRITICAL" || alert.priority === "HIGH";
      }
      return true;
    });
  }, [alerts, notificationSettings]);

  const onDismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const handleNotificationSettingsChange = (settings: NotificationSettingsType) => {
    setNotificationSettings(settings);
  };

  // Handle incident reporting submission
  const handleIncidentSubmit = async (
    incidentType: string,
    location: { lat: number; lon: number; address: string }
  ) => {
    try {
      console.log("📝 Submitting incident report:", {
        incident_type: incidentType,
        latitude: location.lat,
        longitude: location.lon,
        address: location.address,
        timestamp: new Date().toISOString(),
      });
      // TODO: POST to your backend
    } catch (error) {
      console.error("❌ Failed to submit incident report:", error);
    }
  };

  const openQuickReport = () => setShowQuickReport(true);
  const closeQuickReport = () => setShowQuickReport(false);

  // ---------------- Render ----------------
  return (
    <main className="alerts-page">
      {/* Header */}
      <section className="alerts-summary">
        <div className="summary-left">
          <img src={bellOutlineIcon} alt="" className="summary-icon" />
          <div>
            <h2>
              Active Alerts <span className="pill">{filteredAlerts.length}</span>
            </h2>
          </div>
        </div>
        <div className="priority-stats">
          <div className="priority-item high">
            <span>{critical + high}</span>
            High Priority
          </div>
          <div className="priority-item medium">
            <span>{medium}</span>
            Medium Priority
          </div>
        </div>
      </section>

      {/* List */}
      {loading && filteredAlerts.length === 0 ? (
        <div className="skeleton-list">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : filteredAlerts.length > 0 ? (
        <section className="alerts-list">
          {filteredAlerts.map((a) => (
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
          <p>No active alerts for your area right now.</p>
          <small>
            We're monitoring emergency services and weather conditions. Check back later or
            refresh to see the latest updates.
          </small>
        </section>
      )}

      {/* Categories (with emojis) */}
      {alerts.length > 0 && (
        <section className="alerts-categories">
          <h3>Alert Categories</h3>
          <div className="category-list">
            {categories
              .filter((cat) => cat.count > 0)
              .map((cat) => (
                <div key={cat.key} className="category-item">
                  <span>
                    <span
                      className="cat-emoji"
                      role="img"
                      aria-label={getCategoryLabel(cat.key)}
                      style={{ marginRight: 8, fontSize: "1.15rem", lineHeight: 1 }}
                    >
                      {getCategoryEmoji(cat.key)}
                    </span>
                    {cat.name}
                  </span>
                  <small>{cat.desc}</small>
                  <div className="cat-count">{cat.count}</div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Notification Settings */}
      <NotificationSettings onSettingsChange={handleNotificationSettingsChange} />

      {/* Quick Report FAB */}
      <QuickReportButton onClick={openQuickReport} />

      {/* Quick Report Modal */}
      <QuickReportModal
        isOpen={showQuickReport}
        onClose={closeQuickReport}
        onSubmit={handleIncidentSubmit}
      />
    </main>
  );
}

// --------------- Emoji helpers ---------------
function getCategoryEmoji(category: Category): string {
  switch (category) {
    case "WEATHER":
      return "🌧️";
    case "TRAFFIC":
      return "🚦";
    case "INFRA":
      return "🛠️";
    case "SAFETY":
      return "⚠️";
    default:
      return "🔔";
  }
}

function getCategoryLabel(category: Category): string {
  switch (category) {
    case "WEATHER":
      return "Weather";
    case "TRAFFIC":
      return "Traffic";
    case "INFRA":
      return "Infrastructure";
    case "SAFETY":
      return "Safety";
    default:
      return "Alerts";
  }
}