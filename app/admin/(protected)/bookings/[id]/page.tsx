"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Booking = {
  id: string;
  origin: "DIRECT" | "JOB_POST";
  status: string;
  description: string;
  address: string;
  basePrice: string | null;
  finalPrice: string | null;
  platformFee: string | null;
  gstAmount: string | null;
  createdAt: string;
  customer: { name: string; email: string; phone: string | null };
  worker: { name: string; email: string; phone: string | null } | null;
  jobPost: { title: string } | null;
  review: { rating: number; comment: string | null } | null;
};

const CANCELLABLE = ["PENDING_RESPONSE", "DISCUSSING", "PRICE_PENDING", "READY_FOR_PAYMENT"];

export default function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/bookings/${id}`);
    if (res.ok) setBooking((await res.json()).booking);
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function cancel() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't cancel this booking.");
        return;
      }
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!booking) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{booking.description}</h1>
      <p className="text-sm text-muted">
        {booking.status} · {booking.origin === "JOB_POST" ? `Job post: ${booking.jobPost?.title}` : "Direct booking"}
      </p>

      <dl className="mt-4 space-y-1 text-sm">
        <div>
          <dt className="inline font-medium">Address: </dt>
          <dd className="inline">{booking.address}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Customer: </dt>
          <dd className="inline">
            {booking.customer.name}
            {["PAID", "COMPLETED"].includes(booking.status) && ` · ${booking.customer.phone ?? booking.customer.email}`}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Worker: </dt>
          <dd className="inline">
            {booking.worker?.name ?? "Unassigned"}
            {booking.worker && ["PAID", "COMPLETED"].includes(booking.status) && ` · ${booking.worker.phone ?? booking.worker.email}`}
          </dd>
        </div>
        {booking.finalPrice && (
          <div>
            <dt className="inline font-medium">Price: </dt>
            <dd className="inline">
              ₹{Number(booking.finalPrice).toLocaleString("en-IN")} + fee ₹{Number(booking.platformFee ?? 0).toLocaleString("en-IN")} + GST ₹
              {Number(booking.gstAmount ?? 0).toLocaleString("en-IN")}
            </dd>
          </div>
        )}
        {booking.review && (
          <div>
            <dt className="inline font-medium">Review: </dt>
            <dd className="inline">
              {booking.review.rating}★ {booking.review.comment}
            </dd>
          </div>
        )}
      </dl>

      {CANCELLABLE.includes(booking.status) ? (
        <section className="mt-6 rounded-xl border border-red-200 p-4">
          <p className="text-sm font-medium text-red-700">Cancel this booking</p>
          <p className="mt-1 text-xs text-muted">
            Only available before payment — a paid or completed booking needs a refund decision this panel doesn&apos;t make yet.
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (shown to both parties)"
            className="mt-2 w-full rounded-md border border-muted/30 px-3 py-2 text-sm"
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          <button
            onClick={cancel}
            disabled={saving}
            className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Cancel booking
          </button>
        </section>
      ) : booking.status === "CANCELLED" ? (
        <p className="mt-6 text-sm text-muted">This booking is cancelled.</p>
      ) : (
        <p className="mt-6 text-sm text-muted">
          This booking has been paid — cancelling it here isn&apos;t available; a refund would need to be handled directly.
        </p>
      )}
    </div>
  );
}