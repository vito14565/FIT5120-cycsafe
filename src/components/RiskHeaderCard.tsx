// src/components/RiskHeaderCard.tsx
import { useEffect, useRef } from "react";
import "./RiskHeaderCard.css";

type RiskText = "Low Risk" | "Medium Risk" | "High Risk";

interface Props {
  title: string;
  icon?: React.ReactNode;
  /** Percent 0–100 from backend */
  riskLevel?: number;
  /** Optional text from backend; fallback computed from percent */
  riskText?: RiskText;
  /** Show skeleton instead of 0% while first fetch is in-flight */
  loading?: boolean;
}

/** Spec thresholds:
 * Low:    < 20
 * Medium: 20–60
 * High:   > 60
 */
const pctToText = (n: number): RiskText =>
  n > 60 ? "High Risk" : n >= 20 ? "Medium Risk" : "Low Risk";

export default function RiskHeaderCard({
  title,
  icon,
  riskLevel = 0,
  riskText,
  loading = false,
}: Props) {
  const pct = Math.round(Number.isFinite(riskLevel) ? riskLevel : 0);
  const text: RiskText = (riskText as RiskText) || pctToText(pct);

  const riskClass = loading
    ? "loading"
    : text === "High Risk"
      ? "high"
      : text === "Medium Risk"
        ? "medium"
        : "low";

  const shakeClass =
    !loading && riskClass === "high" ? "shake-2" : !loading && riskClass === "medium" ? "shake-1" : "";

  // Vibrate once for Medium, twice for High — only when the bucket changes, and not while loading
  const lastBucketRef = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    if (lastBucketRef.current !== riskClass) {
      lastBucketRef.current = riskClass;

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        if (riskClass === "medium") {
          navigator.vibrate?.(200);
        } else if (riskClass === "high") {
          navigator.vibrate?.([220, 120, 220]);
        }
      }
    }
  }, [riskClass, loading]);

  /** Remount the header when the bucket changes so the CSS animation runs once */
  const mountKey = loading ? "loading" : riskClass;

  return (
    <div
      key={mountKey}
      className={`risk-header ${riskClass} ${shakeClass}`}
      aria-busy={loading || undefined}
      data-state={loading ? "loading" : riskClass}
    >
      <div className="rh-left">
        {icon && <span className="rh-icon">{icon}</span>}
        <div className="rh-text">
          <h3>{title}</h3>
          <p>Current risk level</p>
        </div>
      </div>

      <div className="rh-right">
        {loading ? (
          <>
            <span className="sr-only">Calculating risk…</span>
            <div className="skel skel-pct" aria-hidden="true" />
            <div className="skel skel-sub" aria-hidden="true" />
          </>
        ) : (
          <>
            <div className="rh-percent" aria-live="polite">{pct}%</div>
            <div className="rh-sub">{text}</div>
          </>
        )}
      </div>
    </div>
  );
}