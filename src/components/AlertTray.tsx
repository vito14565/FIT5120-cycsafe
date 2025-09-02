// src/components/AlertTray.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import "./AlertTray.css";

import { Dialog, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export type AlertLite = {
  clusterId?: string;
  incidentType?: string;
  status?: "pending" | "active";
  reportCount?: number;
  expiresAt: number;
  severity?: "low" | "medium" | "high" | "critical";
  lat?: number;
  lng?: number;
  photoUrls?: string[];
  ackCount?: number;

  // for weather/system
  description?: string;
  ackable?: boolean;
  address?: string;  // optional, for weather line (right top)
  agoText?: string;  // optional, for weather line (right top)
  // ===== runtime computed =====
  remaining?: number;
};

interface AlertTrayProps {
  open: boolean;
  onClose: () => void;
  alerts: AlertLite[];
}

const ACK_URL =
  "https://id6qv4dal6t7zyxr6uza7v6uui0ygjcn.lambda-url.ap-southeast-2.on.aws/";
const GEOCODE_URL = import.meta.env.VITE_GEOCODE_URL as string | undefined; // optional backend proxy

export default function AlertTray({ open, onClose, alerts }: AlertTrayProps) {
  const [acked, setAcked] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("cs.acked") || "{}"); } catch { return {}; }
  });

  // cache addresses we’ve already looked up
  const [addrMap, setAddrMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("cs.addrmap") || "{}"); } catch { return {}; }
  });

  const now = Math.floor(Date.now() / 1000);
  const visible = useMemo(() => {
    const list = Array.isArray(alerts) ? alerts : [];
    return list
      .map(a => ({ ...a, remaining: Math.max(0, Number(a.expiresAt || 0) - now) }))
      .filter(a => a.remaining! > 0)
      .sort((a, b) => b.remaining! - a.remaining!);
  }, [alerts, now]);

  // Reverse-geocode any item that has lat/lng but no address yet
  useEffect(() => {
    let aborted = false;
    async function run() {
      const toLookup = visible
        .filter(a => !isWeather(a) && hasLL(a) && !addressFor(a, addrMap))
        .slice(0, 5); // small batch

      await Promise.all(
        toLookup.map(async (a) => {
          const key = keyFor(a);
          try {
            const addr = await reverseGeocode(a.lat!, a.lng!);
            if (aborted) return;
            setAddrMap(prev => {
              const next = { ...prev, [key]: addr };
              localStorage.setItem("cs.addrmap", JSON.stringify(next));
              return next;
            });
          } catch {/* ignore; we’ll keep showing a placeholder */}
        })
      );
    }
    run();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map(a => keyFor(a)).join("|")]);

  // ======================
  // Lightbox state
  // ======================
  const [lbOpen, setLbOpen] = useState(false);
  const [lbPhotos, setLbPhotos] = useState<string[]>([]);
  const [lbIndex, setLbIndex] = useState(0);

  const openLightbox = useCallback((photos: string[], i = 0) => {
    if (!photos || photos.length === 0) return;
    setLbPhotos(photos);
    setLbIndex(Math.max(0, Math.min(i, photos.length - 1)));
    setLbOpen(true);
  }, []);

  const lbPrev = useCallback(() => {
    setLbIndex(i => (lbPhotos.length ? (i - 1 + lbPhotos.length) % lbPhotos.length : 0));
  }, [lbPhotos.length]);

  const lbNext = useCallback(() => {
    setLbIndex(i => (lbPhotos.length ? (i + 1) % lbPhotos.length : 0));
  }, [lbPhotos.length]);

  // keyboard: Esc / ← / →
  useEffect(() => {
    if (!lbOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLbOpen(false);
      if (e.key === "ArrowLeft") lbPrev();
      if (e.key === "ArrowRight") lbNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lbOpen, lbPrev, lbNext]);

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

  function addressFor(a: AlertLite, cache = addrMap) {
    // NEVER show coordinates to the user; prefer server, then cache, else blank
    const server = shortenAddress(a.address || "");
    if (server) return server;
    const cached = shortenAddress(cache[keyFor(a)] || "");
    if (cached) return cached;
    return ""; // show placeholder while we fetch
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
            const hideThumb = isWeather(a);
            const prettyType = prettyIncidentType(a);
            const addr = addressFor(a);
            const locating = !addr && hasLL(a) && !isWeather(a);

            // 顯示最多 3 張縮圖
            const thumbs = (a.photoUrls || []).slice(0, 3);

            return (
              <li
                key={a.clusterId || String(a.expiresAt)}
                className={`tray-item ${sevToClass(a.severity || "medium")} ${hideThumb ? "no-thumb" : ""}`}
              >
                {!hideThumb && (
                  <div className="tray-thumb">
                    {thumbs.length > 0 ? (
                      <div className="tray-thumbs-row">
                        {thumbs.map((url, i) => (
                          <button
                            key={i}
                            className="tray-thumb-btn"
                            onClick={() => openLightbox(a.photoUrls!, i)}
                            title="Click to preview"
                            aria-label={`Open photo ${i + 1}`}
                          >
                            <img
                              src={url}
                              alt={`evidence ${i + 1}`}
                              className="tray-thumb-img"
                              loading="lazy"
                              onError={(e) => {
                                // 簽名 URL 過期 → 加上 cache-buster
                                const el = e.currentTarget as HTMLImageElement;
                                el.src = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
                              }}
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="tray-thumb-empty">No image</div>
                    )}
                  </div>
                )}

                <div className="tray-content">
                  <div className="tray-row">
                    <span className={`tray-badge ${sevToClass(a.severity || "medium")}`}>
                      {(a.severity || "medium").toString().toUpperCase()}
                    </span>
                    <span className="tray-title-2">{titleOf(a)}</span>
                  </div>

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
                    // "<Type> · <Real address>" (no raw coordinates, ever)
                    <div className="tray-desc">
                      {prettyType}
                      {addr && ` · ${addr}`}
                      {locating && " · Locating address…"}
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

      {/* ===== Lightbox Dialog ===== */}
      <Dialog
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { backgroundColor: "rgba(0,0,0,0.92)" } }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: 16,
          }}
          onClick={() => setLbOpen(false)} // 點背景關閉
        >
          {lbPhotos.length > 1 && (
            <>
              <IconButton
                onClick={(e) => { e.stopPropagation(); lbPrev(); }}
                sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "white" }}
                aria-label="Previous"
              >
                <ChevronLeftIcon fontSize="large" />
              </IconButton>
              <IconButton
                onClick={(e) => { e.stopPropagation(); lbNext(); }}
                sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "white" }}
                aria-label="Next"
              >
                <ChevronRightIcon fontSize="large" />
              </IconButton>
            </>
          )}

          <IconButton
            onClick={(e) => { e.stopPropagation(); setLbOpen(false); }}
            sx={{ position: "absolute", right: 8, top: 8, color: "white" }}
            aria-label="Close"
          >
            <CloseIcon />
          </IconButton>

          {lbPhotos.length > 0 && (
            <img
              src={lbPhotos[lbIndex]}
              alt={`photo ${lbIndex + 1}`}
              style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()} // 避免點到圖片就關閉
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                const u = lbPhotos[lbIndex];
                el.src = u + (u.includes("?") ? "&" : "?") + "t=" + Date.now();
              }}
            />
          )}
        </div>
      </Dialog>
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
  if (a.ackable === false) return false;
  if (isWeather(a)) return false;
  return true;
}

