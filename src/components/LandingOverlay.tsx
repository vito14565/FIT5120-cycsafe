import { useEffect, useState } from "react";
import "./LandingOverlay.css";

type Props = {
  /** If true, force-show even if previously accepted. */
  open?: boolean;
  /** Called after fade-out completes (e.g., when user accepts). */
  onClose?: () => void;
};

const STORAGE_KEY = "cs.onboarded.v1"; // bump version to re-show for all users

export default function LandingOverlay({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Show automatically on first load (if not accepted)
  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) setVisible(true);
  }, []);

  // Allow external force-open (top-left icon)
  useEffect(() => {
    if (open) {
      setClosing(false);
      setVisible(true);
    }
  }, [open]);

  function accept() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ acceptedAt: Date.now(), version: 1 })
      );
    } catch {}
    setClosing(true);
    window.setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, 320); // keep in sync with CSS fade
  }

  if (!visible) return null;

  return (
    <div
      className={`landing-overlay ${closing ? "fade-out" : "fade-in"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="landing-title"
    >
      <div className="landing-content">
        <div className="landing-icon" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path d="M3 11l18-8-8 18-2-7-8-3z" stroke="white" strokeWidth="1.6" />
          </svg>
        </div>

        <h1 id="landing-title" className="landing-brand">CycSafe</h1>
        <p className="landing-subtitle">Melbourne Cycling Safety</p>

        <ul className="landing-bullets" aria-label="Key features">
          <li>🟢 Real-time safety alerts</li>
          <li>🔵 AI-powered safe routing</li>
          <li>🟣 Melbourne cycling insights</li>
        </ul>

        <div className="landing-disclaimer">
          By continuing, you agree to our{" "}
          <a href="/terms" target="_blank" rel="noopener">Terms of Service</a> and{" "}
          <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>. This app
          processes location data locally for safety features only.
          <div className="landing-small">
            CycSafe uses publicly available government data. For emergencies, always call 000.
          </div>
        </div>

        <button className="landing-cta" onClick={accept} autoFocus>
          ✓ Accept Terms &amp; Continue
        </button>
      </div>
    </div>
  );
}