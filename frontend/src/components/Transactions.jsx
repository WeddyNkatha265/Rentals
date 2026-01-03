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
      const res = await axios.get(`${api}/payments`);
      setTxs(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <h2 style={{ fontWeight: 800, color: "#0A2540" }}>Transactions</h2>
      {loading && <div style={{ color: "#64748B" }}>Loading transactions...</div>}
      {error && <div style={{ color: "#C2410C" }}>Error: {error}</div>}
      <div style={{ background: "white", borderRadius: "12px", padding: "16px", border: "1px solid #E2E8F0" }}>
        <table style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>House</th><th>Tenant</th><th>Method</th><th>Amount</th><th>Date</th><th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {txs.map(t => (
              <tr key={t.id}>
                <td>{t.house_number}</td>
                <td>{t.tenant_name}</td>
                <td>{t.method}</td>
                <td>KES {t.amount}</td>
                <td>{new Date(t.paid_at).toLocaleString()}</td>
                <td>{t.tx_ref || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


