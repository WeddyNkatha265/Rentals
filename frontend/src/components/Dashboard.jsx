export default function Dashboard({ stats, loading, error, onRefresh }) {
  const headerStyle = { fontSize: "26px", fontWeight: 800, background: "linear-gradient(90deg, #0A2540, #F97316)", WebkitBackgroundClip: "text", color: "transparent" };
  const grid = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginTop: "16px" };
  const card = { background: "white", borderRadius: "14px", padding: "16px", boxShadow: "0 6px 18px rgba(10,37,64,0.08)", border: "1px solid #E2E8F0", color: "#0F172A" };
  const valueStyle = { fontSize: "22px", fontWeight: 700, color: "#1D4ED8" };
  const barWrap = { display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginTop: 12 };
  const maxVal = () => Math.max(...(stats.trend || []).map(t => t.received), 1);
  const bar = (val) => ({ width: 24, height: Math.max(4, Math.min(120, (val / maxVal()) * 120)), background: "linear-gradient(180deg, #1D4ED8, #F97316)", borderRadius: 6 });

  const Item = ({ label, value }) => (
    <div style={card}>
      <div style={{ fontSize: "13px", color: "#334155" }}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );

  return (
    <div>
      <div style={headerStyle}>Finance dashboard</div>
      {loading && <div style={{ color: "#64748B" }}>Loading...</div>}
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}
      <button onClick={onRefresh} style={{ marginTop: 12, background: "linear-gradient(90deg, #1D4ED8, #F97316)", color: "white", padding: "8px 12px", borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(10,37,64,0.2)" }}>Refresh</button>

      <div style={grid}>
        <Item label="Units" value={stats.units ?? 0} />
        <Item label="Expected this month" value={`KES ${stats.expected ?? 0}`} />
        <Item label="Received" value={`KES ${stats.received ?? 0}`} />
        <Item label="Outstanding" value={`KES ${stats.outstanding ?? 0}`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
        <div style={card}>
          <div style={{ fontWeight: 800, color: "#0A2540" }}>Top houses (this month)</div>
          <table style={{ width: "100%", marginTop: 8, color: "#0F172A" }}>
            <thead><tr><th>House</th><th>Received</th></tr></thead>
            <tbody>{(stats.top_houses || []).map((h, i) => (<tr key={i}><td>{h.house_number}</td><td>KES {h.received}</td></tr>))}</tbody>
          </table>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800, color: "#0A2540" }}>Recent payments</div>
          <table style={{ width: "100%", marginTop: 8, color: "#0F172A" }}>
            <thead><tr><th>House</th><th>Tenant</th><th>Amount</th><th>Method</th><th>Date/time</th><th>For</th></tr></thead>
            <tbody>
              {(stats.recent_payments || []).map((p, i) => (
                <tr key={i}><td>{p.house_number}</td><td>{p.tenant_name}</td><td>KES {p.amount}</td><td>{p.method}</td><td>{p.paid_at}</td><td>{p.for_month}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 800, color: "#0A2540" }}>6‑month trend</div>
        <div style={barWrap}>
          {(stats.trend || []).map((t, i) => (
            <div key={i} style={{ textAlign: "center", color: "#0F172A" }}>
              <div style={bar(t.received)}></div>
              <div style={{ fontSize: 10, marginTop: 4 }}>{t.month}/{String(t.year).slice(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
