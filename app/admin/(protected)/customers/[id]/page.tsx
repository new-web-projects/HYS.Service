"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  banned: boolean | null;
  banReason: string | null;
  createdAt: string;
  customerProfile: { addressLine: string | null; city: string | null } | null;
  bookingsAsCustomer: { id: string; status: string; description: string; finalPrice: string | null; createdAt: string }[];
};

export default function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/customers/${id}`);
    if (res.ok) setCustomer((await res.json()).customer);
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function toggleBan() {
    if (!customer) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned: !customer.banned, banReason: reason || undefined }),
      });
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!customer) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">{customer.name}</h1>
      <p className="text-sm text-muted">{customer.email}</p>

      <dl className="mt-4 space-y-1 text-sm">
        <div>
          <dt className="inline font-medium">Phone: </dt>
          <dd className="inline">{customer.phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Location: </dt>
          <dd className="inline">{customer.customerProfile?.city ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-medium">Joined: </dt>
          <dd className="inline">{new Date(customer.createdAt).toLocaleDateString()}</dd>
        </div>
      </dl>

      <section className="mt-6 rounded-xl border border-border p-4">
        {customer.banned ? (
          <>
            <p className="text-sm text-red-600">Banned{customer.banReason ? `: ${customer.banReason}` : ""}</p>
            <button
              onClick={toggleBan}
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
              onClick={toggleBan}
              disabled={saving}
              className="mt-2 rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
            >
              Ban this customer
            </button>
          </>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-muted">Bookings ({customer.bookingsAsCustomer.length})</h2>
        <ul className="flex flex-col gap-2">
          {customer.bookingsAsCustomer.map((b) => (
            <li key={b.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="truncate">{b.description}</p>
              <p className="text-xs text-muted">
                {b.status} {b.finalPrice ? `· ₹${Number(b.finalPrice).toLocaleString("en-IN")}` : ""}
              </p>
            </li>
          ))}
          {customer.bookingsAsCustomer.length === 0 && <p className="text-sm text-muted">No bookings yet.</p>}
        </ul>
      </section>
    </div>
  );
}