// src/pages/AlertsPage.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AlertsPage.css";
import AlertItem, { type Category, type Priority } from "../components/AlertItem";
import NotificationSettings, { type NotificationSettings as NotificationSettingsType } from "../components/NotificationSettings";
import { timeFromNow } from "../lib/time";

// assets
import bellOutlineIcon from "../assets/bell-outline.svg";

import { fetchVicAlertsNearby, type AlertModel as VicAlert } from "../services/vicEmergency";
// Removed mock data imports - only using real data

type WeatherResp = {
  current: {
    weather_code: number;
    rain: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    snowfall: number;
    showers: number;
  };
};

// --- config / env
const FALLBACK = { lat: -37.8136, lon: 144.9631 }; // Melbourne CBD
const COORDS_KEY = "cs.coords";
const ADDRESS_KEY = "cs.address";

const WIND_HIGH = 50; // km/h for severe conditions
const WIND_MED = 25;  // km/h for advisory conditions
const RAIN_HIGH = 2.0; // mm for severe conditions
const RAIN_MED = 0.5;  // mm for advisory conditions

export type AlertModel = {
  id: string;
  title: string;
  description: string;
  location: string;
  timestamp: number;       // ms
  priority: Priority;
  category: Category;
  weatherInfo?: {
    windSpeed: number;
    precipitation: number;
    condition: string;
  };
};

// --- helpers
const PRI_WEIGHT: Record<Priority, number> = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

function uniqById<T extends { id: string }>(arr: T[]) {
  const m = new Map<string, T>();
  for (const a of arr) if (!m.has(a.id)) m.set(a.id, a);
  return [...m.values()];
}

