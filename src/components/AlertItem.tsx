// src/components/AlertItem.tsx
import "./AlertItem.css";
import { useEffect, useState, useCallback } from "react";
import { Dialog, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import weatherIcon from "../assets/weather.svg";
import trafficIcon from "../assets/traffic.svg";
import infrastructureIcon from "../assets/infrastructure.svg";
import warningIcon from "../assets/warning.svg";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Category = "WEATHER" | "TRAFFIC" | "INFRA" | "SAFETY";

/**
 * Props for an alert card in lists (≤5 km and 5–30 km groups).
 */
interface AlertItemProps {
  title: string;
  description: string;
  location: string;
  time: string;            // "5 minutes ago"
  priority: Priority;      // controls color/badge
  category: Category;      // controls icon
  dismissable?: boolean;   // show ×
  onDismiss?: () => void;

  /** Optional short‑lived signed URLs to show thumbnails and lightbox images */
  photoUrls?: string[];
}

function iconFor(category: Category) {
  switch (category) {
    case "WEATHER": return weatherIcon;
    case "TRAFFIC": return trafficIcon;
    case "INFRA":   return infrastructureIcon;
    case "SAFETY":  return warningIcon;
    default:        return warningIcon;
  }
}

export default function AlertItem({
  title,
  description,
  location,
  time,
  priority,
  category,
  dismissable,
  onDismiss,
  photoUrls = [], // default to empty array
}: AlertItemProps) {
  const p = priority.toLowerCase(); // "critical" | "high" | "medium" | "low"
  const icon = iconFor(category);

  // Lightbox state
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const hasPhotos = photoUrls.length > 0;

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  const prev = useCallback(() => {
    if (!hasPhotos) return;
    setIndex((i) => (i - 1 + photoUrls.length) % photoUrls.length);
  }, [photoUrls.length, hasPhotos]);

  const next = useCallback(() => {
    if (!hasPhotos) return;
    setIndex((i) => (i + 1) % photoUrls.length);
  }, [photoUrls.length, hasPhotos]);

  // Keyboard shortcuts (Esc / ← / →)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, prev, next]);

  return (
    <article className={`alert-item ${p}`}>
      <header className="alert-header">
        <div className="alert-left">
          <img src={icon} alt={category} className={`alert-icon ${p}`} />
          <h3>{title}</h3>
        </div>
        <div className="alert-right">
          <span className={`alert-badge ${p}`}>{priority}</span>
          {dismissable && (
            <button
              type="button"
              aria-label="Dismiss alert"
              className="alert-close"
              onClick={onDismiss}
            >
              ×
            </button>
          )}
        </div>
      </header>

      <p className="alert-description">{description}</p>

      {/* Thumbnails */}
      {hasPhotos && (
        <div className="alert-photos">
          {photoUrls.map((url, i) => (
            <button
              key={i}
              className="alert-thumb-btn"
              onClick={() => openAt(i)}
              title="Click to preview"
              aria-label={`Open photo ${i + 1}`}
            >
              <img
                src={url}
                alt={`photo ${i + 1}`}
                className="alert-thumb"
                loading="lazy"
                onError={(e) => {
                  // Signed URL expired: add cache-buster and retry
                  (e.currentTarget as HTMLImageElement).src = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
                }}
              />
            </button>
          ))}
        </div>
      )}

      <footer className="alert-footer">
        <span>{location}</span>
        <span>{time}</span>
      </footer>

      {/* Lightbox */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
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
          onClick={() => setOpen(false)} // click backdrop to close
        >
          {/* Prev/Next controls */}
          {photoUrls.length > 1 && (
            <>
              <IconButton
                onClick={(e) => { e.stopPropagation(); prev(); }}
                sx={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "white" }}
                aria-label="Previous"
              >
                <ChevronLeftIcon fontSize="large" />
              </IconButton>

              <IconButton
                onClick={(e) => { e.stopPropagation(); next(); }}
                sx={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "white" }}
                aria-label="Next"
              >
                <ChevronRightIcon fontSize="large" />
              </IconButton>
            </>
          )}

          {/* Close button */}
          <IconButton
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            sx={{ position: "absolute", right: 8, top: 8, color: "white" }}
            aria-label="Close"
          >
            <CloseIcon />
          </IconButton>

          {/* Main image */}
          {hasPhotos && (
            <img
              src={photoUrls[index]}
              alt={`photo ${index + 1}`}
              style={{ maxWidth: "92vw", maxHeight: "82vh", objectFit: "contain", borderRadius: 8 }}
              onClick={(e) => e.stopPropagation()} // avoid closing when clicking image
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src =
                  photoUrls[index] + (photoUrls[index].includes("?") ? "&" : "?") + "t=" + Date.now();
              }}
            />
          )}
        </div>
      </Dialog>
    </article>
  );
}
