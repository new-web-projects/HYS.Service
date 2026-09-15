"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Worker = {
  id: string;
  name: string;
  email: string;
  banned: boolean | null;
  workerProfile: {
    category: { name: string } | null;
    isVerified: boolean;
    isAvailable: boolean;
    rating: string;
    reviewCount: number;
    ordersCompleted: number;
  } | null;
};

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [q, setQ] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "true" | "false">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (verifiedFilter) params.set("verified", verifiedFilter);
      fetch(`/api/admin/workers?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => setWorkers(data.workers))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q, verifiedFilter]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Workers</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          className="w-full max-w-sm rounded-md border border-muted/30 px-3 py-2 text-sm"
        />
        <select
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value as "" | "true" | "false")}
          className="rounded-md border border-muted/30 px-3 py-2 text-sm"
        >
          <option value="">All</option>
          <option value="true">Verified only</option>
          <option value="false">Unverified only</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {workers.map((w) => (
            <li key={w.id}>
              <Link
                href={`/admin/workers/${w.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-accent"
              >
                <div>
                  <p className="font-medium">
                    {w.name}
                    {w.banned && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Banned</span>}
                    {w.workerProfile?.isVerified && (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Verified</span>
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {w.email} {w.workerProfile?.category ? `· ${w.workerProfile.category.name}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">
                  {w.workerProfile ? `${Number(w.workerProfile.rating).toFixed(1)}★ (${w.workerProfile.reviewCount})` : "—"}
                </span>
              </Link>
            </li>
          ))}
          {workers.length === 0 && <p className="text-sm text-muted">No workers found.</p>}
        </ul>
      )}
    </div>
  );
}