function getWeatherCondition(code: number): string {
  // WMO Weather interpretation codes
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

// Enhanced weather alert that includes weather info in description
function buildWeatherAlert(weather: WeatherResp, address: string): AlertModel | null {
  const { wind_speed_10m: windMs, rain, wind_gusts_10m: gusts, weather_code } = weather.current;
  
  // Convert m/s to km/h
  const windKmh = windMs * 3.6;
  const gustsKmh = gusts * 3.6;
  
  // Debug the actual weather values
  console.log("🌤️ Weather conditions:", {
    windKmh: Math.round(windKmh * 10) / 10,
    gustsKmh: Math.round(gustsKmh * 10) / 10,
    rain,
    weather_code,
    windThreshold: WIND_MED,
    rainThreshold: RAIN_MED
  });
  
  const isSevere = windKmh >= WIND_HIGH || rain >= RAIN_HIGH || gustsKmh >= WIND_HIGH * 1.5;
  const isAdvisory = windKmh >= WIND_MED || rain >= RAIN_MED || gustsKmh >= WIND_MED * 1.5;
  
  console.log("🌤️ Weather alert check:", { isSevere, isAdvisory });

  const condition = getWeatherCondition(weather_code);
  
  // Always create a weather card, but adjust priority and content based on conditions
  let priority: Priority;
  let title: string;
  let description: string;
  
  if (isSevere) {
    priority = "CRITICAL";
    title = "Severe Weather Warning";
    description = `Strong winds (${Math.round(windKmh)} km/h)${gustsKmh > windKmh * 1.2 ? ` with gusts up to ${Math.round(gustsKmh)} km/h` : ''} and ${rain > 0 ? `heavy rain (${rain.toFixed(1)} mm/h)` : condition.toLowerCase()} expected. Reduced visibility and slippery conditions.`;
  } else if (isAdvisory) {
    priority = "MEDIUM";
    title = "Weather Advisory";
    description = `${condition} with moderate winds (${Math.round(windKmh)} km/h)${gustsKmh > windKmh * 1.2 ? ` and gusts up to ${Math.round(gustsKmh)} km/h` : ''}${rain > 0 ? ` and light rain (${rain.toFixed(1)} mm/h)` : ''}. Exercise caution while cycling.`;
  } else {
    priority = "LOW";
    title = "Current Conditions";
    description = `${condition} with light winds (${Math.round(windKmh)} km/h)${gustsKmh > windKmh * 1.2 ? ` and occasional gusts to ${Math.round(gustsKmh)} km/h` : ''}. Good conditions for cycling.`;
  }

  console.log("✅ Creating weather card:", { title, priority, windKmh, gustsKmh, rain });

  return {
    id: `weather#${Date.now()}`,
    title,
    description,
    location: address,
    timestamp: Date.now(),
    priority,
    category: "WEATHER",
    weatherInfo: {
      windSpeed: windKmh,
      precipitation: rain,
      condition
    }
  };
}

async function fetchWeatherData(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherResp | null> {
  try {
    // Use Vite dev server proxy - no CORS issues!
    const url = `/api/weather/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,rain,wind_speed_10m,wind_gusts_10m,snowfall,showers&timezone=Australia%2FSydney`;
    
    console.log(`🔄 Fetching weather via Vite proxy`);
    const response = await fetch(url, { 
      signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
    
    const data = await response.json();
    console.log(`✅ Weather proxy fetch successful!`);
    return data;
    
  } catch (error) {
    console.error("❌ Weather fetch failed:", error.message);
    return null;
  }
}

// Simple geocoding to get address from coords
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const data = await response.json();
    return data.city || data.locality || data.principality || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsType>({
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

  // fetch & compose list - ONLY REAL DATA
  const fetchAll = useCallback(async (lat: number, lon: number) => {
    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return; // debounce
    lastFetchRef.current = now;

    if (inFlightRef.current) inFlightRef.current.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;

    setLoading(true);
    try {
      console.log("Fetching REAL alerts for:", lat, lon);
      
      // Get address for location display
      const addressPromise = reverseGeocode(lat, lon);
      
      // 1) Try real weather data - only show if successful
      let weather = null;
      try {
        weather = await fetchWeatherData(lat, lon, ac.signal);
        console.log("✅ Real weather data received:", weather);
      } catch (error) {
        console.warn("❌ Real weather API failed:", error);
        // Don't use mock data - just continue without weather alert
      }
      
      // 2) Try real VIC emergency feeds - only show if successful  
      let vicAlerts: AlertModel[] = [];
      try {
        vicAlerts = await fetchVicAlertsNearby(lat, lon, undefined, ac.signal) as AlertModel[];
        console.log("✅ Real VIC alerts received:", vicAlerts.length, "items");
      } catch (error) {
        console.warn("❌ Real VIC Emergency API failed:", error);
        // Don't use mock data - just continue with empty array
      }

      const address = await addressPromise;

      // Store address in localStorage
      try { 
        if (address && !address.includes(',')) {
          localStorage.setItem(ADDRESS_KEY, address); 
        }
      } catch {}

      const list: AlertModel[] = [];

      // Weather alert (only if real weather data was successful)
      if (weather) {
        const weatherAlert = buildWeatherAlert(weather, address);
        if (weatherAlert) {
          console.log("✅ Generated weather alert from real data:", weatherAlert.title);
          list.push(weatherAlert);
        }
      }

      // VIC items → only real data
      if (vicAlerts.length > 0) {
        console.log("✅ Adding", vicAlerts.length, "real VIC emergency alerts");
        list.push(...vicAlerts);
      }

      console.log("📊 Total REAL alerts:", list.length);

      // de-dupe + sort like Figma: priority then recency
      const sorted = uniqById(list).sort((a, b) => {
        const w = PRI_WEIGHT[b.priority] - PRI_WEIGHT[a.priority];
        return w !== 0 ? w : b.timestamp - a.timestamp;
      });

      console.log("📋 Final sorted REAL alerts:", sorted.length, "items");
      if (sorted.length === 0) {
        console.log("ℹ️ No real alerts found - showing empty state");
      }
      
      setAlerts(sorted);
      
      // Update global alert count
      try {
        localStorage.setItem("cs.alerts.total", String(sorted.length));
        window.dispatchEvent(new CustomEvent("cs:alerts", { detail: { total: sorted.length } }));
      } catch {}
      
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        console.error("❌ Critical error in fetchAll:", e);
        // Show empty state, not mock data
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

  // init coords + first fetch
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

  // refresh on visibility
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
  const { critical, high, medium, low } = useMemo(() => ({
    critical: alerts.filter(a => a.priority === "CRITICAL").length,
    high:     alerts.filter(a => a.priority === "HIGH").length,
    medium:   alerts.filter(a => a.priority === "MEDIUM").length,
    low:      alerts.filter(a => a.priority === "LOW").length,
  }), [alerts]);

  // Category counts for the bottom section
  const categories = useMemo(() => {
    const counts = alerts.reduce((acc, alert) => {
      acc[alert.category] = (acc[alert.category] || 0) + 1;
      return acc;
    }, {} as Record<Category, number>);

    return [
      { key: "WEATHER", name: "Weather Alerts", desc: "Conditions affecting cycling safety", count: counts.WEATHER || 0 },
      { key: "TRAFFIC", name: "Traffic Incidents", desc: "Accidents and road closures", count: counts.TRAFFIC || 0 },
      { key: "INFRA", name: "Infrastructure", desc: "Road works and maintenance", count: counts.INFRA || 0 },
      { key: "SAFETY", name: "Safety Warnings", desc: "General safety information", count: counts.SAFETY || 0 },
    ];
  }, [alerts]);

  // Filter alerts based on notification settings
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Check if category is enabled
      const categoryEnabled = {
        WEATHER: notificationSettings.enableWeather,
        TRAFFIC: notificationSettings.enableTraffic,
        INFRA: notificationSettings.enableInfra,
        SAFETY: notificationSettings.enableSafety,
      }[alert.category];

      if (!categoryEnabled) return false;

      // Check if only critical alerts should be shown
      if (notificationSettings.criticalOnly) {
        return alert.priority === "CRITICAL" || alert.priority === "HIGH";
      }

      return true;
    });
  }, [alerts, notificationSettings]);

  const onDismiss = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));

  const handleNotificationSettingsChange = (settings: NotificationSettingsType) => {
    setNotificationSettings(settings);
  };

  return (
    <main className="alerts-page">
      {/* Header matching Figma design */}
      <section className="alerts-summary">
        <div className="summary-left">
          <img src={bellOutlineIcon} alt="" className="summary-icon" />
          <div>
            <h2>Active Alerts <span className="pill">{filteredAlerts.length}</span></h2>
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
          {filteredAlerts.map(a => (
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
          <small>We're monitoring emergency services and weather conditions. Check back later or refresh to see the latest updates.</small>
        </section>
      )}

      {/* Categories section matching Figma */}
      {alerts.length > 0 && (
        <section className="alerts-categories">
          <h3>Alert Categories</h3>
          <div className="category-list">
            {categories.filter(cat => cat.count > 0).map(cat => (
              <div key={cat.key} className="category-item">
                <span>
                  <img src={getCategoryIcon(cat.key as Category)} alt="" />
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
    </main>
  );
}

// Helper function to get category icons - you'll need to import these
function getCategoryIcon(category: Category): string {
  switch (category) {
    case "WEATHER": return "/src/assets/weather-icon.svg"; // Replace with actual path
    case "TRAFFIC": return "/src/assets/traffic-icon.svg"; // Replace with actual path  
    case "INFRA": return "/src/assets/infrastructure-icon.svg"; // Replace with actual path
    case "SAFETY": return "/src/assets/safety-icon.svg"; // Replace with actual path
    default: return "/src/assets/bell-outline.svg"; // Fallback
  }
}