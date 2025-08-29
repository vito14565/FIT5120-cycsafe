import { Link } from "react-router-dom";
import "./FlatCard.css";

interface FlatCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  links?: { text: string; className?: string }[];
  actionText: string;   // ✅ 改成必填，因為一定會顯示
  actionLink: string;   // ✅ 改成必填，因為整張卡片要跳轉
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
    <Link to={actionLink} className="card flat"> {/* 整張卡片點擊 */}
      {/* 左側 Icon + 標題 */}
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

      {/* 右側 Action (文字仍然顯示) */}
      <div className="card-action">{actionText} →</div>
    </Link>
  );
}