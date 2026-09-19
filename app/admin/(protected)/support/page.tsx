/** File Path: app/admin/(protected)/support/page.tsx */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  issueType: string;
  status: string;
  requester: { name: string; role: string };
  assignedTo: { name: string } | null;
};

const STATUSES = ["", "OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      fetch(`/api/admin/support-tickets?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => setTickets(data.tickets))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [status, q]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Support tickets</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ticket #, subject, or requester"
          className="w-full max-w-sm rounded-md border border-muted/30 px-3 py-2 text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-muted/30 px-3 py-2 text-sm">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s ? s.replace(/_/g, " ") : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/support/${t.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:border-accent"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.subject}</p>
                  <p className="text-xs text-muted">
                    {t.ticketNumber} · {t.requester.name} ({t.requester.role.toLowerCase()}) · {t.issueType}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  <p>{t.status.replace(/_/g, " ")}</p>
                  <p>{t.assignedTo ? `Assigned: ${t.assignedTo.name}` : "Unassigned"}</p>
                </div>
              </Link>
            </li>
          ))}
          {tickets.length === 0 && <p className="text-sm text-muted">No tickets found.</p>}
        </ul>
      )}
    </div>
  );
}