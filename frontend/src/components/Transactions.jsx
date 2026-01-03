import { useEffect, useState } from "react";
import axios from "axios";

export default function Transactions({ api }) {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      // Build transaction view from payments endpoint (we rely on ledger in Houses for deep details)
      const res = await axios.get(`${api}/stats`); // recent payments in stats
      setTxs(res.data.recent_payments || []);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Transactions (recent)</h2>
      {loading && <div style={{ color: "#64748B" }}>Loading transactions...</div>}
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}
      <div style={{ background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0", color: "#0F172A" }}>
        <table style={{ width: "100%", color: "#0F172A" }}>
          <thead>
            <tr>
              <th>House</th><th>Tenant</th><th>Method</th><th>Amount</th><th>Date/time</th><th>For</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t, i) => (
              <tr key={i}>
                <td>{t.house_number}</td>
                <td>{t.tenant_name}</td>
                <td>{t.method}</td>
                <td>KES {t.amount}</td>
                <td>{t.paid_at}</td>
                <td>{t.for_month}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
