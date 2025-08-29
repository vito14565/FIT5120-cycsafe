// src/components/RiskHeaderCard.tsx
import "./RiskHeaderCard.css";
import { useEffect, useRef, useState } from "react";
import { triggerRiskAlert } from "../lib/notify";
import type { Severity } from "../lib/notify";  // ⭐ 本地通知中心

type RiskLabel = "Low Risk" | "Medium Risk" | "High Risk";

interface RiskHeaderCardProps {
  title: string;
  icon?: React.ReactNode;
  riskLevel?: number;   // 父層傳入 → 受控模式
  riskText?: RiskLabel; // 父層傳入 → 受控模式
}

const RISK_API = import.meta.env.VITE_LAMBDA_URL as string;
const MED_T = Number(import.meta.env.VITE_MEDIUM_RISK ?? 40);
const HIGH_T = Number(import.meta.env.VITE_HIGH_RISK ?? 70);
const REFRESH_MS = Number(import.meta.env.VITE_REFRESH_MS ?? 60000);

// 安全取整數
const toInt = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : d;
};

// 推算文字
const toText = (lvl: number): RiskLabel =>
  lvl >= HIGH_T ? "High Risk" : lvl >= MED_T ? "Medium Risk" : "Low Risk";

// 推算嚴重度
const toSeverity = (lvl: number): Severity =>
  lvl >= HIGH_T ? "high" : lvl >= MED_T ? "medium" : "none";

export default function RiskHeaderCard({
  title,
  icon,
  riskLevel: riskLevelProp,
  riskText: riskTextProp,
}: RiskHeaderCardProps) {
  const [riskLevelState, setRiskLevelState] = useState<number>(0);
  const [riskTextState, setRiskTextState] = useState<RiskLabel>("Low Risk");
  const [status, setStatus] = useState<string>("Current risk level");
  const timerRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // 上一次通知過的嚴重度
  const lastSevRef = useRef<Severity>("none");

  /** 解析 Lambda 回傳 */
  const applyRisk = (data: any) => {
    const ok = typeof data?.ok === "boolean" ? data.ok : true;
    if (!ok) throw new Error(data?.error || "Lambda returned ok=false");
    const lvl = toInt(data?.risk, 0);
    const txt: RiskLabel = (data?.riskText as RiskLabel) ?? toText(lvl);

    setRiskLevelState(lvl);
    setRiskTextState(txt);
    setStatus("Current risk level");

    // 🔔 檢查是否需要通知
    const sev = toSeverity(lvl);
    const rank = (s: Severity) => (s === "none" ? 0 : s === "medium" ? 1 : 2);
    if (rank(sev) > rank(lastSevRef.current)) {
      const msg =
        sev === "high"
          ? "Risk is HIGH in your area. Ride with EXTREME caution."
          : "Risk is MEDIUM in your area. Ride with caution.";
      triggerRiskAlert(sev, msg);
      lastSevRef.current = sev;
    }
  };

  /** 抓風險 */
  const fetchRisk = async (lat: number, lon: number) => {
    try {
      const url = new URL(RISK_API);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      const res = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const text = await res.text();
      const json = (() => {
        try { return JSON.parse(text); } catch { return {}; }
      })();
      applyRisk(json);
    } catch (e) {
      console.error("Fetch risk failed:", e);
      setStatus("Load failed");
      setRiskLevelState(0);
      setRiskTextState("Low Risk");
    }
  };

  /** 非受控模式：定位 + 定時刷新 */
  useEffect(() => {
    if (typeof riskLevelProp === "number" || typeof riskTextProp === "string") {
      setStatus("Current risk level");
      return;
    }

    const isSecure =
      location.protocol === "https:" || location.hostname === "localhost";

    const start = (lat: number, lon: number) => {
      fetchRisk(lat, lon);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(
        () => fetchRisk(lat, lon),
        REFRESH_MS
      );
      if ("geolocation" in navigator) {
        if (watchIdRef.current != null)
          navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = navigator.geolocation.watchPosition(
          (p) => fetchRisk(p.coords.latitude, p.coords.longitude),
          (err) => console.warn("watchPosition error:", err),
          { maximumAge: 10000, timeout: 8000 }
        );
      }
    };

    if (isSecure && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => start(pos.coords.latitude, pos.coords.longitude),
        () => {
          setStatus("Using default location");
          start(-37.8136, 144.9631); // Melbourne CBD
        },
        { maximumAge: 10000, timeout: 8000 }
      );
    } else {
      if (!isSecure) setStatus("Use HTTPS to enable location");
      start(-37.8136, 144.9631);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (watchIdRef.current != null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [riskLevelProp, riskTextProp]);

  /** 最終呈現值 */
  const effectiveLevel =
    typeof riskLevelProp === "number" ? riskLevelProp : riskLevelState;
  const effectiveText: RiskLabel =
    riskTextProp ??
    (typeof riskLevelProp === "number"
      ? toText(riskLevelProp)
      : riskTextState);

  const riskClass =
    effectiveLevel >= HIGH_T
      ? "high"
      : effectiveLevel >= MED_T
      ? "medium"
      : "low";

  return (
    <div className={`risk-header ${riskClass}`}>
      <div className="rh-left">
        {icon && <span className="rh-icon">{icon}</span>}
        <div className="rh-text">
          <h3>{title}</h3>
          <p>
            {status}
            {effectiveLevel >= HIGH_T ? " • ⚠️ High-risk area" : ""}
          </p>
        </div>
      </div>
      <div className="rh-right">
        <div className="rh-level">{Math.round(effectiveLevel)}%</div>
        <div className="rh-tag">{effectiveText}</div>
      </div>
    </div>
  );
}