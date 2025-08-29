import "./AlertItem.css";

// 匯入 icon
import weatherIcon from "../assets/weather.svg";
import trafficIcon from "../assets/traffic.svg";
import infrastructureIcon from "../assets/infrastructure.svg";
import warningIcon from "../assets/warning.svg";

interface AlertItemProps {
  title: string;
  description: string;
  location: string;
  time: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export default function AlertItem({
  title,
  description,
  location,
  time,
  priority,
}: AlertItemProps) {
  // 根據 priority 回傳不同圖標
  const getIcon = () => {
    switch (priority) {
      case "CRITICAL":
        return weatherIcon;
      case "HIGH":
        return trafficIcon;
      case "MEDIUM":
        return warningIcon;
      case "LOW":
        return infrastructureIcon;
      default:
        return warningIcon;
    }
  };

  return (
    <div className={`alert-item ${priority.toLowerCase()}`}>
      {/* Header 區塊 */}
      <div className="alert-header">
        <div className="alert-left">
          <img
            src={getIcon()}
            alt={priority}
            className={`alert-icon ${priority.toLowerCase()}`}
          />
          <h3>{title}</h3>
        </div>
        <span className={`alert-badge ${priority.toLowerCase()}`}>
          {priority}
        </span>
      </div>

      {/* 描述文字 */}
      <p className="alert-description">{description}</p>

      {/* Footer 區塊 */}
      <div className="alert-footer">
        <span>{location}</span>
        <span>{time}</span>
      </div>
    </div>
  );
}