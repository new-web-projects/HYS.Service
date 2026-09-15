"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string;
  origin: "DIRECT" | "JOB_POST";
  status: string;
  description: string;
  finalPrice: string | null;
  createdAt: string;
  customer: { name: string };
  worker: { name: string } | null;
};

const STATUSES = ["", "PENDING_RESPONSE", "DISCUSSING", "PRICE_PENDING", "READY_FOR_PAYMENT", "PAID", "COMPLETED", "CANCELLED"];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/bookings${status ? `?status=${status}` : ""}`);
        const data = await res.json();
        setBookings(data.bookings);
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="mt-4 rounded-md border border-muted/30 px-3 py-2 text-sm"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s || "All statuses"}
          </option>
        ))}
      </select>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/bookings/${b.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="truncate">{b.description}</p>
                  <p className="text-xs text-muted">
                    {b.customer.name} → {b.worker?.name ?? "unassigned"} · {b.origin === "JOB_POST" ? "Job post" : "Direct"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium">{b.status}</p>
                  {b.finalPrice && <p className="text-xs text-muted">₹{Number(b.finalPrice).toLocaleString("en-IN")}</p>}
                </div>
              </Link>
            </li>
          ))}
          {bookings.length === 0 && <p className="text-sm text-muted">No bookings found.</p>}
        </ul>
      )}
    </div>
  );
}