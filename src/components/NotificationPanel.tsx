// src/components/NotificationPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { reverseGeocode } from "../lib/geo";

export type IncidentNotification = {
  id: string | number;
  incident_type: string;             // from IncidentReporting table
  longitude?: number;
  latitude?: number;
  // tolerate alternate server spellings too
  lon?: number;
  lat?: number;
  Longitude?: number;
  Latitude?: number;

  // optional UI fields
  severity?: "low" | "medium" | "high";
  etaText?: string;
  title?: string;
  imageUrl?: string | null;
  [k: string]: any;
};

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  items: IncidentNotification[];                     // from localStorage cs.alerts.list (or your fetch)
  onConfirm?: (id: IncidentNotification["id"]) => void; // keep your confirm logic
}

function toTitleCase(s: string) {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export default function NotificationPanel({
  isOpen,
  onClose,
  items,
  onConfirm,
}: NotificationPanelProps) {
  const [addr, setAddr] = useState<Record<string | number, string>>({});

  // Normalize coordinate field names once
  const normalized = useMemo(() => {
    return items.map((it) => {
      const latitude =
        it.latitude ?? it.lat ?? (typeof it.Latitude === "number" ? it.Latitude : undefined);
      const longitude =
        it.longitude ?? it.lon ?? (typeof it.Longitude === "number" ? it.Longitude : undefined);
      return { ...it, latitude, longitude };
    });
  }, [items]);

  // Fetch addresses lazily
  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.allSettled(
        normalized.map(async (it) => {
          if (addr[it.id]) return;
          if (typeof it.latitude !== "number" || typeof it.longitude !== "number") return;
          const label = await reverseGeocode(it.latitude, it.longitude);
          if (alive) setAddr((m) => ({ ...m, [it.id]: label }));
        })
      );
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        zIndex: 1000,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: "min(720px, 96vw)",
          background: "#0f172a",
          color: "#e5e7eb",
          borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid rgba(148,163,184,.15)",
          }}
        >
          <h3 style={{ margin: 0 }}>Notifications</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ float: "right", color: "#93c5fd", background: "transparent", border: 0 }}
          >
            Close
          </button>
        </div>

        <div style={{ maxHeight: "min(70vh, 640px)", overflow: "auto", padding: "12px 12px 4px" }}>
          {normalized.map((it) => {
            const sev = (it.severity || "medium").toUpperCase();
            const sevBg =
              sev === "HIGH" ? "#ef4444" : sev === "MEDIUM" ? "#f59e0b" : "#22c55e";
            const title = it.title || toTitleCase(it.incident_type || "Incident");

            // ✅ Replace the old "pending · reports: X"
            const metaText = `${toTitleCase(it.incident_type)} · ${
              addr[it.id] ??
              (typeof it.latitude === "number" && typeof it.longitude === "number"
                ? "Locating..."
                : "Location unavailable")
            }`;

            return (
              <article
                key={String(it.id)}
                style={{
                  background: "#111827",
                  border: "1px solid rgba(148,163,184,.15)",
                  borderRadius: 12,
                  display: "grid",
                  gridTemplateColumns: "84px 1fr auto",
                  gap: 12,
                  padding: 12,
                  alignItems: "center",
                  margin: "10px 6px",
                }}
              >
                <div
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 10,
                    background: "#0b1220",
                    display: "grid",
                    placeItems: "center",
                    color: "#94a3b8",
                    fontSize: ".85rem",
                    border: "1px dashed rgba(148,163,184,.25)",
                    overflow: "hidden",
                  }}
                >
                  {it.imageUrl ? <img src={it.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "No image"}
                </div>

                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <span
                      style={{
                        background: sevBg,
                        color: "#0b1220",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {sev}
                    </span>
                    <h4 style={{ margin: 0, fontWeight: 600, color: "#d1d5db" }}>{title}</h4>
                  </div>

                  <div style={{ color: "#cbd5e1", opacity: 0.9, fontSize: ".92rem" }}>{metaText}</div>

                  {it.etaText ? (
                    <div style={{ color: "#94a3b8", fontSize: ".85rem", marginTop: 6 }}>
                      <span role="img" aria-label="hourglass">
                        ⏳
                      </span>{" "}
                      {it.etaText}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "grid" }}>
                  <button
                    onClick={() => onConfirm?.(it.id)}
                    style={{
                      background: "#0ea5e9",
                      color: "#fff",
                      border: 0,
                      borderRadius: 10,
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    ✓ Confirm
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div
          style={{
            padding: "16px 18px",
            borderTop: "1px solid rgba(148,163,184,.15)",
          }}
        >
          <small>Updated just now</small>
        </div>
      </div>
    </div>
  );
}