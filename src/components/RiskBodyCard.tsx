// src/components/RiskBodyCard.tsx
import { Link } from "react-router-dom";
import "./RiskBodyCard.css";

interface RiskBodyCardProps {
  actionText?: string;
  actionLink?: string;
  details?: string;
  children?: React.ReactNode;
}

export default function RiskBodyCard({
  actionText,
  actionLink,
  children,
}: RiskBodyCardProps) {
  return (
    <div className="risk-body">
      {/* Left side: static text + optional child button */}
      <div className="rb-left">
        <div className="rb-details">
          <span className="rb-dot" aria-hidden="true" />
          <span className="rb-text">multiple active alerts near you</span>
        </div>
        <div className="rb-action">{children}</div>
      </div>

      {/* Right side: View Details link */}
      <div className="rb-right">
        {actionText && actionLink && (
          <Link to={actionLink} className="rb-link">
            {actionText} →
          </Link>
        )}
      </div>
    </div>
  );
}