function sevToClass(sev: string) {
  const s = sev.toLowerCase();
  if (s === "critical") return "sev-critical";
  if (s === "high") return "sev-high";
  if (s === "medium") return "sev-medium";
  return "sev-low";
}

function titleOf(a: AlertLite) {
  const t = (a.incidentType || "").toLowerCase();
  if (t.includes("weather")) return "Severe Weather Warning";
  return (a.incidentType || "").replace(/_/g, " ").trim() || "Incident";
}

function prettyIncidentType(a: AlertLite) {
  const raw = (a.incidentType || "").replace(/_/g, " ").toLowerCase();
  return raw
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ")
    .trim() || "Incident";
}

function formatMMSS(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function hasLL(a: AlertLite): a is AlertLite & { lat: number; lng: number } {
  return Number.isFinite(a.lat) && Number.isFinite(a.lng);
}

function keyFor(a: AlertLite) {
  if (a.clusterId) return `id:${a.clusterId}`;
  if (hasLL(a)) return `ll:${a.lat!.toFixed(5)}:${a.lng!.toFixed(5)}`;
  return `ts:${a.expiresAt}`;
}

function shortenAddress(s: string) {
  if (!s) return "";
  // Trim long country tails and duplicate commas; keep "street, suburb, STATE PC"
  return s
    .replace(/\s*,\s*Australia$/i, "")
    .replace(/\s*,\s*Victoria$/i, " VIC")
    .replace(/\s*,\s*New South Wales$/i, " NSW")
    .replace(/\s*,\s*Queensland$/i, " QLD")
    .replace(/\s*,\s*South Australia$/i, " SA")
    .replace(/\s*,\s*Western Australia$/i, " WA")
    .replace(/\s*,\s*Tasmania$/i, " TAS")
    .replace(/\s*,\s*Northern Territory$/i, " NT")
    .replace(/\s*,\s*Australian Capital Territory$/i, " ACT")
    .replace(/\s*,\s*,+/g, ", ")
    .trim();
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Prefer your backend proxy if provided (best for CORS & rate limiting)
  if (GEOCODE_URL) {
    const r = await fetch(`${GEOCODE_URL}?lat=${lat}&lng=${lng}`);
    const j = await r.json();
    const out =
      j.address ||
      j.formatted ||
      j.display_name ||
      compactAddress(j.address || {});
    return shortenAddress(out || "");
  }

  // Fallback: OpenStreetMap Nominatim (consider proxying if you hit CORS/rate-limits)
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const r = await fetch(url, {
    headers: {
      "Accept-Language": "en-AU",
      "User-Agent": "CycSafe/1.0 (https://example.cycsafe)",
    } as any,
  });
  const j = await r.json();
  const out = compactAddress(j.address || {}) || j.display_name || "";
  return shortenAddress(out);
}

function compactAddress(adr: any): string {
  // Try to get "12 Poplar St, Box Hill VIC 3128"
  const num = adr.house_number;
  const road = adr.road || adr.pedestrian || adr.path;
  const suburb = adr.suburb || adr.neighbourhood || adr.village || adr.town || adr.city;
  const state = adr.state_code || adr.state || adr.region;
  const pc = adr.postcode;
  const line1 = [num, road].filter(Boolean).join(" ");
  const line2 = [suburb, [state, pc].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(", ");
}