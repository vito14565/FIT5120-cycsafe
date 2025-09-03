// src/components/Header.tsx
import "./Header.css";
import bell from "../assets/bell.svg";
import settings from "../assets/settings.svg";
import arrowLeft from "../assets/arrow-left.svg";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import AlertTray from "./AlertTray";
import brand from "../assets/CycSafe.svg";

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

  const keepIncidentOnly = (list: any[]) =>
    (Array.isArray(list) ? list : []).filter(x => x?.incidentType !== "severe_weather");

  useEffect(() => {
    try {
      const cached = localStorage.getItem("cs.address");
      if (cached) setAddress(cached);
    } catch {}

    const onAddr = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") setAddress(detail);
    };
    window.addEventListener("cs:address", onAddr);

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
      if (e.key === "cs.address" && e.newValue) setAddress(e.newValue);
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
      window.removeEventListener("cs:address", onAddr);
      window.removeEventListener("cs:alerts", onAlerts);
      window.removeEventListener("cs:alerts:list", onList);
      window.removeEventListener("cs:bell", onBell);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(tick);
    };
  }, []);

  useEffect(() => { setOpenTray(false); }, [locationPath]);

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
            setOpenTray(v => !v);
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