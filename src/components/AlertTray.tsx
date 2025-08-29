import { useMemo, useState } from "react";
import "./AlertTray.css";

export type AlertLite = {
  clusterId?: string;
  incidentType?: string;
  status?: "pending" | "active";
  reportCount?: number;
  expiresAt: number;
  severity?: "low" | "medium" | "high";
  lat?: number;
  lng?: number;
  photoUrls?: string[];
  ackCount?: number;

  // for weather/system
  description?: string;
  ackable?: boolean;
  address?: string;  // optional, for weather line (right top)
  agoText?: string;  // optional, for weather line (right top)
};

interface AlertTrayProps {
  open: boolean;
  onClose: () => void;
  alerts: AlertLite[];
}

const ACK_URL = "https://id6qv4dal6t7zyxr6uza7v6uui0ygjcn.lambda-url.ap-southeast-2.on.aws/";

export default function AlertTray({ open, onClose, alerts }: AlertTrayProps) {
  const [acked, setAcked] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("cs.acked") || "{}"); } catch { return {}; }
  });

  const now = Math.floor(Date.now() / 1000);
  const visible = useMemo(() => {
    const list = Array.isArray(alerts) ? alerts : [];
    return list
      .map(a => ({ ...a, remaining: Math.max(0, Number(a.expiresAt || 0) - now) }))
      .filter(a => a.remaining > 0)
      .sort((a, b) => b.remaining - a.remaining);
  }, [alerts, now]);

  if (!open) return null;

  async function onAck(a: AlertLite) {
    if (!isAckable(a)) return;
    const id = a.clusterId || "";
    if (acked[id]) return;

    setAcked(prev => {
      const n = { ...prev, [id]: true };
      localStorage.setItem("cs.acked", JSON.stringify(n));
      return n;
    });

    try {
      await fetch(ACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterId: id }),
      });
      window.dispatchEvent(new CustomEvent("cs:alerts:maybeChanged"));
    } catch (e) {
      setAcked(prev => {
        const n = { ...prev }; delete n[id];
        localStorage.setItem("cs.acked", JSON.stringify(n));
        return n;
      });
      console.error("ack failed", e);
      alert("Failed to confirm. Please try again.");
    }
  }

  return (
    <div className="tray">
      <div className="tray-header">
        <span className="tray-title">Notifications</span>
        <button type="button" className="tray-close" onClick={onClose}>Close</button>
      </div>

      {visible.length === 0 && (
        <div className="tray-empty">
          <span className="tray-empty-icon">⚠️</span>
          <span>No active alerts</span>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="tray-list">
          {visible.map((a) => {
            const hideThumb = isWeather(a); // ⭐ 天氣一律不顯示縮圖
            return (
              <li
                key={a.clusterId || String(a.expiresAt)}
                className={`tray-item ${sevToClass(a.severity || "medium")} ${hideThumb ? "no-thumb" : ""}`}
              >
                {/* 縮圖：天氣不顯示，其它有圖才顯示 */}
                {!hideThumb && (
                  <div className="tray-thumb">
                    {a.photoUrls?.[0] ? (
                      <img src={a.photoUrls[0]} alt="evidence" />
                    ) : (
                      <div className="tray-thumb-empty">No image</div>
                    )}
                  </div>
                )}

                <div className="tray-content">
                  <div className="tray-row">
                    <span className={`tray-badge ${sevToClass(a.severity || "medium")}`}>
                      {(a.severity || "medium").toUpperCase()}
                    </span>
                    <span className="tray-title-2">{titleOf(a)}</span>
                  </div>

                  {/* 有 description（天氣/系統）就顯示；否則顯示原本狀態/數量 */}
                  {a.description ? (
                    <>
                      <div className="tray-desc">{a.description}</div>
                      {(a.address || a.agoText) && (
                        <div className="tray-desc small meta-right">
                          {a.address ? <span>{a.address}</span> : null}
                          {a.agoText ? <span>{a.agoText}</span> : null}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="tray-desc">
                      {(a.status || "active")} · reports: {a.reportCount ?? 0}
                      {typeof a.ackCount === "number" ? ` · confirmed: ${a.ackCount}` : ""}
                    </div>
                  )}

                  <div className="tray-meta">
                    <span className="tray-countdown">⏳ {formatMMSS(a.remaining as number)}</span>
                    {isAckable(a) && (
                      <button
                        type="button"
                        className="tray-cta"
                        onClick={() => onAck(a)}
                        disabled={!!acked[a.clusterId || ""]}
                        title={acked[a.clusterId || ""] ? "Already confirmed" : "I saw this too"}
                      >
                        ✔️ Confirm
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="tray-foot">Updated just now</div>
    </div>
  );
}

/* Helpers */
function isWeather(a: AlertLite) {
  const t = String(a.incidentType || "").toLowerCase();
  if (t.includes("weather")) return true;
  const id = String(a.clusterId || "");
  if (id.startsWith("weather#")) return true;
  return false;
}

function isAckable(a: AlertLite) {
  if (a.ackable === false) return false; // 明確禁止
  if (isWeather(a)) return false;        // 天氣不顯示 Confirm
  return true;
}

function sevToClass(sev: string) {
  if (sev === "high") return "sev-high";
  if (sev === "medium") return "sev-medium";
  return "sev-low";
}

function titleOf(a: AlertLite) {
  const t = (a.incidentType || "").toLowerCase();
  if (t.includes("weather")) return "Severe Weather Warning";
  return (a.incidentType || "").replace(/_/g, " ").trim() || "Incident";
}

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}