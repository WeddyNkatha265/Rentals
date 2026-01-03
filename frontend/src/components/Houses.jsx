import { useEffect, useState } from "react";
import axios from "axios";

const inputStyle = { padding: 8, border: "1px solid #E2E8F0", borderRadius: 8, color: "#0F172A", background: "white" };
const card = { background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0", color: "#0F172A" };
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedHouse, setSelectedHouse] = useState(null);
  const [ledger, setLedger] = useState({}); // {houseId: {house_number, first_tenant_joined, items:[...]}}
  const currentYear = new Date().getFullYear();

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [h, t] = await Promise.all([axios.get(`${api}/houses`), axios.get(`${api}/tenants`)]);
      setHouses(h.data);
      setTenants(t.data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addTenant = async (houseId) => {
    if (!selectedTenant) return;
    try {
      await axios.post(`${api}/houses/${houseId}/tenants`, { tenant_id: Number(selectedTenant) });
      setSelectedTenant("");
      setSelectedHouse(null);
      onChanged && onChanged();
      load();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  const fetchLedger = async (houseId) => {
    try {
      const res = await axios.get(`${api}/houses/${houseId}/ledger/${currentYear}`);
      setLedger(prev => ({ ...prev, [houseId]: res.data }));
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  const monthName = (m) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1];

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Houses</h2>
      {loading && <div style={{ color: "#64748B" }}>Loading houses...</div>}
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}
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
              <div style={{ fontSize: "12px", color: "#64748B" }}>Today:</div>
              <div>Received: KES {h.today_received || 0}</div>
              <div>Paid: {h.today_paid.join(", ") || "None"}</div>
              <div>Unpaid: {h.today_unpaid.join(", ") || "None"}</div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: "12px", color: "#64748B" }}>Tenants:</div>
              {h.tenants.length === 0 ? (
                <div style={{ color: "#F97316" }}>No tenants</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {h.tenants.map(o => <li key={o.id}>{o.full_name} ({o.phone}) • ID: {o.gov_id}</li>)}
                </ul>
              )}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: "#64748B" }}>Unpaid months ({h.unpaid_months_year}): {h.unpaid_months.length > 0 ? h.unpaid_months.join(", ") : "None"}</div>
              <button style={{ marginTop: 6, background: "#0A2540", color: "white", padding: "6px 10px", borderRadius: 8, border: "none" }} onClick={() => fetchLedger(h.id)}>
                View {currentYear} ledger
              </button>
              {ledger[h.id] && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>
                    First tenant joined: {ledger[h.id].first_tenant_joined ? ledger[h.id].first_tenant_joined : "N/A"}
                  </div>
                  <table style={{ width: "100%", color: "#0F172A", marginTop: 6 }}>
                    <thead><tr><th>Month</th><th>Status</th><th>Due</th><th>Paid</th><th>Balance</th><th>Details</th></tr></thead>
                    <tbody>
                      {ledger[h.id].items.map((it, idx) => (
                        <tr key={idx}>
                          <td>{monthName(it.month)}</td>
                          <td><span style={pill(it.state)}>{it.state.replace("_"," ")}</span></td>
                          <td>KES {it.amount_due}</td>
                          <td>KES {it.paid_total}</td>
                          <td>KES {it.balance}</td>
                          <td>
                            {it.details.length === 0 ? "-" : (
                              <ul style={{ margin: 0, paddingLeft: 16 }}>
                                {it.details.map((d, j) => (
                                  <li key={j}>{d.payer} • KES {d.amount} • {d.method} • {d.paid_at}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <select
                value={selectedHouse === h.id ? selectedTenant : ""}
                onFocus={() => setSelectedHouse(h.id)}
                onChange={e => setSelectedTenant(e.target.value)}
                style={inputStyle}
              >
                <option value="">Select tenant to add</option>
                {tenants.filter(x => x.status !== "ended").map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
              <button style={{ background: "#0A2540", color: "white", padding: "8px 12px", borderRadius: 8, border: "none" }} onClick={() => addTenant(h.id)}>Add to house</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
