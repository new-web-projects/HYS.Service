/** File Path: app/support/page.tsx */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  issueType: string;
  status: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED" | "CLOSED";
  updatedAt: string;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  WAITING_FOR_CUSTOMER: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-muted/15 text-muted",
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/support-tickets")
      .then((res) => res.json())
      .then((data) => setTickets(data.tickets))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Support</h1>
        <Link href="/support/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          New ticket
        </Link>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : tickets.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No support tickets yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/support/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.subject}</p>
                  <p className="text-xs text-muted">
                    {t.ticketNumber} · {t.issueType}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                  {t.status.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}