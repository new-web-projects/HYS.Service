"use client";

import { useCallback, useEffect, useState } from "react";

type Balance = { held: number; available: number; reserved: number; withdrawn: number };
type Earning = {
  id: string;
  amount: string;
  status: "HELD" | "AVAILABLE" | "RESERVED" | "WITHDRAWN";
  booking: { description: string; customer: { name: string } };
};
type Withdrawal = {
  id: string;
  amount: string;
  processingFee: string;
  netAmount: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  rejectionReason: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  HELD: "Held",
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  WITHDRAWN: "Withdrawn",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

const AMOUNT_OPTIONS = [1000, 2000, 3000, 5000, 10000, 15000, 20000];

function formatMoney(value: string | number) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

export default function WorkerEarningsPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState(1000);
  const [method, setMethod] = useState<"UPI" | "BANK">("UPI");
  const [upiId, setUpiId] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [earningsRes, withdrawalsRes] = await Promise.all([
      fetch("/api/worker/earnings"),
      fetch("/api/worker/withdrawals"),
    ]);
    if (earningsRes.ok) {
      const data = await earningsRes.json();
      setBalance(data.balance);
      setEarnings(data.earnings);
    }
    if (withdrawalsRes.ok) {
      setWithdrawals((await withdrawalsRes.json()).withdrawals);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  if (loading || !balance) {
    return <main className="mx-auto max-w-2xl px-6 py-8 text-sm text-muted">Loading…</main>;
  }

  const pendingWithdrawal = withdrawals.find((w) => w.status === "PENDING");
  const affordable = AMOUNT_OPTIONS.filter((a) => a <= balance.available);
  const selectableOptions = affordable.length > 0 ? affordable : [AMOUNT_OPTIONS[0]];
  const canWithdraw = balance.available >= 1000 && !pendingWithdrawal;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/worker/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method,
          ...(method === "UPI" ? { upiId } : { bankAccountName, bankAccountNumber, bankIfsc }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't submit that. Try again.");
        return;
      }
      setSuccess("Withdrawal requested — pending admin approval.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Earnings</h1>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted">Available</p>
          <p className="mt-1 text-lg font-semibold text-accent">{formatMoney(balance.available)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted">Held</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(balance.held)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted">Reserved</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(balance.reserved)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted">Withdrawn</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(balance.withdrawn)}</p>
        </div>
      </section>
      <p className="mt-2 text-xs text-muted">
        Held = payment received, job not yet marked complete. Available = ready to withdraw.
      </p>

      <section className="mt-8 rounded-xl border border-border p-5">
        <h2 className="font-medium">Request a withdrawal</h2>
        {pendingWithdrawal ? (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You have a request for {formatMoney(pendingWithdrawal.amount)} pending admin approval.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Amount
              <select
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="rounded-md border border-muted/30 px-3 py-2"
              >
                {selectableOptions.map((a) => (
                  <option key={a} value={a}>
                    {formatMoney(a)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                ₹1,000–₹20,000, in multiples of ₹1,000. A processing fee (GST included) applies.
              </span>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "UPI" | "BANK")}
                className="rounded-md border border-muted/30 px-3 py-2"
              >
                <option value="UPI">UPI</option>
                <option value="BANK">Bank account</option>
              </select>
            </label>

            {method === "UPI" ? (
              <label className="flex flex-col gap-1 text-sm">
                UPI ID
                <input
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="yourname@bank"
                  className="rounded-md border border-muted/30 px-3 py-2"
                />
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1 text-sm">
                  Account holder name
                  <input
                    required
                    value={bankAccountName}
                    onChange={(e) => setBankAccountName(e.target.value)}
                    className="rounded-md border border-muted/30 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Account number
                  <input
                    required
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="rounded-md border border-muted/30 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  IFSC
                  <input
                    required
                    value={bankIfsc}
                    onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                    className="rounded-md border border-muted/30 px-3 py-2"
                  />
                </label>
              </>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-accent">{success}</p>}
            <button
              type="submit"
              disabled={submitting || !canWithdraw}
              className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Requesting…" : "Request withdrawal"}
            </button>
            {balance.available < 1000 && (
              <p className="text-xs text-muted">You need at least ₹1,000 available to request a withdrawal.</p>
            )}
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted">Withdrawal history</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-muted">No withdrawals yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{formatMoney(w.amount)}</p>
                  <p className="text-xs text-muted">
                    Fee {formatMoney(w.processingFee)} (GST included) · Net {formatMoney(w.netAmount)}
                  </p>
                  {w.rejectionReason && <p className="mt-0.5 text-xs text-red-600">{w.rejectionReason}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    w.status === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700"
                      : w.status === "REJECTED"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {STATUS_LABEL[w.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium text-muted">Earnings ledger</h2>
        {earnings.length === 0 ? (
          <p className="text-sm text-muted">No earnings yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {earnings.map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.booking.customer.name}</p>
                  <p className="truncate text-xs text-muted">{e.booking.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-medium">{formatMoney(e.amount)}</p>
                  <p className="text-xs text-muted">{STATUS_LABEL[e.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}