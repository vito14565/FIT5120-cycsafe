// src/pages/DataInsights.tsx
import { Link } from "react-router-dom";
import InsightIcon from "../assets/insight.svg";

export default function DataInsights() {
  const inlineCSS = `
  /* ====== Scoped styles for the Coming Soon screen ====== */
  .data-insights-page {
    min-height: calc(100svh - 80px);
    display: grid;
    place-items: center;
    padding: 24px 16px;
    box-sizing: border-box;
    background: #f8fafc;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
  }

  .coming-card {
    width: min(560px, 100%);
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 24px 20px;
    text-align: center;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.06);
  }

  .coming-icon-wrap {
    width: 70px;
    height: 70px;
    margin: 0 auto 12px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    background: linear-gradient(180deg, #f5f3ff, #ede9fe); /* soft purple for Insights */
    border: 1px solid #ddd6fe;
  }
  .coming-icon { width: 34px; height: 34px; object-fit: contain; }

  .coming-heading {
    margin: 8px 0 4px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: .2px;
    color: #111827;
  }

  .coming-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: #334155;
  }

  .coming-sub {
    margin: 6px 0 16px;
    font-size: 14.5px;
    color: #64748b;
  }

  .coming-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    background: #111827;
    color: #ffffff;
    font-weight: 700;
    text-decoration: none;
    border: 1px solid rgba(0,0,0,0.08);
    box-shadow: 0 8px 20px rgba(2, 6, 23, 0.15);
    transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
  }
  .coming-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(2, 6, 23, 0.18); }
  .coming-btn:active { transform: translateY(0); }

  @media (max-width: 420px) {
    .coming-card { padding: 20px 16px; }
    .coming-heading { font-size: 20px; }
    .coming-title { font-size: 16px; }
  }
  `;

  return (
    <>
      <style>{inlineCSS}</style>

      <main className="data-insights-page">
        <section className="coming-card" role="status" aria-live="polite">
          <div className="coming-icon-wrap">
            <img src={InsightIcon} alt="" className="coming-icon" />
          </div>

          <h2 className="coming-heading">Data Insights</h2>
          <p className="coming-title">Feature coming soon!</p>
          <p className="coming-sub">Stay tuned for updates.</p>

          <Link to="/" className="coming-btn">Back to Home</Link>
        </section>
      </main>
    </>
  );
}
// import { useEffect, useState } from "react";
// import "./DataInsights.css";

// // 匯入 trend icons
// import trendUp from "../assets/trend-up-svgrepo-com.svg";
// import trendDown from "../assets/trend-down-svgrepo-com.svg";
// import trendFlat from "../assets/trending-flat-svgrepo-com.svg";

// // 匯入 section icons
// import clockIcon from "../assets/clock.svg";             // Risk by Time
// import pinIcon from "../assets/pin.svg";                // High-Risk Areas
// import usersIcon from "../assets/users.svg";            // Behavioral Patterns
// import seasonIcon from "../assets/season.svg";          // Seasonal Risk Patterns
// import takeawayIcon from "../assets/trend-svgrepo-com.svg"; // Key Takeaways

// interface RiskByTime {
//   time: string;
//   level: string;
//   incidents: number;
// }

// interface HighRiskArea {
//   area: string;
//   incidents: number;
//   infrastructure: string;
//   trend: "up" | "down" | "flat";
// }

// interface Stats {
//   incidentsAgeGroup: number;
//   holidayRisk: number;
//   bikePathReduction: number;
//   overconfidenceFactor: number;
//   riskByTime: RiskByTime[];
//   highRiskAreas: HighRiskArea[];
// }

// export default function DataInsights() {
//   const [stats, setStats] = useState<Stats | null>(null);

//   useEffect(() => {
//     // 模擬假資料
//     setStats({
//       incidentsAgeGroup: 23,
//       holidayRisk: 40,
//       bikePathReduction: 75,
//       overconfidenceFactor: 35,
//       riskByTime: [
//         { time: "6–8 AM", level: "Low", incidents: 12 },
//         { time: "8–10 AM", level: "High", incidents: 45 },
//         { time: "10 AM–3 PM", level: "Low", incidents: 8 },
//         { time: "3–6 PM", level: "Medium", incidents: 32 },
//         { time: "6–8 PM", level: "High", incidents: 38 },
//         { time: "8 PM+", level: "Medium", incidents: 18 },
//       ],
//       highRiskAreas: [
//         { area: "Melbourne CBD", incidents: 156, infrastructure: "Mixed", trend: "up" },
//         { area: "St Kilda Road", incidents: 89, infrastructure: "Poor", trend: "up" },
//         { area: "Capital City Trail", incidents: 23, infrastructure: "Excellent", trend: "down" },
//         { area: "Swanston Street", incidents: 67, infrastructure: "Good", trend: "flat" },
//         { area: "Collins Street", incidents: 45, infrastructure: "Fair", trend: "flat" },
//       ],
//     });
//   }, []);

//   if (!stats) return <p>Loading insights...</p>;

//   const getTrendIcon = (trend: "up" | "down" | "flat") => {
//     if (trend === "up") return trendUp;
//     if (trend === "down") return trendDown;
//     return trendFlat;
//   };

//   // ✅ inline shield SVG
//   const ShieldIcon = () => (
//     <svg
//       className="action-icon"
//       xmlns="http://www.w3.org/2000/svg"
//       viewBox="0 0 24 24"
//       fill="none"
//       stroke="currentColor"
//     >
//       <path
//         strokeLinecap="round"
//         strokeLinejoin="round"
//         strokeWidth="2"
//         d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4z"
//       />
//     </svg>
//   );

