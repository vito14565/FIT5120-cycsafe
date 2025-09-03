// src/pages/PlanRoutePage.tsx
import { Link } from "react-router-dom";
import RouteIcon from "../assets/route.svg";

export default function PlanRoutePage() {
  const inlineCSS = `
  /* ====== Scoped styles for the Coming Soon screen ====== */
  .plan-route-page {
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
    background: linear-gradient(180deg, #eef2ff, #e0e7ff);
    border: 1px solid #c7d2fe;
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

      <main className="plan-route-page">
        <section className="coming-card" role="status" aria-live="polite">
          <div className="coming-icon-wrap">
            <img src={RouteIcon} alt="" className="coming-icon" />
          </div>

          <h2 className="coming-heading">Safe Routing</h2>
          <p className="coming-title">Feature coming soon!</p>
          <p className="coming-sub">Stay tuned for updates.</p>

          <Link to="/" className="coming-btn">Back to Home</Link>
        </section>
      </main>
    </>
  );
}

// import "./PlanRoutePage.css";
// import { useState, useEffect } from "react";

// // 匯入 SVG
// import PinIcon from "../assets/pin.svg";
// import ClockIcon from "../assets/clock.svg";
// import RouteIcon from "../assets/route.svg"; // infra 用

// // ✅ 預留資料結構 (mock data，未來可換成 API response)
// const mockRoutes = [
//   {
//     id: 1,
//     name: "Capital City Trail",
//     distance: "8.2 km",
//     time: "25 mins",
//     infra: "Dedicated bike path",
//     safety: "high",
//     risk: "low",
//     highlights: ["Separated from traffic", "Well-lit", "CCTV coverage"],
//     warnings: [],
//   },
//   {
//     id: 2,
//     name: "Swanston Street Route",
//     distance: "6.8 km",
//     time: "20 mins",
//     infra: "Bike lanes",
//     safety: "medium",
//     risk: "medium",
//     highlights: ["Protected bike lanes", "Traffic signals"],
//     warnings: ["Heavy traffic during peak hours", "Road works on Collins St"],
//   },
//   {
//     id: 3,
//     name: "St Kilda Road",
//     distance: "7.5 km",
//     time: "22 mins",
//     infra: "Shared road",
//     safety: "low",
//     risk: "high",
//     highlights: ["Direct route"],
//     warnings: [
//       "No dedicated cycling infrastructure",
//       "High traffic volume",
//       "Limited visibility at intersections",
//     ],
//   },
// ];

// // ✅ Tips 區塊也抽成陣列
// const tips = [
//   "Avoid peak traffic hours (8–10 AM, 5–7 PM) when possible",
//   "Choose routes with dedicated cycling infrastructure",
//   "Consider lighting conditions for early morning or evening rides",
//   "Check for road works and closures before departing",
// ];

// export default function PlanRoutePage() {
//   const [routes, setRoutes] = useState(mockRoutes);

//   // ✅ 預留 API 更新 (模擬 fetch)
//   useEffect(() => {
//     // TODO: 之後可換成 fetch("/api/routes") 串接後端
//     // fetch("/api/routes").then(res => res.json()).then(data => setRoutes(data));
//   }, []);

//   return (
//     <main className="plan-route-page">
//       {/* Form 區塊 */}
//       <section className="route-form card">
//         <h2 className="section-title">
//           {/* 紙飛機 Icon（已移除中間線） */}
//           <svg
//             xmlns="http://www.w3.org/2000/svg"
//             fill="none"
//             viewBox="0 0 24 24"
//             strokeWidth={1.8}
//             stroke="currentColor"
//             className="icon"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               d="M22 2L15 22L11 13L2 9L22 2Z"
//             />
//           </svg>
//           Plan Your Route
//         </h2>

//         <label>From</label>
//         <input type="text" placeholder="Enter starting location" />
//         <label>To</label>
//         <input type="text" placeholder="Enter destination" />

//         {/* Button with Icon */}
//         <button className="find-route-btn">
//           <svg
//             xmlns="http://www.w3.org/2000/svg"
//             fill="none"
//             viewBox="0 0 24 24"
//             strokeWidth={1.8}
//             stroke="currentColor"
//             className="icon"
//           >
//             <path
//               strokeLinecap="round"
//               strokeLinejoin="round"
//               d="M22 2L15 22L11 13L2 9L22 2Z"
//             />
//           </svg>
//           Find Safe Routes
//         </button>
//       </section>

//       {/* Recommended Routes */}
//       <section className="recommended-routes">
//         <h3 className="section-subtitle">Recommended Routes</h3>

//         {routes.map((route) => (
//           <div key={route.id} className="route-card card">
//             <div className="route-header">
//               {/* ✅ 標題 + 距離 & 時間 */}
//               <div className="title-meta">
//                 <h4>{route.name}</h4>
//                 <div className="meta">
//                   <span className="meta-item">
//                     <img src={PinIcon} alt="distance" className="meta-icon" />
//                     {route.distance}
//                   </span>
//                   <span className="meta-item">
//                     <img src={ClockIcon} alt="time" className="meta-icon" />
//                     {route.time}
//                   </span>
//                 </div>
//               </div>

//               {/* ✅ Badge */}
//               <div className="badges">
//                 <span className={`safety-badge ${route.safety}`}>
//                   ○ {route.safety.charAt(0).toUpperCase() + route.safety.slice(1)} Safety
//                 </span>
//                 <span className={`risk-badge ${route.risk}`}>
//                   {route.risk.charAt(0).toUpperCase() + route.risk.slice(1)} Risk
//                 </span>
//               </div>
//             </div>

//             {/* ✅ Infrastructure */}
//             <p className="infra">
//               <img src={RouteIcon} alt="infra" className="infra-icon" />
//               {route.infra}
//             </p>

//             {route.highlights.length > 0 && (
//               <div className="highlights">
//                 <strong>Highlights</strong>
//                 <ul>
//                   {route.highlights.map((h, i) => (
//                     <li key={i}>{h}</li>
//                   ))}
//                 </ul>
//               </div>
//             )}

//             {route.warnings.length > 0 && (
//               <div className="warnings">
//                 {/* ⚠ 已移掉，交給 CSS ::before 自動加 */}
//                 <strong>Warnings</strong>
//                 <ul>
//                   {route.warnings.map((w, i) => (
//                     <li key={i}>{w}</li>
//                   ))}
//                 </ul>
//               </div>
//             )}

//             <div className="card-actions">
//               <button className="primary">Select Route</button>
//               <button className="secondary">View Details</button>
//             </div>
//           </div>
//         ))}

//         {/* Tips 區塊 */}
//         <div className="tips-box">
//           <h3>Route Planning Tips</h3>
//           <ul>
//             {tips.map((tip, i) => (
//               <li key={i}>{tip}</li>
//             ))}
//           </ul>
//         </div>
//       </section>
//     </main>
//   );
// }