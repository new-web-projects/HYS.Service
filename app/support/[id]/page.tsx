/** File Path: app/support/[id]/page.tsx */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { FileUploadButton } from "@/components/shared/FileUploadButton";

type Message = {
  id: string;
  content: string;
  attachmentUrl: string | null;
  createdAt: string;
  sender: { name: string; role: string };
};

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  issueType: string;
  status: string;
  messages: Message[];
};

export default function SupportTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/support-tickets/${id}`);
    if (res.ok) setTicket((await res.json()).ticket);
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
        body: JSON.stringify({ content: reply, attachmentUrl: attachmentUrl ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that.");
        return;
      }
      setReply("");
      setAttachmentUrl(null);
      await load();
    } finally {
      setSending(false);
    }
  }

  if (!ticket) return <main className="mx-auto max-w-2xl px-6 py-8 text-sm text-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <p className="text-xs text-muted">{ticket.ticketNumber}</p>
      <h1 className="text-2xl font-semibold">{ticket.subject}</h1>
      <p className="text-sm text-muted">
        {ticket.issueType} · {ticket.status.replace(/_/g, " ")}
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {ticket.messages.map((m) => (
          <div key={m.id} className="rounded-lg border border-border p-3 text-sm">
            <p className="text-xs font-medium text-muted">
              {m.sender.name} {["ADMIN", "SUPER_ADMIN"].includes(m.sender.role) && "(Support)"}
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

      {ticket.status !== "CLOSED" ? (
        <form onSubmit={sendReply} className="mt-6 flex flex-col gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Write a reply…"
            className="rounded-md border border-muted/30 px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between">
            <FileUploadButton
              purpose="support_attachment"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              label={attachmentUrl ? "Attachment added" : "Attach a file"}
              onUploaded={(url) => setAttachmentUrl(url)}
            />
            <button
              type="submit"
              disabled={sending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {sending ? "Sending…" : "Reply"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted">This ticket is closed.</p>
      )}
    </main>
  );
}