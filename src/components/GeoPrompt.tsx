import { useState } from "react";
import { Dialog, DialogContent } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import "./GeoPrompt.css";

export type Coords = { lat: number; lon: number };

type Props = {
  open: boolean;
  onGotCoords: (c: Coords) => void;
  onClose: () => void;
};

type Accuracy = "precise" | "approx";

function PreciseSVG() {
  return (
    <svg viewBox="0 0 160 100" className="geo-illus">
      <rect x="0" y="0" width="160" height="100" rx="12" fill="#2b2f38" />
      <g opacity="0.35" stroke="#9aa3b2">
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1={i * 28 + 8} y1="0" x2={i * 28 + 8} y2="100" />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 24 + 14} x2="160" y2={i * 24 + 14} />
        ))}
      </g>
      <circle cx="80" cy="50" r="22" fill="#1f2937" stroke="#6ee7b7" />
      <circle cx="80" cy="50" r="6" fill="#6ee7b7" />
      <circle cx="38" cy="26" r="3" fill="#60a5fa" />
      <circle cx="120" cy="72" r="3" fill="#fbbf24" />
      <circle cx="52" cy="78" r="3" fill="#f472b6" />
    </svg>
  );
}

function ApproxSVG() {
  return (
    <svg viewBox="0 0 160 100" className="geo-illus">
      <rect x="0" y="0" width="160" height="100" rx="12" fill="#2b2f38" />
      <path d="M10 70 C50 60, 60 40, 110 45 S150 65, 150 65" stroke="#fbbf24" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M20 30 C40 25, 70 35, 95 30 S140 25, 150 30" stroke="#60a5fa" strokeWidth="2" fill="none" opacity="0.8" />
      <circle cx="55" cy="60" r="5" fill="#60a5fa" />
      <circle cx="120" cy="40" r="5" fill="#fbbf24" />
    </svg>
  );
}

export default function GeoPrompt({ open, onGotCoords, onClose }: Props) {
  const [accuracy, setAccuracy] = useState<Accuracy>("precise");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLocate = (once: boolean) => {
    if (!("geolocation" in navigator)) {
      setError("Your browser does not support geolocation.");
      return;
    }
    setBusy(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onGotCoords({ lat: latitude, lon: longitude });
        setBusy(false);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError("Permission denied. You can enable location in your browser settings.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location unavailable. Please try again later.");
        } else if (err.code === err.TIMEOUT) {
          setError("Location request timed out. Please try again.");
        } else {
          setError(err.message || "Failed to get location.");
        }
        setBusy(false);
      },
      {
        enableHighAccuracy: accuracy === "precise",
        timeout: 12000,
        maximumAge: once ? 0 : 30000,
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // 關鍵：不要用預設 maxWidth，直接自訂 Paper 大小
      fullWidth
      maxWidth={false}
      PaperProps={{
        className: "geo-dark-dialog",
        sx: {
          width: "720px",
          maxWidth: "92vw",
          borderRadius: "22px",
          background: "transparent",
          boxShadow: "none",
          overflow: "visible",
        },
      }}
      BackdropProps={{ sx: { backgroundColor: "rgba(0,0,0,.55)" } }}
    >
      <DialogContent className="geo-dark-body">
        <div className="geo-top-pin">📍</div>
        <h3 className="geo-title">Allow <span className="geo-brand">CycSafe</span> to access this device’s location?</h3>
        <p className="geo-sub">
          Share your location to quickly fill in where the incident happened and to show nearby hazards.
        </p>

        <div className="geo-choices">
          <button
            className={`geo-choice ${accuracy === "precise" ? "active" : ""}`}
            onClick={() => setAccuracy("precise")}
          >
            <PreciseSVG />
            <div className="geo-choice-text">
              <strong>Precise</strong>
              <span>Best accuracy (uses GPS if available)</span>
            </div>
          </button>

          <button
            className={`geo-choice ${accuracy === "approx" ? "active" : ""}`}
            onClick={() => setAccuracy("approx")}
          >
            <ApproxSVG />
            <div className="geo-choice-text">
              <strong>Approximate</strong>
              <span>City-block level, faster and uses less battery</span>
            </div>
          </button>
        </div>

        {error && <div className="geo-error">{error}</div>}

        <div className="geo-cta">
          <button className="geo-btn primary" onClick={() => doLocate(false)} disabled={busy}>
            <MyLocationIcon fontSize="small" />
            {busy ? "Requesting…" : "While using the app"}
          </button>
          <button className="geo-btn primary" onClick={() => doLocate(true)} disabled={busy}>
            Only this time
          </button>
          <button className="geo-btn ghost" onClick={onClose}>
            Don’t allow
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}