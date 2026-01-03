import { useEffect, useState } from "react";
import axios from "axios";

const inputStyle = { padding: 8, border: "1px solid #E2E8F0", borderRadius: 8 };
const card = { background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0" };

export default function Houses({ api, onChanged }) {
  const [houses, setHouses] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTenant, setSelectedTenant] = useState("");
  const [selectedHouse, setSelectedHouse] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [h, t] = await Promise.all([
        axios.get(`${api}/houses`),
        axios.get(`${api}/tenants`)
      ]);
      setHouses(h.data);
      setTenants(t.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
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
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    }
  };

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
            <div style={{ marginTop: 8, color: "#334155" }}>
              <strong>Total received:</strong> KES {h.total_received || 0}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: "12px", color: "#64748B" }}>Tenants:</div>
              {h.tenants.length === 0 ? (
                <div style={{ color: "#F97316" }}>No tenants</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {h.tenants.map(o => <li key={o.id}>{o.full_name} ({o.phone})</li>)}
                </ul>
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
              <button
                style={{ background: "#0A2540", color: "white", padding: "8px 12px", borderRadius: 8, border: "none" }}
                onClick={() => addTenant(h.id)}
              >
                Add to house
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