//   return (
//     <main className="insights-page">
//       <h2>Cycling Safety Insights</h2>
//       <p>Data-driven insights for Melbourne cyclists aged 30–39</p>

//       {/* ===== Top Stats ===== */}
//       <section className="stats-grid">
//         <div className="stat-card red">
//           <h3>{stats.incidentsAgeGroup}%</h3>
//           <p>of cycling incidents</p>
//           <small>30–39 age group</small>
//         </div>
//         <div className="stat-card orange">
//           <h3>{stats.holidayRisk}%</h3>
//           <p>higher risk</p>
//           <small>during holidays</small>
//         </div>
//         <div className="stat-card green">
//           <h3>{stats.bikePathReduction}%</h3>
//           <p>risk reduction</p>
//           <small>with bike paths</small>
//         </div>
//         <div className="stat-card purple">
//           <h3>{stats.overconfidenceFactor}%</h3>
//           <p>overconfidence</p>
//           <small>risk factor</small>
//         </div>
//       </section>

//       {/* ===== Risk by Time ===== */}
//       <section className="insight-section risk-time">
//         <h3>
//           <img src={clockIcon} alt="clock" className="section-icon" />
//           Risk by Time of Day
//         </h3>
//         <ul>
//           {stats.riskByTime.map((r, i) => (
//             <li key={i}>
//               <span className="time-label">{r.time}</span>
//               <span className={`badge ${r.level.toLowerCase()}`}>{r.level}</span>
//               <span className="incidents">{r.incidents} incidents/month</span>
//             </li>
//           ))}
//         </ul>
//       </section>

//       {/* ===== High-Risk Areas ===== */}
//       <section className="insight-section high-risk">
//         <h3>
//           <img src={pinIcon} alt="pin" className="section-icon" />
//           High-Risk Areas
//         </h3>
//         <ul>
//           {stats.highRiskAreas.map((area, i) => (
//             <li key={i}>
//               <span className="area-label">
//                 {area.area}
//                 <img src={getTrendIcon(area.trend)} alt={area.trend} className="trend-icon" />
//               </span>
//               <span className={`infra-badge ${area.infrastructure.toLowerCase()}`}>
//                 {area.infrastructure} infrastructure
//               </span>
//               <span className="incidents">{area.incidents} incidents/year</span>
//             </li>
//           ))}
//         </ul>
//       </section>

//       {/* ===== Behavioral Patterns ===== */}
//       <section className="insight-section behavioral">
//         <h3>
//           <img src={usersIcon} alt="users" className="section-icon" />
//           Behavioral Patterns
//         </h3>
//         <ul>
//           <li>
//             <div className="behavior-text">
//               <strong>Overconfidence Factor</strong>
//               <p>Experienced cyclists (30–39) are 35% more likely to underestimate risks</p>
//               <div className="pattern-action">
//                 <ShieldIcon />
//                 <a href="#">Regular safety awareness updates</a>
//               </div>
//             </div>
//             <span className="impact high">High Impact</span>
//           </li>
//           <li>
//             <div className="behavior-text">
//               <strong>Holiday Period Vulnerability</strong>
//               <p>Incident rates increase 65% during public holidays and long weekends</p>
//               <div className="pattern-action">
//                 <ShieldIcon />
//                 <a href="#">Enhanced alerts during holiday periods</a>
//               </div>
//             </div>
//             <span className="impact critical">Critical Impact</span>
//           </li>
//           <li>
//             <div className="behavior-text">
//               <strong>Infrastructure Dependency</strong>
//               <p>Routes with dedicated bike paths show 75% fewer incidents</p>
//               <div className="pattern-action">
//                 <ShieldIcon />
//                 <a href="#">Prioritize dedicated cycling infrastructure</a>
//               </div>
//             </div>
//             <span className="impact high">High Impact</span>
//           </li>
//         </ul>
//       </section>

//       {/* ===== Seasonal Risk Patterns ===== */}
//       <section className="insight-section">
//         <h3>
//           <img src={seasonIcon} alt="season" className="section-icon" />
//           Seasonal Risk Patterns
//         </h3>
//         <div className="season-grid horizontal">
//           <div className="season winter">
//             <strong>Winter (Jun–Aug)</strong>
//             <p className="highlight">Lower cycling volume, higher per-trip risk</p>
//             <small>Visibility and weather factors</small>
//           </div>
//           <div className="season spring">
//             <strong>Spring (Sep–Nov)</strong>
//             <p className="highlight">Optimal conditions, lowest risk</p>
//             <small>Good weather, moderate traffic</small>
//           </div>
//           <div className="season summer">
//             <strong>Summer (Dec–Feb)</strong>
//             <p className="highlight">High volume, holiday risks</p>
//             <small>Peak recreational cycling</small>
//           </div>
//           <div className="season autumn">
//             <strong>Autumn (Mar–May)</strong>
//             <p className="highlight">Variable conditions, medium risk</p>
//             <small>Weather transitions</small>
//           </div>
//         </div>
//       </section>

//       {/* ===== Key Takeaways ===== */}
//       <section className="insight-section takeaway">
//         <h3>
//           <img src={takeawayIcon} alt="takeaway" className="section-icon" />
//           Key Takeaways (30–39 Age Group)
//         </h3>
//         <ul>
//           <li>Experience ≠ immunity — stay alert even on familiar routes</li>
//           <li>Holiday periods = highest risks due to recreational cycling</li>
//           <li>Dedicated infrastructure gives maximum safety benefit</li>
//           <li>Peak hours (8–10 AM, 5–7 PM) = highest incident rates</li>
//         </ul>
//       </section>
//     </main>
//   );
// }