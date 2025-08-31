// src/pages/AlertsPage.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./AlertsPage.css";
import AlertItem from "../components/AlertItem";

import weatherIcon from "../assets/weather.svg";
import trafficIcon from "../assets/traffic.svg";
import infrastructureIcon from "../assets/infrastructure.svg";
import warningIcon from "../assets/warning.svg";
import bellOutlineIcon from "../assets/bell-outline.svg";
import { timeFromNow } from "../lib/time";

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
type Category = "WEATHER" | "TRAFFIC" | "INFRA" | "SAFETY";

type AlertModel = {
  title: string;
  description: string;
  location: string;
  time?: string;
  timestamp?: number | string;
  priority: Priority;
  category: Category;
};

type RiskResp = {
  ok: boolean;
  address?: string;
  lat?: number;
  lon?: number;
  weather?: {
    windSpeed?: number;      // m/s
    precipitation?: number;  // mm/h
    temperature?: number;    // °C
  };
  atmosphere?: string;
};

const API =
  import.meta.env.VITE_LAMBDA_URL ??
  "https://dbetjhlyj7smwrgcptcozm6amq0ovept.lambda-url.ap-southeast-2.on.aws/";

const FALLBACK = { lat: -37.8136, lon: 144.9631 }; // Melbourne CBD
const ADDRESS_KEY = "cs.address";
const COORDS_KEY  = "cs.coords";

