import { useEffect, useState } from "react";
import axios from "axios";
import Dashboard from "./components/Dashboard.jsx";
import Houses from "./components/Houses.jsx";
import Tenants from "./components/Tenants.jsx";
import Payments from "./components/Payments.jsx";
import Transactions from "./components/Transactions.jsx";

const API = import.meta.env.VITE_API_URL;

const layout = {
  wrapper: { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  sidebar: {
    width: "260px",
    background: "#0A2540",
    color: "white",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "8px"
  },
  brand: { fontWeight: 800, fontSize: "20px", marginBottom: "16px", letterSpacing: "0.4px" },
  navItem: { padding: "12px 14px", borderRadius: "10px", cursor: "pointer" },
  navActive: { background: "rgba(255,255,255,0.12)", border: "1px solid #93C5FD" },
  main: { flex: 1, padding: "24px" },
  statusBar: { color: "#64748B", fontSize: "12px", marginTop: "6px" }
};

export default function App() {
  const [view, setView] = useState("Dashboard");
  const [stats, setStats] = useState({ units: 0, expected: 0, received: 0, outstanding: 0, top_houses: [], recent_payments: [] });
  const [loadingStats, setLoadingStats] = useState(false);
  const [errorStats, setErrorStats] = useState("");

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      setErrorStats("");
      const res = await axios.get(`${API}/stats`);
      setStats(res.data);
    } catch (e) {
      setErrorStats(e.response?.data?.detail || e.message || "Failed to load stats");
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const NavItem = ({ name }) => (
    <div
      onClick={() => setView(name)}
      style={{ ...layout.navItem, ...(view === name ? layout.navActive : {}) }}
    >
      {name}
    </div>
  );

  return (
    <div style={layout.wrapper}>
      <aside style={layout.sidebar}>
        <div style={layout.brand}>Murithi&apos;s Homes</div>
        <NavItem name="Dashboard" />
        <NavItem name="Houses" />
        <NavItem name="Tenants" />
        <NavItem name="Payments" />
        <NavItem name="Transactions" />
        <div style={layout.statusBar}>API: {API}</div>
      </aside>
      <main style={layout.main}>
        {view === "Dashboard" && (
          <Dashboard
            stats={stats}
            loading={loadingStats}
            error={errorStats}
            onRefresh={fetchStats}
          />
        )}
        {view === "Houses" && <Houses api={API} onChanged={fetchStats} />}
        {view === "Tenants" && <Tenants api={API} onChanged={fetchStats} />}
        {view === "Payments" && <Payments api={API} onRecorded={fetchStats} />}
        {view === "Transactions" && <Transactions api={API} />}
      </main>
    </div>
  );
}
