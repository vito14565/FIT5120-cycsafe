import RiskHeaderCard from "./RiskHeaderCard";
import RiskBodyCard from "./RiskBodyCard";
import "./AlertCardWrapper.css";

interface AlertCardWrapperProps {
  title: string;
  riskLevel: number;
  riskText: "Low Risk" | "Medium Risk" | "High Risk";
  details: string;
  actionText?: string;        // optional
  actionLink?: string;        // optional
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export default function AlertCardWrapper({
  title,
  riskLevel,
  riskText,
  details,
  actionText,
  actionLink,
  icon,
  children,
}: AlertCardWrapperProps) {
  return (
    <section className="alert-card-wrapper">
      <RiskHeaderCard
        title={title}
        riskLevel={riskLevel}
        riskText={riskText}
        icon={icon}
      />
      {/* Pass optional props through; child decides whether to render */}
      <RiskBodyCard
        details={details}
        actionText={actionText}
        actionLink={actionLink}
      >
        {children}
      </RiskBodyCard>
    </section>
  );
}
