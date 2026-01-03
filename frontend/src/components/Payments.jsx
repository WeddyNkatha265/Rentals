import { useEffect, useState } from "react";
import axios from "axios";

const inputStyle = { padding: 8, border: "1px solid #E2E8F0", borderRadius: 8, color: "#0F172A", background: "white" };
const btnStyle = { marginTop: 12, background: "linear-gradient(90deg, #1D4ED8, #F97316)", color: "white", padding: "10px 14px", borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(10,37,64,0.2)" };
const card = { background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0", color: "#0F172A" };

export default function Payments({ api, onRecorded }) {
  const [houses, setHouses] = useState([]);
  const [form, setForm] = useState({ house_id: "", tenant_id: "", method: "cash", amount: "", tx_ref: "", target_year: new Date().getFullYear(), target_month: new Date().getMonth() + 1 });
  const [status, setStatus] = useState("");
  const [allocations, setAllocations] = useState([]);

  const load = async () => {
    const h = await axios.get(`${api}/houses`);
    setHouses(h.data);
  };

  useEffect(() => { load(); }, []);

  const tenantsOfHouse = () => {
    const h = houses.find(h => h.id === Number(form.house_id));
    return h ? h.tenants : [];
  };

  const submit = async () => {
    try {
      const payload = {
        house_id: Number(form.house_id),
        tenant_id: Number(form.tenant_id),
        method: form.method,
        amount: Number(form.amount),
        tx_ref: form.tx_ref || null,
        target_year: Number(form.target_year),
        target_month: Number(form.target_month)
      };
      const res = await axios.post(`${api}/payments`, payload);
      setAllocations(res.data.allocations || []);
      setStatus("Recorded");
      onRecorded && onRecorded();
      load();
    } catch (e) {
      setStatus("Error: " + (e.response?.data?.detail || e.message));
      setAllocations([]);
    }
  };

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Record payment</h2>
      <div style={card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <select value={form.house_id} onChange={e => setForm({ ...form, house_id: e.target.value, tenant_id: "" })} style={inputStyle}>
            <option value="">Select house</option>
            {houses.map(h => <option key={h.id} value={h.id}>House {h.number} ({h.type})</option>)}
          </select>
          <select value={form.tenant_id} onChange={e => setForm({ ...form, tenant_id: e.target.value })} style={inputStyle} disabled={!form.house_id}>
            <option value="">Select tenant (from house)</option>
            {tenantsOfHouse().map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
          <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} style={inputStyle}>
            <option value="cash">Cash</option>
            <option value="mpesa">M-PESA</option>
          </select>
          <input placeholder="Amount (KES)" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
          <input placeholder="Receipt/Ref (optional)" value={form.tx_ref} onChange={e => setForm({ ...form, tx_ref: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="Year (e.g., 2026)" value={form.target_year} onChange={e => setForm({ ...form, target_year: e.target.value })} style={inputStyle} />
          <input type="number" placeholder="Month (1-12)" value={form.target_month} onChange={e => setForm({ ...form, target_month: e.target.value })} style={inputStyle} />
        </div>
        <button style={btnStyle} onClick={submit} disabled={!form.house_id || !form.tenant_id || !form.amount || !form.target_year || !form.target_month}>
          Save & allocate
        </button>
        {status && <div style={{ marginTop: 8, color: status.startsWith("Error") ? "#C2410C" : "#1D4ED8" }}>{status}</div>}

        {allocations.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700 }}>Allocation summary</div>
            <table style={{ width: "100%", color: "#0F172A" }}>
              <thead><tr><th>Year</th><th>Month</th><th>Applied</th><th>Status after</th><th>Remaining balance</th></tr></thead>
              <tbody>
                {allocations.map((a, idx) => (
                  <tr key={idx}><td>{a.year}</td><td>{String(a.month).padStart(2,'0')}</td><td>KES {a.applied}</td><td>{a.status_after}</td><td>KES {a.remaining_balance}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
