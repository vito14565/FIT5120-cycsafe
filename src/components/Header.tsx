// src/components/Header.tsx
import "./Header.css";
import bell from "../assets/bell.svg";
import settings from "../assets/settings.svg";
import arrowLeft from "../assets/arrow-left.svg";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import AlertTray from "./AlertTray";
import brand from "../assets/CycSafe.svg";
// 👇 Namespace import so it works whether the module exports named, default, or both
import * as LB from "../services/LocationBus";

export default function Header() {
  const navigate = useNavigate();
  const locationPath = useLocation().pathname;
  const isHome = locationPath === "/";

  const [address, setAddress] = useState("");
  const [alertCount, setAlertCount] = useState(0); // incidents-only
  const [bellCount, setBellCount] = useState(0);
  const [openTray, setOpenTray] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [updatedLabel, setUpdatedLabel] = useState("Updated just now");

  // Resolve the bus from either named or default export (handles both cases)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Bus: any = (LB as any).LocationBus || (LB as any).default || LB;

  const keepIncidentOnly = (list: any[]) =>
    (Array.isArray(list) ? list : []).filter((x) => x?.incidentType !== "severe_weather");

  useEffect(() => {
    // 🔐 LocationBus is the single source of truth for address
    try {
      Bus.start();
    } catch {}
    // seed from current snapshot (if any)
    try {
      const snap = Bus.getSnapshot?.();
      if (snap?.address) setAddress(snap.address);
    } catch {}

    // live updates
    const off = Bus.subscribe?.((s: { address?: string | null }) => {
      setAddress(s?.address || "");
    });

    // ===== Alerts/bell logic (unchanged) =====
    try {
      const raw = JSON.parse(localStorage.getItem("cs.alerts.list") || "[]");
      const onlyIncidents = keepIncidentOnly(raw);
      setAlerts(onlyIncidents);
      setAlertCount(onlyIncidents.length);
    } catch {}

    try {
      const bc = parseInt(localStorage.getItem("cs.bellCount") || "0", 10);
      if (Number.isFinite(bc)) setBellCount(bc);
    } catch {}

    const onAlerts = () => {
      try {
        const raw = JSON.parse(localStorage.getItem("cs.alerts.list") || "[]");
        const onlyIncidents = keepIncidentOnly(raw);
        setAlerts(onlyIncidents);
        setAlertCount(onlyIncidents.length);
      } catch {}
      bumpUpdatedLabel();
    };
    const onList = (e: Event) => {
      const list = (e as CustomEvent<{ list?: any[] }>).detail?.list ?? [];
      const onlyIncidents = keepIncidentOnly(list);
      setAlerts(onlyIncidents);
      setAlertCount(onlyIncidents.length);
    };
    window.addEventListener("cs:alerts", onAlerts);
    window.addEventListener("cs:alerts:list", onList);

    const onBell = (e: Event) => {
      const cnt = Number((e as CustomEvent<{ count?: number }>).detail?.count ?? 0);
      if (Number.isFinite(cnt)) setBellCount(cnt);
    };
    window.addEventListener("cs:bell", onBell);

    const onStorage = (e: StorageEvent) => {
      // ❌ we no longer listen for "cs.address" here — LocationBus owns address updates
      if (e.key === "cs.alerts.list" && e.newValue) {
        try {
          const raw = JSON.parse(e.newValue) || [];
          const onlyIncidents = keepIncidentOnly(raw);
          setAlerts(onlyIncidents);
          setAlertCount(onlyIncidents.length);
        } catch {}
      }
      if (e.key === "cs.bellCount" && e.newValue) {
        const n = parseInt(e.newValue, 10);
        if (Number.isFinite(n)) setBellCount(n);
      }
      if (e.key === "cs.alerts.updatedAt") bumpUpdatedLabel();
    };
    window.addEventListener("storage", onStorage);

    bumpUpdatedLabel();
    const tick = window.setInterval(bumpUpdatedLabel, 30_000);

    return () => {
      off && off();
      window.removeEventListener("cs:alerts", onAlerts);
      window.removeEventListener("cs:alerts:list", onList);
      window.removeEventListener("cs:bell", onBell);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setOpenTray(false);
  }, [locationPath]);

  const bumpUpdatedLabel = () => {
    const t = Number(localStorage.getItem("cs.alerts.updatedAt") || 0);
    if (!t) return setUpdatedLabel("Updated just now");
    const diffSec = Math.floor((Date.now() - t) / 1000);
    if (diffSec < 60) return setUpdatedLabel("Updated just now");
    const m = Math.floor(diffSec / 60);
    setUpdatedLabel(`Updated ${m} minute${m > 1 ? "s" : ""} ago`);
  };

  const badge = Math.max(alertCount, bellCount);

  return (
    <header className="header">
      <div className="header-left">
        {!isHome && (
          <button className="back-button" onClick={() => navigate("/")}>
            <img src={arrowLeft} alt="Back" className="icon" />
          </button>
        )}

        {/* Brand logo — click to open LandingOverlay */}
        <button
          type="button"
          className="brand-btn"
          aria-label="About CycSafe"
          title="About CycSafe"
          onClick={() => window.dispatchEvent(new CustomEvent("cs:landing:open"))}
        >
          <img src={brand} alt="CycSafe" className="brand-logo" />
        </button>

        <div className="title-wrap">
          <h1 className="title">CycSafe</h1>
          <div className="subtitle-row">
            <p className="subtitle" title={address || "Locating…"}>
              {address || "Locating…"}
            </p>
            <button
              type="button"
              className="change-link"
              onClick={() => window.dispatchEvent(new CustomEvent("cs:prompt-geo"))}
              aria-label="Change location"
            >
              Change
            </button>
          </div>
        </div>
      </div>

      <div className="header-right" style={{ position: "relative" }}>
        <span className="updated">{updatedLabel}</span>

        <button
          type="button"
          className="icon-button bell-wrapper"
          aria-label="Notifications"
          onClick={() => {
            setOpenTray((v) => !v);
            window.dispatchEvent(new CustomEvent("cs:alerts:maybeChanged"));
          }}
          title="View alerts"
        >
          <img src={bell} alt="" className="icon" />
          {badge > 0 && <span className="badge">{badge}</span>}
        </button>

        <img src={settings} alt="Settings" className="icon" />
        <AlertTray open={openTray} onClose={() => setOpenTray(false)} alerts={alerts} />
      </div>
    </header>
  );
}