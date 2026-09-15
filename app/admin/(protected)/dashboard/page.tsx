"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  totalCustomers: number;
  totalWorkers: number;
  activeBookings: number;
  completedBookings: number;
  pendingWithdrawals: number;
  pendingCategoryApprovals: number;
  openErrorReports: number;
  platformRevenue: number;
};

const CARDS: { key: keyof Stats; label: string; href: string; money?: boolean }[] = [
  { key: "totalCustomers", label: "Customers", href: "/admin/customers" },
  { key: "totalWorkers", label: "Workers", href: "/admin/workers" },
  { key: "activeBookings", label: "Active bookings", href: "/admin/bookings" },
  { key: "completedBookings", label: "Completed bookings", href: "/admin/bookings?status=COMPLETED" },
  { key: "pendingWithdrawals", label: "Pending withdrawals", href: "/admin/withdrawals" },
  { key: "pendingCategoryApprovals", label: "Categories awaiting approval", href: "/admin/categories" },
  { key: "openErrorReports", label: "Open error reports", href: "/admin/errors" },
  { key: "platformRevenue", label: "Platform revenue (fee + GST)", href: "/admin/payments", money: true },
];

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {!stats ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CARDS.map((c) => (
            <Link
              key={c.key}
              href={c.href}
              className="rounded-lg border border-border p-4 transition hover:border-accent"
            >
              <p className="text-xs text-muted">{c.label}</p>
              <p className="mt-1 text-xl font-semibold">
                {c.money ? `₹${stats[c.key].toLocaleString("en-IN")}` : stats[c.key].toLocaleString("en-IN")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}