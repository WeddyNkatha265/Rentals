import { useEffect, useState } from "react";
import axios from "axios";

const inputStyle = { display: "block", width: "100%", padding: 8, border: "1px solid #E2E8F0", borderRadius: 8, marginBottom: 8 };
const btnStyle = { background: "linear-gradient(90deg, #1D4ED8, #F97316)", color: "white", padding: "8px 12px", borderRadius: 10, border: "none" };

export default function Tenants({ api }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ full_name: "", phone: "", email: "" });

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await axios.get(`${api}/tenants`);
      setTenants(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.full_name || !form.phone) return;
    try {
      await axios.post(`${api}/tenants`, form);
      setForm({ full_name: "", phone: "", email: "" });
      load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Tenants</h2>
      {loading && <div style={{ color: "#64748B" }}>Loading tenants...</div>}
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginTop: "12px" }}>
        <div style={{ background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Create tenant</div>
          <input placeholder="Full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} style={inputStyle} />
          <input placeholder="Phone (+254...)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
          <input placeholder="Email (optional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          <button style={btnStyle} onClick={create}>Save</button>
        </div>
        <div style={{ background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>All tenants</div>
          <table style={{ width: "100%" }}>
            <thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th></tr></thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}><td>{t.id}</td><td>{t.full_name}</td><td>{t.phone}</td><td>{t.email || "-"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
