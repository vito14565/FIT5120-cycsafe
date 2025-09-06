import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import LandingOverlay from "./components/LandingOverlay";
import Home from "./pages/Home";
import AlertsPage from "./pages/AlertsPage";
import ReportIncident from "./pages/ReportIncident";
import PlanRoutePage from "./pages/PlanRoutePage";
import DataInsights from "./pages/DataInsights";
import { startAlertsPolling, stopAlertsPolling } from "./services/alertsService";
import AuthGate from "./components/AuthGate";

export default function App() {
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    startAlertsPolling();
    return () => stopAlertsPolling();
  }, []);

  useEffect(() => {
    const onOpen = () => setShowLanding(true);
    window.addEventListener("cs:landing:open", onOpen);
    return () => window.removeEventListener("cs:landing:open", onOpen);
  }, []);

  return (
    <AuthGate>
      {/* Key: Mount the entire app under /iteration1 */}
      <Router basename="/iteration1">
        <Header />
        <LandingOverlay open={showLanding} onClose={() => setShowLanding(false)} />
        <Routes>
          {/* Make /iteration1/ automatically redirect to /iteration1/homepage */}
          <Route path="/" element={<Navigate to="/homepage" replace />} />

          <Route path="/homepage" element={<Home />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/report" element={<ReportIncident />} />
          <Route path="/plan-route" element={<PlanRoutePage />} />
          <Route path="/insights" element={<DataInsights />} />

          {/* Fallback: any unknown path goes back to homepage */}
          <Route path="*" element={<Navigate to="/homepage" replace />} />
        </Routes>
      </Router>
    </AuthGate>
  );
}