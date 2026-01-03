import { useEffect, useState } from "react";
import axios from "axios";

const inputStyle = { padding: 8, border: "1px solid #E2E8F0", borderRadius: 8 };
const btnStyle = {
  marginTop: 12,
  background: "linear-gradient(90deg, #1D4ED8, #F97316)",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  boxShadow: "0 4px 12px rgba(10,37,64,0.2)"
};

export default function Payments({ api, onRecorded }) {
  const [houses, setHouses] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState({ house_id: "", tenant_id: "", method: "cash", amount: "", tx_ref: "" });
  const [status, setStatus] = useState("");

  const load = async () => {
    const [h, t] = await Promise.all([
      axios.get(`${api}/houses`),
      axios.get(`${api}/tenants`)
    ]);
    setHouses(h.data); setTenants(t.data);
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      const payload = {
        house_id: Number(form.house_id),
        tenant_id: form.tenant_id ? Number(form.tenant_id) : null,
        method: form.method,
        amount: Number(form.amount),
        tx_ref: form.tx_ref || null
      };
      const res = await axios.post(`${api}/payments`, payload);
      setStatus(`Recorded. Invoice: ${res.data.invoice_status}`);
      setForm({ house_id: "", tenant_id: "", method: "cash", amount: "", tx_ref: "" });
      onRecorded && onRecorded();
    } catch (e) {
      setStatus("Error: " + (e.response?.data?.detail || e.message));
    }
  };

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Record payment</h2>
      <div style={{ background: "white", borderRadius: "12px", padding: "16px", maxWidth: 720, border: "1px solid #E2E8F0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <select value={form.house_id} onChange={e => setForm({ ...form, house_id: e.target.value })} style={inputStyle}>
            <option value="">Select house</option>
            {houses.map(h => <option key={h.id} value={h.id}>House {h.number} ({h.type})</option>)}
          </select>
          <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} style={inputStyle}>
            <option value="">Payer (optional)</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} style={inputStyle}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-PESA</option>
          </select>
          <input placeholder="Amount (KES)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
          <input placeholder="Receipt/Ref (optional)" value={form.tx_ref} onChange={e => setForm({ ...form, tx_ref: e.target.value })} style={inputStyle} />
        </div>
        <button style={btnStyle} onClick={submit}>Save & send receipt</button>
        {status && <div style={{ marginTop: 8, color: status.startsWith("Error") ? "#C2410C" : "#1D4ED8" }}>{status}</div>}
      </div>
    </div>
  );
}
