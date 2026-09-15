"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Worker = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  banned: boolean | null;
  banReason: string | null;
  workerProfile: {
    category: { name: string } | null;
    isVerified: boolean;
    documentType: string | null;
    documentUrl: string | null;
    startingPrice: string;
    ordersCompleted: number;
    rating: string;
    reviewCount: number;
  } | null;
  bookingsAsWorker: { id: string; status: string; description: string; finalPrice: string | null }[];
};

export default function AdminWorkerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/workers/${id}`);
    if (res.ok) setWorker((await res.json()).worker);
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function update(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch(`/api/admin/workers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!worker) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{worker.name}</h1>
      <p className="text-sm text-muted">{worker.email}</p>

      <dl className="mt-4 space-y-1 text-sm">
        <div>
          <dt className="inline font-medium">Category: </dt>
          <dd className="inline">{worker.workerProfile?.category?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Starting price: </dt>
          <dd className="inline">₹{Number(worker.workerProfile?.startingPrice ?? 0).toLocaleString("en-IN")}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Rating: </dt>
          <dd className="inline">
            {worker.workerProfile ? `${Number(worker.workerProfile.rating).toFixed(1)}★ (${worker.workerProfile.reviewCount} reviews)` : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline font-medium">Orders completed: </dt>
          <dd className="inline">{worker.workerProfile?.ordersCompleted ?? 0}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Document on file: </dt>
          <dd className="inline">
            {worker.workerProfile?.documentType
              ? `${worker.workerProfile.documentType}${worker.workerProfile.documentUrl ? "" : " (upload pending Part 11)"}`
              : "None yet"}
          </dd>
        </div>
      </dl>

      <section className="mt-6 rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Verified</span>
          <button
            onClick={() => update({ isVerified: !worker.workerProfile?.isVerified })}
            disabled={saving}
            className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
              worker.workerProfile?.isVerified ? "border border-border" : "bg-accent text-white"
            }`}
          >
            {worker.workerProfile?.isVerified ? "Remove verification" : "Mark verified"}
          </button>
        </div>

        <div className="mt-4 border-t border-border pt-4">
          {worker.banned ? (
            <>
              <p className="text-sm text-red-600">Banned{worker.banReason ? `: ${worker.banReason}` : ""}</p>
              <button
                onClick={() => update({ banned: false })}
                disabled={saving}
                className="mt-2 rounded-md border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Unban
              </button>
            </>
          ) : (
            <>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for ban (optional)"
                className="w-full rounded-md border border-muted/30 px-3 py-2 text-sm"
              />
              <button
                onClick={() => update({ banned: true, banReason: reason || undefined })}
                disabled={saving}
                className="mt-2 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
              >
                Ban this worker
              </button>
            </>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-muted">Bookings ({worker.bookingsAsWorker.length})</h2>
        <ul className="flex flex-col gap-2">
          {worker.bookingsAsWorker.map((b) => (
            <li key={b.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="truncate">{b.description}</p>
              <p className="text-xs text-muted">
                {b.status} {b.finalPrice ? `· ₹${Number(b.finalPrice).toLocaleString("en-IN")}` : ""}
              </p>
            </li>
          ))}
          {worker.bookingsAsWorker.length === 0 && <p className="text-sm text-muted">No bookings yet.</p>}
        </ul>
      </section>
    </div>
  );
}