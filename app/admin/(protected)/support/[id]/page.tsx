/** File Path: app/admin/(protected)/support/[id]/page.tsx */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Message = {
  id: string;
  content: string;
  attachmentUrl: string | null;
  isInternalNote: boolean;
  createdAt: string;
  sender: { name: string; role: string };
};

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  issueType: string;
  status: string;
  requester: { id: string; name: string; email: string; role: string };
  assignedTo: { id: string; name: string } | null;
  messages: Message[];
};

type Staff = { id: string; name: string };

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];

export default function AdminSupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [reply, setReply] = useState("");
  const [asInternalNote, setAsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [ticketRes, staffRes] = await Promise.all([fetch(`/api/support-tickets/${id}`), fetch("/api/admin/staff")]);
    if (ticketRes.ok) setTicket((await ticketRes.json()).ticket);
    if (staffRes.ok) setStaff((await staffRes.json()).staff);
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/support-tickets/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply, isInternalNote: asInternalNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that.");
        return;
      }
      setReply("");
      await load();
    } finally {
      setSending(false);
    }
  }

  async function updateTicket(patch: Record<string, unknown>) {
    await fetch(`/api/admin/support-tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  }

  if (!ticket) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs text-muted">{ticket.ticketNumber}</p>
      <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
      <p className="text-sm text-muted">
        {ticket.requester.name} ({ticket.requester.email}) · {ticket.issueType}
      </p>

      <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-border p-4 text-sm">
        <label className="flex flex-col gap-1">
          Status
          <select value={ticket.status} onChange={(e) => updateTicket({ status: e.target.value })} className="rounded-md border border-muted/30 px-2 py-1.5 text-sm">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Assigned to
          <select
            value={ticket.assignedTo?.id ?? ""}
            onChange={(e) => updateTicket({ assignedToId: e.target.value || null })}
            className="rounded-md border border-muted/30 px-2 py-1.5 text-sm"
          >
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border p-3 text-sm ${m.isInternalNote ? "border-amber-200 bg-amber-50" : "border-border"}`}
          >
            <p className="text-xs font-medium text-muted">
              {m.sender.name} {["ADMIN", "SUPER_ADMIN"].includes(m.sender.role) && "(Support)"}
              {m.isInternalNote && " · Internal note"}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
            {m.attachmentUrl && (
              <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent underline">
                View attachment
              </a>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={sendReply} className="mt-6 flex flex-col gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={3}
          placeholder={asInternalNote ? "Internal note (not visible to the requester)…" : "Reply to the requester…"}
          className="rounded-md border border-muted/30 px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={asInternalNote} onChange={(e) => setAsInternalNote(e.target.checked)} className="h-4 w-4" />
            Internal note only
          </label>
          <button
            type="submit"
            disabled={sending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {sending ? "Sending…" : asInternalNote ? "Add note" : "Reply"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}