import { useEffect, useState } from "react";
import axios from "axios";

const card = { background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0", color: "#0F172A", boxShadow: "0 6px 18px rgba(10,37,64,0.06)" };
const inputStyle = { padding: 8, border: "1px solid #E2E8F0", borderRadius: 8, color: "#0F172A", background: "white" };
const headerCell = { background: "#F1F5F9", fontWeight: 700, padding: "8px", borderBottom: "1px solid #E2E8F0" };
const rowCell = { padding: "8px", borderBottom: "1px solid #E2E8F0" };
const rowAltCell = { padding: "8px", borderBottom: "1px solid #E2E8F0", background: "#F9FAFB" };

// pill styling for status
const pill = (state) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 12,
  color: state === "paid" ? "#065F46" : (state === "partially_paid" ? "#B45309" : "#7F1D1D"),
  background: state === "paid" ? "#D1FAE5" : (state === "partially_paid" ? "#FFEDD5" : "#FEE2E2"),
  border: "1px solid #E2E8F0"
});

export default function Houses({ api, onChanged }) {
  const [houses, setHouses] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [ledger, setLedger] = useState({});
  const currentYear = new Date().getFullYear();

  const load = async () => {
    const [h, t] = await Promise.all([axios.get(`${api}/houses`), axios.get(`${api}/tenants`)]);
    setHouses(h.data);
    setTenants(t.data);
  };

  useEffect(() => { load(); }, []);

  const addTenant = async (houseId, tenantId) => {
    await axios.post(`${api}/houses/${houseId}/tenants`, { tenant_id: tenantId });
    onChanged && onChanged();
    load();
  };

  const fetchLedger = async (houseId) => {
    const res = await axios.get(`${api}/houses/${houseId}/ledger/${currentYear}`);
    setLedger(prev => ({ ...prev, [houseId]: res.data }));
  };

  const monthName = (m) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1];

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Houses</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginTop: "12px" }}>
        {houses.map(h => (
          <div key={h.id} style={card}>
            <div style={{ fontWeight: 700, color: "#1D4ED8" }}>
              House {h.number} • {h.type} • Rent KES {h.monthly_rent}
            </div>
            <div style={{ marginTop: 8 }}>
              <strong>Total received:</strong> KES {h.total_received || 0}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: "12px", color: "#64748B" }}>Tenants:</div>
              {h.tenants.length === 0 ? "No tenants" : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {h.tenants.map(o => <li key={o.id}>{o.full_name} ({o.phone}) • ID: {o.gov_id}</li>)}
                </ul>
              )}
            </div>
            <button style={{ marginTop: 6, background: "#0A2540", color: "white", padding: "6px 10px", borderRadius: 8, border: "none" }} onClick={() => fetchLedger(h.id)}>
              View {currentYear} ledger
            </button>
            {ledger[h.id] && (
              <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headerCell}>Month</th>
                    <th style={headerCell}>Status</th>
                    <th style={headerCell}>Due</th>
                    <th style={headerCell}>Paid</th>
                    <th style={headerCell}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger[h.id].items.map((it, idx) => {
                    const cellStyle = idx % 2 === 0 ? rowCell : rowAltCell;
                    return (
                      <tr key={idx}>
                        <td style={cellStyle}>{monthName(it.month)}</td>
                        <td style={cellStyle}><span style={pill(it.state)}>{it.state.replace("_"," ")}</span></td>
                        <td style={cellStyle}>KES {it.amount_due}</td>
                        <td style={cellStyle}>KES {it.paid_total}</td>
                        <td style={cellStyle}>KES {it.balance}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
