"use client";

import { useCallback, useEffect, useState } from "react";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customer: { name: string };
  worker: { name: string };
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reviews");
    if (res.ok) setReviews((await res.json()).reviews);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this review? The worker's rating will be recalculated.")) return;
    setBusyId(id);
    try {
      await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Reviews</h1>
      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p>
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)} for {r.worker.name}
                  </p>
                  {r.comment && <p className="mt-1 text-muted">{r.comment}</p>}
                  <p className="mt-1 text-xs text-muted">by {r.customer.name}</p>
                </div>
                <button
                  onClick={() => remove(r.id)}
                  disabled={busyId === r.id}
                  className="shrink-0 text-xs text-red-600 underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {reviews.length === 0 && <p className="text-sm text-muted">No reviews yet.</p>}
        </ul>
      )}
    </div>
  );
}