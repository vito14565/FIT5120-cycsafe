// src/components/RiskHeaderCard.tsx
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

const pctToText = (n: number): RiskText =>
  n >= 70 ? "High Risk" : n >= 40 ? "Medium Risk" : "Low Risk";

export default function RiskHeaderCard({ title, icon, riskLevel = 0, riskText }: Props) {
  const pct = Math.round(Number.isFinite(riskLevel) ? riskLevel : 0);
  const text: RiskText = (riskText as RiskText) || pctToText(pct);

  const riskClass =
    text === "High Risk" ? "high" : text === "Medium Risk" ? "medium" : "low";

  return (
    <div className={`risk-header ${riskClass}`}>
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