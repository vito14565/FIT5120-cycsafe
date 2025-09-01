// src/components/AlertItem.tsx
import "./AlertItem.css";

import weatherIcon from "../assets/weather.svg";
import trafficIcon from "../assets/traffic.svg";
import infrastructureIcon from "../assets/infrastructure.svg";
import warningIcon from "../assets/warning.svg";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type Category = "WEATHER" | "TRAFFIC" | "INFRA" | "SAFETY";

interface AlertItemProps {
  title: string;
  description: string;
  location: string;
  time: string;            // "5 minutes ago"
  priority: Priority;      // controls color/badge
  category: Category;      // controls icon
  dismissable?: boolean;   // show ×
  onDismiss?: () => void;
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
}: AlertItemProps) {
  const p = priority.toLowerCase(); // "critical" | "high" | "medium" | "low"
  const icon = iconFor(category);

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

      <footer className="alert-footer">
        <span>{location}</span>
        <span>{time}</span>
      </footer>
    </article>
  );
}