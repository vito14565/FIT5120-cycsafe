import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import AlertsPage from "./pages/AlertsPage";
import ReportIncident from "./pages/ReportIncident";
import PlanRoutePage from "./pages/PlanRoutePage";
import DataInsights from "./pages/DataInsights";
import { startAlertsPolling, stopAlertsPolling } from "./services/alertsService";
import AuthGate from "./components/AuthGate"; // ⬅️ add this

export default function App() {
  useEffect(() => {
    startAlertsPolling();
    return () => stopAlertsPolling();
  }, []);

  return (
    <AuthGate>
      <Router>
        <Header />
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