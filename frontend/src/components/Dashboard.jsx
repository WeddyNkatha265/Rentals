export default function Dashboard({ stats, loading, error, onRefresh }) {
  const headerStyle = {
    fontSize: "26px",
    fontWeight: 800,
    background: "linear-gradient(90deg, #0A2540, #F97316)",
    WebkitBackgroundClip: "text",
    color: "transparent"
  };
  const grid = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginTop: "16px" };
  const card = {
    background: "white",
    borderRadius: "14px",
    padding: "16px",
    boxShadow: "0 6px 18px rgba(10,37,64,0.08)",
    border: "1px solid #E2E8F0"
  };
  const valueStyle = { fontSize: "22px", fontWeight: 700, color: "#1D4ED8" };

  const Item = ({ label, value }) => (
    <div style={card}>
      <div style={{ fontSize: "13px", color: "#334155" }}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={headerStyle}>Dashboard</div>
      {loading && <div style={{ color: "#64748B" }}>Loading stats...</div>}
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}
      <button
        onClick={onRefresh}
        style={{
          marginTop: 12,
          background: "linear-gradient(90deg, #1D4ED8, #F97316)",
          color: "white",
          padding: "8px 12px",
          borderRadius: 10,
          border: "none",
          boxShadow: "0 4px 12px rgba(10,37,64,0.2)"
        }}
      >
        Refresh
      </button>
      <div style={grid}>
        <Item label="Units" value={stats.units ?? 0} />
        <Item label="Active occupants" value={stats.activeLeases ?? 0} />
        <Item label="Expected this month" value={`KES ${stats.expected ?? 0}`} />
        <Item label="Received" value={`KES ${stats.received ?? 0}`} />
      </div>
    </div>
  );
}
