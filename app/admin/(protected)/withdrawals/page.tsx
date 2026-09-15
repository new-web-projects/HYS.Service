"use client";

import { useCallback, useEffect, useState } from "react";

type Withdrawal = {
  id: string;
  amount: string;
  processingFee: string;
  netAmount: string;
  method: "UPI" | "BANK";
  upiId: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedAt: string;
  worker: { id: string; name: string; email: string };
};

function formatMoney(value: string | number) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/withdrawals");
    if (res.ok) setWithdrawals((await res.json()).withdrawals);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason: action === "reject" ? reason : undefined }),
      });
      setRejectingId(null);
      setReason("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = withdrawals.filter((w) => w.status === "PENDING");
  const decided = withdrawals.filter((w) => w.status !== "PENDING");

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Withdrawals</h1>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <>
          <section className="mt-6">
            <h2 className="mb-3 text-sm font-medium text-muted">Pending ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted">Nothing pending.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((w) => (
                  <li key={w.id} className="rounded-lg border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{w.worker.name}</p>
                        <p className="text-xs text-muted">{w.worker.email}</p>
                        <p className="mt-1">
                          {formatMoney(w.amount)} · fee {formatMoney(w.processingFee)} · net {formatMoney(w.netAmount)}
                        </p>
                        <p className="text-xs text-muted">
                          {w.method === "UPI" ? `UPI: ${w.upiId}` : `${w.bankAccountName} · ${w.bankAccountNumber} · ${w.bankIfsc}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => decide(w.id, "approve")}
                          disabled={busyId === w.id}
                          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(rejectingId === w.id ? null : w.id)}
                          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                    {rejectingId === w.id && (
                      <div className="mt-3 flex gap-2 border-t border-border pt-3">
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Reason (shown to the worker)"
                          className="flex-1 rounded-md border border-muted/30 px-2 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => decide(w.id, "reject")}
                          disabled={busyId === w.id}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Confirm reject
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-muted">History</h2>
            <ul className="flex flex-col gap-2">
              {decided.map((w) => (
                <li key={w.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{w.worker.name}</p>
                    <p className="text-xs text-muted">{formatMoney(w.amount)}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      w.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {w.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}