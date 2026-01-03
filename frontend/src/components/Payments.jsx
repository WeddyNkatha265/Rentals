import { useEffect, useState } from "react";
import axios from "axios";

const baseTable = {
  width: "100%",
  color: "#0F172A",
  borderCollapse: "separate",
  borderSpacing: "0",
};
const thtd = {
  padding: "10px 12px",
  borderRight: "1px solid #E2E8F0",
};
const headerCell = {
  ...thtd,
  background: "#F1F5F9",
  fontWeight: 700,
  fontSize: 13,
  color: "#0A2540",
};
const rowCell = {
  ...thtd,
  background: "white",
  fontSize: 13,
};
const rowAltCell = {
  ...thtd,
  background: "#F9FAFB",
  fontSize: 13,
};
const rowEnd = {
  borderBottom: "1px solid #E2E8F0",
};
const card = {
  background: "white",
  borderRadius: "12px",
  padding: "16px",
  border: "1px solid #E2E8F0",
  color: "#0F172A",
  boxShadow: "0 6px 18px rgba(10,37,64,0.06)",
};
const inputStyle = {
  padding: 10,
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  color: "#0F172A",
  background: "white",
  fontSize: 14,
};
const btnPrimary = {
  marginTop: 12,
  background: "linear-gradient(90deg, #1D4ED8, #F97316)",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  boxShadow: "0 4px 12px rgba(10,37,64,0.2)",
  cursor: "pointer",
};
const sectionTitle = { fontWeight: 800, color: "#0A2540", marginBottom: 8 };

const MONTHS = [
  { label: "Jan", value: 1 },
  { label: "Feb", value: 2 },
  { label: "Mar", value: 3 },
  { label: "Apr", value: 4 },
  { label: "May", value: 5 },
  { label: "Jun", value: 6 },
  { label: "Jul", value: 7 },
  { label: "Aug", value: 8 },
  { label: "Sep", value: 9 },
  { label: "Oct", value: 10 },
  { label: "Nov", value: 11 },
  { label: "Dec", value: 12 },
];

export default function Payments({ api, onRecorded }) {
  const [houses, setHouses] = useState([]);
  const [form, setForm] = useState({
    house_id: "",
    tenant_id: "",
    method: "cash",
    amount: "",
    tx_ref: "",
    target_year: new Date().getFullYear(),
    target_month: new Date().getMonth() + 1,
  });
  const [status, setStatus] = useState("");
  const [allocations, setAllocations] = useState([]);
  const [recent, setRecent] = useState([]);

  const load = async () => {
    const [h, s] = await Promise.all([axios.get(`${api}/houses`), axios.get(`${api}/stats`)]);
    setHouses(h.data);
    setRecent(s.data?.recent_payments || []);
  };

  useEffect(() => {
    load();
  }, []);

  const tenantsOfHouse = () => {
    const h = houses.find((h) => h.id === Number(form.house_id));
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
        target_month: Number(form.target_month),
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
          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>House</div>
            <select
              value={form.house_id}
              onChange={(e) => setForm({ ...form, house_id: e.target.value, tenant_id: "" })}
              style={inputStyle}
            >
              <option value="">Select house</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>
                  House {h.number} ({h.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Tenant</div>
            <select
              value={form.tenant_id}
              onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
              style={inputStyle}
              disabled={!form.house_id}
            >
              <option value="">Select tenant (from house)</option>
              {tenantsOfHouse().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Method</div>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
              style={inputStyle}
            >
              <option value="cash">Cash</option>
              <option value="mpesa">M-PESA</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Amount (KES)</div>
            <input
              placeholder="Amount (KES)"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={inputStyle}
              inputMode="numeric"
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Receipt/Ref (optional)</div>
            <input
              placeholder="Receipt/Ref"
              value={form.tx_ref}
              onChange={(e) => setForm({ ...form, tx_ref: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Year</div>
            <input
              type="number"
              placeholder="Year (e.g., 2026)"
              value={form.target_year}
              onChange={(e) => setForm({ ...form, target_year: e.target.value })}
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Month</div>
            <select
              value={form.target_month}
              onChange={(e) => setForm({ ...form, target_month: e.target.value })}
              style={inputStyle}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          style={btnPrimary}
          onClick={submit}
          disabled={!form.house_id || !form.tenant_id || !form.amount || !form.target_year || !form.target_month}
        >
          Save & allocate
        </button>

        {status && (
          <div style={{ marginTop: 8, color: status.startsWith("Error") ? "#C2410C" : "#1D4ED8" }}>{status}</div>
        )}

        {allocations.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={sectionTitle}>Allocation summary</div>
            <table style={baseTable}>
              <thead>
                <tr style={rowEnd}>
                  <th style={headerCell}>Year</th>
                  <th style={headerCell}>Month</th>
                  <th style={headerCell}>Applied</th>
                  <th style={headerCell}>Status after</th>
                  <th style={headerCell}>Remaining balance</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a, idx) => {
                  const cellStyle = idx % 2 === 0 ? rowCell : rowAltCell;
                  return (
                    <tr key={idx} style={rowEnd}>
                      <td style={cellStyle}>{a.year}</td>
                      <td style={cellStyle}>{String(a.month).padStart(2, "0")}</td>
                      <td style={cellStyle}>KES {a.applied}</td>
                      <td style={cellStyle}>{a.status_after}</td>
                      <td style={cellStyle}>KES {a.remaining_balance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, ...card }}>
        <div style={sectionTitle}>Transactions (recent)</div>
        <table style={baseTable}>
          <thead>
            <tr style={rowEnd}>
              <th style={headerCell}>House</th>
              <th style={headerCell}>Tenant</th>
              <th style={headerCell}>Method</th>
              <th style={headerCell}>Amount</th>
              <th style={headerCell}>Date/time</th>
              <th style={headerCell}>For</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((t, i) => {
              const cellStyle = i % 2 === 0 ? rowCell : rowAltCell;
              return (
                <tr key={i} style={rowEnd}>
                  <td style={cellStyle}>{t.house_number}</td>
                  <td style={cellStyle}>{t.tenant_name}</td>
                  <td style={cellStyle}>{t.method}</td>
                  <td style={cellStyle}>KES {t.amount}</td>
                  <td style={cellStyle}>{t.paid_at}</td>
                  <td style={cellStyle}>{t.for_month}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
