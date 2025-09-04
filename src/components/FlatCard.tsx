import { Link } from "react-router-dom";
import "./FlatCard.css";

interface FlatCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  links?: { text: string; className?: string }[];
  actionText: string;   // required (always displayed)
  actionLink: string;   // required (entire card navigates)
}

export default function FlatCard({
  icon,
  title,
  subtitle,
  links,
  actionText,
  actionLink,
}: FlatCardProps) {
  return (
    <Link to={actionLink} className="card flat"> {/* whole card is clickable */}
      {/* Left: icon + titles */}
      <div className="card-left">
        <div className="icon-wrapper">{icon}</div>
        <div>
          <h3 className="card-title">{title}</h3>
          <p className="card-subtitle">{subtitle}</p>
          {links && (
            <div className="card-links">
              {links.map((link, idx) => (
                <span key={idx} className={link.className || ""}>
                  {link.text}
                  {idx < links.length - 1 && <span className="dot"> • </span>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: action text */}
      <div className="card-action">{actionText} →</div>
    </Link>
  );
}
