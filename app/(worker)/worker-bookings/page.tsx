"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string;
  status: string;
  description: string;
  address: string;
  basePrice: string | null;
  finalPrice: string | null;
  customer: { id: string; name: string; image: string | null };
  conversation: { id: string } | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_RESPONSE: "New request",
  DISCUSSING: "Chat open",
  PRICE_PENDING: "Awaiting your confirmation",
  READY_FOR_PAYMENT: "Ready for payment",
  PAID: "Paid — in progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_RESPONSE: "bg-amber-50 text-amber-700",
  DISCUSSING: "bg-blue-50 text-blue-700",
  PRICE_PENDING: "bg-blue-50 text-blue-700",
  READY_FOR_PAYMENT: "bg-emerald-50 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-muted/15 text-muted",
  CANCELLED: "bg-red-50 text-red-700",
};

export default function WorkerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/bookings/mine")
      .then((res) => res.json())
      .then((data) => setBookings(data.bookings ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: string, action: "accept" | "reject") {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't do that. Try again.");
        return;
      }
      load();
    } finally {
      setBusyId(null);
    }
  }

  if (bookings === null) return <main className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted">Loading…</main>;

  const pending = bookings.filter((b) => b.status === "PENDING_RESPONSE");
  const active = bookings.filter((b) => !["PENDING_RESPONSE", "COMPLETED", "CANCELLED"].includes(b.status));
  const past = bookings.filter((b) => ["COMPLETED", "CANCELLED"].includes(b.status));

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <Link href="/job-board" className="rounded-md border border-muted/30 px-4 py-2 text-sm font-medium">
          Browse job board
        </Link>
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-muted">New requests</h2>
          <ul className="flex flex-col gap-3">
            {pending.map((b) => (
              <li key={b.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <p className="text-sm font-medium">{b.customer.name}</p>
                <p className="mt-1 text-sm">{b.description}</p>
                <p className="mt-1 text-xs text-muted">{b.address}</p>
                {b.basePrice && (
                  <p className="mt-1 text-sm font-medium text-accent">
                    Reference price: ₹{Number(b.basePrice).toLocaleString("en-IN")}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respond(b.id, "accept")}
                    disabled={busyId !== null}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {busyId === b.id ? "…" : "Accept"}
                  </button>
                  <button
                    onClick={() => respond(b.id, "reject")}
                    disabled={busyId !== null}
                    className="rounded-md border border-muted/30 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-muted">Active</h2>
        {active.length === 0 ? (
          <p className="text-sm text-muted">Nothing in progress right now.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((b) => (
              <li key={b.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{b.customer.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{b.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[b.status] ?? "bg-muted/15"}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-accent">
                    {b.finalPrice ? `₹${Number(b.finalPrice).toLocaleString("en-IN")}` : b.basePrice ? `~₹${Number(b.basePrice).toLocaleString("en-IN")}` : "—"}
                  </p>
                  {b.conversation && (
                    <Link href={`/chat/${b.conversation.id}`} className="text-sm font-medium underline">
                      Open chat
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Past</h2>
          <ul className="flex flex-col gap-3">
            {past.map((b) => (
              <li key={b.id} className="rounded-xl border border-border p-4 opacity-70">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm">{b.customer.name}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[b.status] ?? "bg-muted/15"}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}