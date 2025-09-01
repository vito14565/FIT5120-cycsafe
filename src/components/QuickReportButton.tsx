// src/components/QuickReportButton.tsx
import React from 'react';
import './QuickReportButton.css';

interface QuickReportButtonProps {
  onClick: () => void;
}

export default function QuickReportButton({ onClick }: QuickReportButtonProps) {
  return (
    <button 
      className="quick-report-fab"
      onClick={onClick}
      aria-label="Quick Report Incident"
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18A2 2 0 003.64 21H20.36A2 2 0 0022.18 18L13.71 3.86A2 2 0 0010.29 3.86Z" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}