import { useEffect, useState } from "react";
import axios from "axios";

const inputStyle = { padding: 8, border: "1px solid #E2E8F0", borderRadius: 8 };
const card = { background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0" };

export default function Houses({ api }) {
  const [houses, setHouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [selectedHouse, setSelectedHouse] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/houses`);
      setHouses(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addOccupant = async (houseId) => {
    if (!tenantId) return;
    try {
      await axios.post(`${api}/houses/${houseId}/occupants`, { tenant_id: Number(tenantId) });
      setTenantId("");
      setSelectedHouse(null);
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
            <div style={{ fontWeight: 700, color: "#1D4ED8" }}>House {h.number} • {h.type} • KES {h.monthly_rent}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: "12px", color: "#64748B" }}>Occupants:</div>
              {h.occupants.length === 0 ? (
                <div style={{ color: "#F97316" }}>No occupants</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {h.occupants.map(o => <li key={o.id}>{o.full_name} ({o.phone})</li>)}
                </ul>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input
                placeholder="Tenant ID"
                value={selectedHouse === h.id ? tenantId : ""}
                onFocus={() => setSelectedHouse(h.id)}
                onChange={e => setTenantId(e.target.value)}
                style={inputStyle}
              />
              <button
                style={{ background: "#0A2540", color: "white", padding: "8px 12px", borderRadius: 8, border: "none" }}
                onClick={() => addOccupant(h.id)}
              >
                Add occupant
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
