/** File Path: app/support/new/page.tsx */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUploadButton } from "@/components/shared/FileUploadButton";

const ISSUE_TYPES = ["Booking issue", "Payment issue", "Account issue", "Worker verification", "Technical problem", "Other"];

export default function NewSupportTicketPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, issueType, message, attachmentUrl: attachmentUrl ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't submit that ticket.");
        return;
      }
      router.push(`/support/${data.ticket.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">New support ticket</h1>
      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Subject
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Briefly describe the issue"
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Issue type
          <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="rounded-md border border-muted/30 px-3 py-2">
            {ISSUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          What&apos;s the problem?
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Tell us what happened, and anything you've already tried"
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>

        <div>
          <FileUploadButton
            purpose="support_attachment"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            label={attachmentUrl ? "Attachment added — change" : "Attach a file (optional)"}
            onUploaded={(url) => setAttachmentUrl(url)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit ticket"}
        </button>
      </form>
    </main>
  );
}