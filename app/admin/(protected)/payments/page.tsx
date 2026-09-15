"use client";

import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  gateway: "RAZORPAY" | "PHONEPE" | "PAYTM";
  gatewayOrderId: string | null;
  amount: string;
  status: "CREATED" | "SUCCESS" | "FAILED";
  createdAt: string;
  booking: { id: string; customer: { name: string }; worker: { name: string } | null };
};

const GATEWAYS = ["", "RAZORPAY", "PHONEPE", "PAYTM"];

export default function AdminPaymentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [gateway, setGateway] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/payments${gateway ? `?gateway=${gateway}` : ""}`);
        const data = await res.json();
        setTransactions(data.transactions);
      } finally {
        setLoading(false);
      }
    })();
  }, [gateway]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <select value={gateway} onChange={(e) => setGateway(e.target.value)} className="mt-4 rounded-md border border-muted/30 px-3 py-2 text-sm">
        {GATEWAYS.map((g) => (
          <option key={g} value={g}>
            {g || "All gateways"}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-medium">₹{Number(t.amount).toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted">
                  {t.gateway} · {t.booking.customer.name} → {t.booking.worker?.name ?? "—"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  t.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : t.status === "FAILED" ? "bg-red-50 text-red-700" : "bg-muted/10"
                }`}
              >
                {t.status}
              </span>
            </li>
          ))}
          {transactions.length === 0 && <p className="text-sm text-muted">No transactions yet.</p>}
        </ul>
      )}
    </div>
  );
}