// Open-Meteo：風速 m/s；1 m/s ≈ 3.6 km/h
const WIND_MED  = 11;   // ≈ 40 km/h
const WIND_HIGH = 17;   // ≈ 61 km/h
const RAIN_MED  = 1.0;  // mm/h
const RAIN_HIGH = 3.0;  // mm/h

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertModel[]>([]);
  const [address, setAddress] = useState<string>("");
  const [, setTick] = useState(0); // 每分鐘觸發重算相對時間

  // 最新座標記在 ref，供輪詢 & 事件回呼使用
  const coordsRef = useRef<{ lat: number; lon: number }>(FALLBACK);

  // 只保留一個在途請求；每次新發請求會中止舊請求（避免重入/重複）
  const controllerRef = useRef<AbortController | null>(null);

  /** 安全清洗：過濾 undefined/空事件、缺少必要欄位的事件 */
  const sanitizeIncidents = (list: AlertModel[]) => {
    return (list || [])
      .filter(Boolean)
      .filter(x => x.title || x.description)
      .filter(x => x.timestamp != null);
  };

  /** 根據風/雨組裝一張 Weather Alert（不到門檻回 null） */
  const buildWeatherAlert = (data: RiskResp): AlertModel | null => {
    const ws   = Number(data.weather?.windSpeed ?? 0);       // m/s
    const rain = Number(data.weather?.precipitation ?? 0);   // mm/h
    const addr =
      data.address ||
      localStorage.getItem(ADDRESS_KEY) ||
      [data.lat, data.lon].filter(Boolean).join(", ");

    if (ws >= WIND_HIGH || rain >= RAIN_HIGH) {
      return {
        title: "Severe Weather Warning",
        description: `Strong winds (~${Math.round(ws)} m/s) or heavy rain (${rain.toFixed(1)} mm/h). Reduced visibility and hazardous conditions.`,
        location: addr || "Your area",
        timestamp: Date.now(),
        priority: "HIGH",
        category: "WEATHER",
      };
    }
    if (ws >= WIND_MED || rain >= RAIN_MED) {
      return {
        title: "Weather Alert",
        description: `Wind ~ ${Math.round(ws)} m/s • Rain ${rain.toFixed(1)} mm/h • Please ride with caution.`,
        location: addr || "Your area",
        timestamp: Date.now(),
        priority: "MEDIUM",
        category: "WEATHER",
      };
    }
    return null;
  };

  /** 實際抓取 alerts（忽略被中止的請求錯誤） */
  const fetchAlerts = useCallback(async (lat: number, lon: number, signal?: AbortSignal) => {
    try {
      const url = new URL(API);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("ts", String(Date.now())); // cache-bust

      const res = await fetch(url.toString(), { cache: "no-store", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RiskResp = await res.json();

      const addr = data.address || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setAddress(addr);
      try {
        localStorage.setItem(ADDRESS_KEY, addr);
        window.dispatchEvent(new CustomEvent("cs:address", { detail: addr }));
      } catch {}

      const next: AlertModel[] = [];
      const weatherAlert = data.ok ? buildWeatherAlert(data) : null;
      if (weatherAlert) next.push(weatherAlert);

      const cleaned = sanitizeIncidents(next);
      setAlerts(cleaned);

      // 廣播總數 & 清單（給首頁/鈴鐺同步）
      try {
        const total = cleaned.length;
        localStorage.setItem("cs.alerts.total", String(total));
        window.dispatchEvent(new CustomEvent("cs:alerts", { detail: { total } }));

        localStorage.setItem("cs.alerts.list", JSON.stringify(cleaned));
        window.dispatchEvent(new CustomEvent("cs:alerts:list", { detail: { list: cleaned } }));
      } catch {}
    } catch (e: unknown) {
      // ✅ 在 React 18 + StrictMode 下，第一次 effect 會被立刻清理並中止請求
      // 這裡對 AbortError 靜默處理，避免誤報錯
      const isAbort =
        (e instanceof DOMException && e.name === "AbortError") ||
        // 某些環境下可能不是 DOMException，但 signal 已被中止
        (signal && (signal as AbortSignal).aborted);

      if (isAbort) return;

      console.error("fetch alerts failed:", e);
      setAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`);
      setAlerts([]);
    }
  }, []); // 依賴空陣列：API/常量不變

  /** 封裝：開始新請求並中止舊請求（避免重入導致競態/誤報錯） */
  const startFetch = useCallback((lat: number, lon: number) => {
    // 中止上一個在途請求（會觸發 AbortError，但我們在 fetchAlerts 內會忽略）
    controllerRef.current?.abort();

    const ac = new AbortController();
    controllerRef.current = ac;
    fetchAlerts(lat, lon, ac.signal);
  }, [fetchAlerts]);

  /** 初始化：讀取現有座標（Home 已經會存），沒有就用 FALLBACK；立刻抓一次 */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COORDS_KEY);
      if (saved) {
        const { lat, lon } = JSON.parse(saved);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          coordsRef.current = { lat, lon };
        }
      }
    } catch {}
    startFetch(coordsRef.current.lat, coordsRef.current.lon);

    return () => {
      // 元件卸載時中止在途請求，避免發生 setState on unmounted
      controllerRef.current?.abort();
    };
  }, [startFetch]);

  /** 跟上首頁座標變化（Home 會 dispatch `cs:coords`） */
  useEffect(() => {
    const onCoords = (e: Event) => {
      const d = (e as CustomEvent).detail as { lat?: number; lon?: number } | undefined;
      if (d?.lat != null && d?.lon != null) {
        coordsRef.current = { lat: d.lat, lon: d.lon };
        startFetch(d.lat, d.lon);
      }
    };
    window.addEventListener("cs:coords", onCoords);
    return () => window.removeEventListener("cs:coords", onCoords);
  }, [startFetch]);

  /** 前景輪詢：可見時每 60s 刷新；切回分頁或 focus 立即刷新 */
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      startFetch(coordsRef.current.lat, coordsRef.current.lon);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    const onFocus = () => poll();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);

    const intervalId = window.setInterval(poll, 60 * 1000);

    // 讓相對時間每分鐘自動重算（即使沒有新資料）
    const tickId = window.setInterval(() => setTick(v => v + 1), 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(intervalId);
      window.clearInterval(tickId);
    };
  }, [startFetch]);

  // Summary 計數
  const { critical, high, medium, low } = useMemo(() => {
    return {
      critical: alerts.filter((a) => a.priority === "CRITICAL").length,
      high:     alerts.filter((a) => a.priority === "HIGH").length,
      medium:   alerts.filter((a) => a.priority === "MEDIUM").length,
      low:      alerts.filter((a) => a.priority === "LOW").length,
    };
  }, [alerts]);

  // Category 計數
  const categoryCounts = useMemo(() => {
    return {
      WEATHER: alerts.filter((a) => a.category === "WEATHER").length,
      TRAFFIC: alerts.filter((a) => a.category === "TRAFFIC").length,
      INFRA:   alerts.filter((a) => a.category === "INFRA").length,
      SAFETY:  alerts.filter((a) => a.category === "SAFETY").length,
    };
  }, [alerts]);

  return (
    <main className="alerts-page">
      <section className="alerts-summary">
        <div className="summary-left">
          <img src={bellOutlineIcon} alt="Alerts" className="summary-icon" />
          <h2>Active Alerts ({alerts.length})</h2>
        </div>
        <div className="priority-stats">
          <div className="priority-item critical"><span>{critical}</span>Critical Priority</div>
          <div className="priority-item high"><span>{high}</span>High Priority</div>
          <div className="priority-item medium"><span>{medium}</span>Medium Priority</div>
          <div className="priority-item low"><span>{low}</span>Low Priority</div>
        </div>
      </section>

      {alerts.length > 0 && (
        <section className="alerts-list">
          {alerts.map((alert, idx) => (
            <AlertItem
              key={idx}
              {...alert}
              time={timeFromNow(alert.timestamp ?? Date.now())} // 動態時間
            />
          ))}
        </section>
      )}

      <section className="alerts-categories">
        <h3>Alert Categories</h3>
        <div className="category-list">
          <div className="category-item">
            <span><img src={weatherIcon} alt="Weather" />Weather Alerts</span>
            <small>Conditions affecting cycling safety</small>
            <em className="cat-count">{categoryCounts.WEATHER}</em>
          </div>
          <div className="category-item">
            <span><img src={trafficIcon} alt="Traffic" />Traffic Incidents</span>
            <small>Accidents and road closures</small>
            <em className="cat-count">{categoryCounts.TRAFFIC}</em>
          </div>
          <div className="category-item">
            <span><img src={infrastructureIcon} alt="Infrastructure" />Infrastructure</span>
            <small>Road works and maintenance</small>
            <em className="cat-count">{categoryCounts.INFRA}</em>
          </div>
          <div className="category-item">
            <span><img src={warningIcon} alt="Warning" />Safety Warnings</span>
            <small>General safety information</small>
            <em className="cat-count">{categoryCounts.SAFETY}</em>
          </div>
        </div>
      </section>
    </main>
  );
}