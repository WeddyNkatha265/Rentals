export default function Dashboard({ stats, loading, error, onRefresh }) {
  const headerStyle = { fontSize: "26px", fontWeight: 800, background: "linear-gradient(90deg, #0A2540, #F97316)", WebkitBackgroundClip: "text", color: "transparent" };
  const grid = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginTop: "16px" };
  const card = { background: "white", borderRadius: "14px", padding: "16px", boxShadow: "0 6px 18px rgba(10,37,64,0.08)", border: "1px solid #E2E8F0", color: "#0F172A" };
  const valueStyle = { fontSize: "22px", fontWeight: 700, color: "#1D4ED8" };
  const barWrap = { display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginTop: 12 };

  // table styles (same as Payments)
  const baseTable = { width: "100%", color: "#0F172A", borderCollapse: "separate", borderSpacing: "0" };
  const thtd = { padding: "10px 12px", borderRight: "1px solid #E2E8F0" };
  const headerCell = { ...thtd, background: "#F1F5F9", fontWeight: 700, fontSize: 13, color: "#0A2540" };
  const rowCell = { ...thtd, background: "white", fontSize: 13 };
  const rowAltCell = { ...thtd, background: "#F9FAFB", fontSize: 13 };
  const rowEnd = { borderBottom: "1px solid #E2E8F0" };

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
          <table style={baseTable}>
            <thead>
              <tr style={rowEnd}>
                <th style={headerCell}>House</th>
                <th style={headerCell}>Received</th>
              </tr>
            </thead>
            <tbody>
              {(stats.top_houses || []).map((h, i) => {
                const cellStyle = i % 2 === 0 ? rowCell : rowAltCell;
                return (
                  <tr key={i} style={rowEnd}>
                    <td style={cellStyle}>{h.house_number}</td>
                    <td style={cellStyle}>KES {h.received}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 800, color: "#0A2540" }}>Outstanding houses (this month)</div>
          <table style={baseTable}>
            <thead>
              <tr style={rowEnd}>
                <th style={headerCell}>House</th>
                <th style={headerCell}>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {/* Example: outstanding = expected - received */}
              {(stats.top_houses || []).map((h, i) => {
                const cellStyle = i % 2 === 0 ? rowCell : rowAltCell;
                const outstanding = (stats.expected / stats.units) - h.received; // approximate per house
                return (
                  <tr key={i} style={rowEnd}>
                    <td style={cellStyle}>{h.house_number}</td>
                    <td style={cellStyle}>KES {outstanding > 0 ? outstanding : 0}</td>
                  </tr>
                );
              })}
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
