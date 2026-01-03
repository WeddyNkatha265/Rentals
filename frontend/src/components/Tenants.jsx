import { useEffect, useState } from "react";
import axios from "axios";

const card = {
  background: "white",
  borderRadius: "12px",
  padding: "16px",
  border: "1px solid #E2E8F0",
  color: "#0F172A",
  boxShadow: "0 6px 18px rgba(10,37,64,0.06)",
};
const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",   // ✅ ensures inputs fit inside card
  padding: 10,
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  marginBottom: 8,
  color: "#0F172A",
  background: "white",
  fontSize: 14,
};
const btnPrimary = {
  background: "linear-gradient(90deg, #1D4ED8, #F97316)",
  color: "white",
  padding: "8px 12px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
};

// Table styling (same as Payments)
const baseTable = { width: "100%", color: "#0F172A", borderCollapse: "separate", borderSpacing: "0" };
const thtd = { padding: "10px 12px", borderRight: "1px solid #E2E8F0" };
const headerCell = { ...thtd, background: "#F1F5F9", fontWeight: 700, fontSize: 13, color: "#0A2540" };
const rowCell = { ...thtd, background: "white", fontSize: 13 };
const rowAltCell = { ...thtd, background: "#F9FAFB", fontSize: 13 };
const rowEnd = { borderBottom: "1px solid #E2E8F0" };

export default function Tenants({ api, onChanged }) {
  const [tenants, setTenants] = useState([]);
  const [form, setForm] = useState({ full_name: "", phone: "", gov_id: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    if (!form.full_name || !form.phone || !form.gov_id) return;
    try {
      await axios.post(`${api}/tenants`, form);
      setForm({ full_name: "", phone: "", gov_id: "", email: "" });
      onChanged && onChanged();
      load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  const softDelete = async (tenantId) => {
    try {
      await axios.delete(`${api}/tenants/${tenantId}`);
      onChanged && onChanged();
      load();
    } catch (e) {
      alert(e.response?.data?.detail || e.message);
    }
  };

  const active = tenants.filter(t => t.status === "active");
  const former = tenants.filter(t => t.status === "ended");
  const unassigned = tenants.filter(t => t.status === "unassigned");

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Tenants</h2>
      {loading && <div style={{ color: "#64748B" }}>Loading tenants...</div>}
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginTop: "12px" }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Add tenant</div>
          <input placeholder="Full name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} style={inputStyle} />
          <input placeholder="Phone (+254...)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
          <input placeholder="Government ID" value={form.gov_id} onChange={e => setForm({ ...form, gov_id: e.target.value })} style={inputStyle} />
          <input placeholder="Email (optional)" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          <button style={btnPrimary} onClick={create}>Save</button>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Active tenants</div>
          <table style={baseTable}>
            <thead>
              <tr style={rowEnd}>
                <th style={headerCell}>Name</th>
                <th style={headerCell}>Phone</th>
                <th style={headerCell}>Gov ID</th>
                <th style={headerCell}>House</th>
                <th style={headerCell}>Start</th>
                <th style={headerCell}></th>
              </tr>
            </thead>
            <tbody>
              {active.map((t, i) => {
                const cellStyle = i % 2 === 0 ? rowCell : rowAltCell;
                return (
                  <tr key={t.id} style={rowEnd}>
                    <td style={cellStyle}>{t.full_name}</td>
                    <td style={cellStyle}>{t.phone}</td>
                    <td style={cellStyle}>{t.gov_id}</td>
                    <td style={cellStyle}>{t.house_number}</td>
                    <td style={cellStyle}>{t.start_date}</td>
                    <td style={cellStyle}>
                      <button onClick={() => softDelete(t.id)} style={{ background:"#F97316", color:"white", border:"none", borderRadius:6, padding:"6px 8px" }}>
                        Deactivate
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginTop:"16px" }}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Former tenants</div>
          <table style={baseTable}>
            <thead>
              <tr style={rowEnd}>
                <th style={headerCell}>Name</th>
                <th style={headerCell}>Phone</th>
                <th style={headerCell}>Gov ID</th>
                <th style={headerCell}>House</th>
                <th style={headerCell}>End</th>
              </tr>
            </thead>
            <tbody>
              {former.map((t, i) => {
                const cellStyle = i % 2 === 0 ? rowCell : rowAltCell;
                return (
                  <tr key={t.id} style={rowEnd}>
                    <td style={cellStyle}>{t.full_name}</td>
                    <td style={cellStyle}>{t.phone}</td>
                    <td style={cellStyle}>{t.gov_id}</td>
                    <td style={cellStyle}>{t.house_number}</td>
                    <td style={cellStyle}>{t.end_date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Unassigned tenants</div>
          <table style={baseTable}>
            <thead>
              <tr style={rowEnd}>
                <th style={headerCell}>Name</th>
                <th style={headerCell}>Phone</th>
                <th style={headerCell}>Gov ID</th>
                <th style={headerCell}>Email</th>
              </tr>
            </thead>
            <tbody>
              {unassigned.map((t, i) => {
                const cellStyle = i % 2 === 0 ? rowCell : rowAltCell;
                return (
                  <tr key={t.id} style={rowEnd}>
                    <td style={cellStyle}>{t.full_name}</td>
                    <td style={cellStyle}>{t.phone}</td>
                    <td style={cellStyle}>{t.gov_id}</td>
                    <td style={cellStyle}>{t.email || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
