"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  banned: boolean | null;
  createdAt: string;
  customerProfile: { city: string | null } | null;
  _count: { bookingsAsCustomer: number };
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/admin/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`)
        .then((res) => res.json())
        .then((data) => setCustomers(data.customers))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name or email"
        className="mt-4 w-full max-w-sm rounded-md border border-muted/30 px-3 py-2 text-sm"
      />

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/customers/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-accent"
              >
                <div>
                  <p className="font-medium">
                    {c.name} {c.banned && <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Banned</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {c.email} {c.customerProfile?.city ? `· ${c.customerProfile.city}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted">{c._count.bookingsAsCustomer} bookings</span>
              </Link>
            </li>
          ))}
          {customers.length === 0 && <p className="text-sm text-muted">No customers found.</p>}
        </ul>
      )}
    </div>
  );
}