import { useEffect, useState } from "react";
import axios from "axios";

const card = { background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0", color: "#0F172A" };
const input = { padding: 8, border: "1px solid #E2E8F0", borderRadius: 8, marginRight: 8, color: "#0F172A", background: "white" };
const btn = { background: "#0A2540", color: "white", padding: "8px 12px", border: "none", borderRadius: 8 };

export default function Reports({ api }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [day, setDay] = useState(now.getDate());

  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [yearly, setYearly] = useState(null);
  const [error, setError] = useState("");

  const fetchDaily = async () => {
    try {
      setError("");
      const res = await axios.get(`${api}/reports/daily/${year}/${month}/${day}`);
      setDaily(res.data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
  };
  const fetchMonthly = async () => {
    try {
      setError("");
      const res = await axios.get(`${api}/reports/monthly/${year}/${month}`);
      setMonthly(res.data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
  };
  const fetchYearly = async () => {
    try {
      setError("");
      const res = await axios.get(`${api}/reports/yearly/${year}`);
      setYearly(res.data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
  };

  useEffect(() => { fetchDaily(); fetchMonthly(); fetchYearly(); }, []);

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Reports</h2>
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}

      <div style={{ marginBottom: 12 }}>
        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} style={input} />
        <input type="number" value={month} onChange={e => setMonth(Number(e.target.value))} style={input} />
        <input type="number" value={day} onChange={e => setDay(Number(e.target.value))} style={input} />
        <button style={btn} onClick={() => { fetchDaily(); fetchMonthly(); fetchYearly(); }}>Refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={{ fontWeight: 800 }}>Daily ({year}-{String(month).padStart(2,'0')}-{String(day).padStart(2,'0')})</div>
          {daily && (
            <>
              <div>Received today: KES {daily.received_today}</div>
              <div>Expected monthly: KES {daily.expected_monthly}</div>
              <table style={{ width: "100%", marginTop: 8 }}>
                <thead><tr><th>House</th><th>Received</th><th>Paid</th><th>Unpaid</th></tr></thead>
                <tbody>
                  {Object.entries(daily.houses).map(([hn, v]) => (
                    <tr key={hn}>
                      <td>{hn}</td><td>KES {v.received}</td>
                      <td>{v.paid.join(", ") || "-"}</td>
                      <td>{v.unpaid.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div style={card}>
          <div style={{ fontWeight: 800 }}>Monthly ({year}-{String(month).padStart(2,'0')})</div>
          {monthly && (
            <>
              <div>Expected: KES {monthly.expected}</div>
              <div>Received: KES {monthly.received}</div>
              <div>Outstanding: KES {monthly.outstanding}</div>
              <table style={{ width: "100%", marginTop: 8 }}>
                <thead><tr><th>House</th><th>Tenant</th><th>Amount</th><th>Method</th><th>Date/time</th><th>Ref</th></tr></thead>
                <tbody>
                  {(monthly.payments || []).map((p, i) => (
                    <tr key={i}>
                      <td>{p.house}</td><td>{p.tenant}</td><td>KES {p.amount}</td><td>{p.method}</td><td>{p.paid_at}</td><td>{p.tx_ref || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, ...card }}>
        <div style={{ fontWeight: 800 }}>Yearly ({year})</div>
        {yearly && (
          <>
            <div>Total received: KES {yearly.total_received}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120, marginTop: 8 }}>
              {(yearly.monthly || []).map((m, i) => (
                <div key={i} style={{ textAlign: "center", color: "#0F172A" }}>
                  <div style={{
                    width: 24,
                    height: Math.max(4, Math.min(120, m.received / Math.max(1, Math.max(...yearly.monthly.map(x => x.received))) * 120)),
                    background: "linear-gradient(180deg, #1D4ED8, #F97316)",
                    borderRadius: 6
                  }}></div>
                  <div style={{ fontSize: 10, marginTop: 4 }}>{m.month}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
