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
}

/** Spec thresholds:
 * Low:    < 20
 * Medium: 20–60
 * High:   > 60
 */
const pctToText = (n: number): RiskText =>
  n > 60 ? "High Risk" : n >= 20 ? "Medium Risk" : "Low Risk";

export default function RiskHeaderCard({ title, icon, riskLevel = 0, riskText }: Props) {
  const pct = Math.round(Number.isFinite(riskLevel) ? riskLevel : 0);
  const text: RiskText = (riskText as RiskText) || pctToText(pct);

  const riskClass = text === "High Risk" ? "high" : text === "Medium Risk" ? "medium" : "low";
  const shakeClass = riskClass === "high" ? "shake-2" : riskClass === "medium" ? "shake-1" : "";

  // Vibrate once for Medium, twice for High — only when the bucket changes
  const lastBucketRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastBucketRef.current !== riskClass) {
      lastBucketRef.current = riskClass;

      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        if (riskClass === "medium") {
          // single short buzz
          navigator.vibrate?.(200);
        } else if (riskClass === "high") {
          // two short buzzes
          navigator.vibrate?.([220, 120, 220]);
        }
      }
    }
  }, [riskClass]);

  /** Remount the header when the bucket changes so the CSS animation runs once */
  const mountKey = riskClass;

  return (
    <div key={mountKey} className={`risk-header ${riskClass} ${shakeClass}`}>
      <div className="rh-left">
        {icon && <span className="rh-icon">{icon}</span>}
        <div className="rh-text">
          <h3>{title}</h3>
          <p>Current risk level</p>
        </div>
      </div>

      <div className="rh-right">
        <div className="rh-percent">{pct}%</div>
        <div className="rh-sub">{text}</div>
      </div>
    </div>
  );
}