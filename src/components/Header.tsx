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
  const [alertCount, setAlertCount] = useState(0); // 由 alertsService 寫入/廣播
  const [bellCount, setBellCount] = useState(0);   // 由 notify.ts 本地提升

  // 托盤狀態
  const [openTray, setOpenTray] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  // 「Updated … ago」
  const [updatedLabel, setUpdatedLabel] = useState("Updated just now");

  useEffect(() => {
    // 地址初始化
    try {
      const cached = localStorage.getItem("cs.address");
      if (cached) setAddress(cached);
    } catch {}

    // 地址更新事件
    const onAddr = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | undefined;
      if (detail) setAddress(detail);
    };
    window.addEventListener("cs:address", onAddr);

    // alerts 初始化（數量 + 清單）
    try {
      const n = parseInt(localStorage.getItem("cs.alerts.total") || "0", 10);
      setAlertCount(Number.isFinite(n) ? n : 0);
      const json = JSON.parse(localStorage.getItem("cs.alerts.list") || "[]");
      setAlerts(Array.isArray(json) ? json : []);
    } catch {}

    // bell 初始化
    try {
      const bc = parseInt(localStorage.getItem("cs.bellCount") || "0", 10);
      if (Number.isFinite(bc)) setBellCount(bc);
    } catch {}

    // 監聽 alerts 數量/清單
    const onAlerts = (e: Event) => {
      const total = Number((e as CustomEvent).detail?.total ?? 0);
      setAlertCount(Number.isFinite(total) ? total : 0);
      bumpUpdatedLabel();
    };
    const onList = (e: Event) => {
      const list = (e as CustomEvent).detail?.list ?? [];
      if (Array.isArray(list)) setAlerts(list);
    };
    window.addEventListener("cs:alerts", onAlerts);
    window.addEventListener("cs:alerts:list", onList);

    // 監聽本地 bell 提醒
    const onBell = (e: Event) => {
      const cnt = Number((e as CustomEvent).detail?.count ?? 0);
      if (Number.isFinite(cnt)) setBellCount(cnt);
    };
    window.addEventListener("cs:bell", onBell);

    // 跨分頁同步
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cs.address" && e.newValue) setAddress(e.newValue);
      if (e.key === "cs.alerts.list" && e.newValue) {
        try { setAlerts(JSON.parse(e.newValue) || []); } catch {}
      }
      if (e.key === "cs.alerts.total" && e.newValue) {
        const n = parseInt(e.newValue, 10);
        if (Number.isFinite(n)) setAlertCount(n);
      }
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

  // Header 的「Change」→ 交給 Home.tsx 打開 GeoPrompt
  const onChangeLocation = () => {
    window.dispatchEvent(new CustomEvent("cs:prompt-geo"));
  };

  // 徽章數：取 alerts 總數與 bell 計數的最大值
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