import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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

  // Make sure the overlay opens even if the event fires before overlay mounts
  useEffect(() => {
    const onOpen = () => setShowLanding(true);
    window.addEventListener("cs:landing:open", onOpen);
    return () => window.removeEventListener("cs:landing:open", onOpen);
  }, []);

  return (
    <AuthGate>
      <Router>
        <Header />
        {/* Mount once globally; opens on first-load automatically or via event */}
        <LandingOverlay open={showLanding} onClose={() => setShowLanding(false)} />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/report" element={<ReportIncident />} />
          <Route path="/plan-route" element={<PlanRoutePage />} />
          <Route path="/insights" element={<DataInsights />} />
        </Routes>
      </Router>
    </AuthGate>
  );
}