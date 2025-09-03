import { useEffect, useState } from "react";
import "./LandingOverlay.css";
import landingIcon from "../assets/1D492DB6-072D-4DBB-AC96-2B28690347B7.PNG";

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
          <img
            src={landingIcon}
            alt=""
            style={{ width: 84, height: 84, objectFit: "contain", borderRadius: 12 }}
          />
        </div>

        <h1 id="landing-title" className="landing-brand">CycSafe</h1>
        <p className="landing-subtitle">VIC Cycling Safety</p>

        <p className="landing-intro">
          <strong>Safety first, safety second, coolness third.</strong><br />
          So whether you’re cycling to work everyday or just want to bike around the park on weekends,
          we’ve got you covered! Welcome to CycSafe — our solution to keep you safe, aware, and on time.
        </p>

        <ul className="landing-bullets" aria-label="Key features">
          <li>🟢 Real-time safety alerts</li>
          <li>🔵 Analytics based safe routing</li>
          <li>🟣 Melbourne Cycling Insights &amp; Awareness</li>
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
          ✓ Please click here to Proceed
        </button>
      </div>
    </div>
  );
}