// src/components/Header.tsx
import "./Header.css";
import location from "../assets/location.svg";
import bell from "../assets/bell.svg";
import settings from "../assets/settings.svg";
import arrowLeft from "../assets/arrow-left.svg";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import AlertTray from "./AlertTray";

export default function Header() {
  const navigate = useNavigate();
  const locationPath = useLocation().pathname;
  const isHome = locationPath === "/";

  const [address, setAddress] = useState("");
  const [alertCount, setAlertCount] = useState(0); // incidents-only count for the bell
  const [bellCount, setBellCount] = useState(0);   // local “bell” nudges
  const [openTray, setOpenTray] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [updatedLabel, setUpdatedLabel] = useState("Updated just now");

  // keep only incident alerts for the bell (hide weather)
  const keepIncidentOnly = (list: any[]) =>
    (Array.isArray(list) ? list : []).filter(x => x?.incidentType !== "severe_weather");

  useEffect(() => {
    // 地址初始化
    try {
      const cached = localStorage.getItem("cs.address");
      if (cached) setAddress(cached);
    } catch {}

    // 地址更新事件
    const onAddr = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") setAddress(detail);
    };
    window.addEventListener("cs:address", onAddr);

    // alerts 初始化（用列表算 incidents-only 數量，不用 total）
    try {
      const raw = JSON.parse(localStorage.getItem("cs.alerts.list") || "[]");
      const onlyIncidents = keepIncidentOnly(raw);
      setAlerts(onlyIncidents);
      setAlertCount(onlyIncidents.length);
    } catch {}

    // bell 初始化
    try {
      const bc = parseInt(localStorage.getItem("cs.bellCount") || "0", 10);
      if (Number.isFinite(bc)) setBellCount(bc);
    } catch {}

    // 監聽 alerts 變化：重新從 storage 拿列表→過濾→計數
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

    // 監聽本地 bell 提醒
    const onBell = (e: Event) => {
      const cnt = Number((e as CustomEvent<{ count?: number }>).detail?.count ?? 0);
      if (Number.isFinite(cnt)) setBellCount(cnt);
    };
    window.addEventListener("cs:bell", onBell);

    // 跨分頁同步
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
      // 忽略 cs.alerts.total，因為它包含天氣
      if (e.key === "cs.bellCount" && e.newValue) {
        const n = parseInt(e.newValue, 10);
        if (Number.isFinite(n)) setBellCount(n);
      }
      if (e.key === "cs.alerts.updatedAt") bumpUpdatedLabel();
    };
    window.addEventListener("storage", onStorage);

    // 初始 updated 標籤 + 每 30s 滾動更新
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

  // 切頁時關閉托盤
  useEffect(() => { setOpenTray(false); }, [locationPath]);

  const onBellClick = () => {
    setOpenTray(v => !v);
    window.dispatchEvent(new CustomEvent("cs:alerts:maybeChanged"));
  };

  function bumpUpdatedLabel() {
    const t = Number(localStorage.getItem("cs.alerts.updatedAt") || 0);
    if (!t) return setUpdatedLabel("Updated just now");
    const diffSec = Math.floor((Date.now() - t) / 1000);
    if (diffSec < 60) return setUpdatedLabel("Updated just now");
    const m = Math.floor(diffSec / 60);
    setUpdatedLabel(`Updated ${m} minute${m > 1 ? "s" : ""} ago`);
  }

  // Header 的「Change」
  const onChangeLocation = () => {
    window.dispatchEvent(new CustomEvent("cs:prompt-geo"));
  };

  // 徽章數：取「事件（已過濾）數量」與 bell 計數的最大值
  const badge = Math.max(alertCount, bellCount);

  return (
    <header className="header">
      <div className="header-left">
        {!isHome && (
          <button className="back-button" onClick={() => navigate("/")}>
            <img src={arrowLeft} alt="Back" className="icon" />
          </button>
        )}
        <img src={location} alt="Location" className="logo" />
        <div className="title-wrap">
          <h1 className="title">CycSafe</h1>
          <div className="subtitle-row">
            <p className="subtitle" title={address || "Locating…"}>
              {address || "Locating…"}
            </p>
            <button
              type="button"
              className="change-link"
              onClick={onChangeLocation}
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
          onClick={onBellClick}
          title="View alerts"
        >
          <img src={bell} alt="" className="icon" />
          {badge > 0 && <span className="badge">{badge}</span>}
        </button>

        <img src={settings} alt="Settings" className="icon" />

        {/* 托盤靠右絕對定位 */}
        <AlertTray open={openTray} onClose={() => setOpenTray(false)} alerts={alerts} />
      </div>
    </header>
  );
}