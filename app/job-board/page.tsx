"use client";

import { useEffect, useState } from "react";

type JobPost = {
  id: string;
  title: string;
  description: string;
  addressLine: string | null;
  category: { name: string };
  customer: { name: string };
  _count: { conversations: number };
  createdAt: string;
};

export default function JobBoardPage() {
  const [jobPosts, setJobPosts] = useState<JobPost[] | null>(null);
  const [quoting, setQuoting] = useState<string | null>(null);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quotePrice, setQuotePrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/job-posts")
      .then((res) => res.json())
      .then((data) => setJobPosts(data.jobPosts ?? []));
  }, []);

  async function submitQuote(jobPostId: string) {
    if (submitting) return;
    const price = Number(quotePrice);
    if (!price || price <= 0) {
      setError("Enter a valid price.");
      return;
    }
    if (quoteMessage.trim().length < 10) {
      setError("Add a short message (at least 10 characters) explaining your quote.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/job-posts/${jobPostId}/interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: quoteMessage.trim(), price }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send your quote. Try again.");
        return;
      }
      setSentIds((prev) => new Set(prev).add(jobPostId));
      setQuoting(null);
      setQuoteMessage("");
      setQuotePrice("");
    } finally {
      setSubmitting(false);
    }
  }

  if (jobPosts === null) return <main className="mx-auto max-w-2xl px-6 py-8 text-sm text-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Job board</h1>
      <p className="mt-1 text-sm text-muted">
        Open jobs in your category. Send a quote — the customer compares everyone who
        applies and picks who they want.
      </p>

      {jobPosts.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No open jobs right now — check back soon.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {jobPosts.map((jp) => {
            const alreadySent = sentIds.has(jp.id);
            return (
              <li key={jp.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{jp.title}</p>
                    <p className="text-xs text-muted">
                      {jp.category.name} · {jp.customer.name}
                      {jp.addressLine && ` · ${jp.addressLine}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {jp._count.conversations} {jp._count.conversations === 1 ? "quote" : "quotes"} so far
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{jp.description}</p>

                {alreadySent ? (
                  <p className="mt-3 text-sm font-medium text-accent">Quote sent ✓</p>
                ) : quoting === jp.id ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-md border border-muted/20 p-3">
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <input
                      type="number"
                      min={1}
                      value={quotePrice}
                      onChange={(e) => setQuotePrice(e.target.value)}
                      placeholder="Your quote in ₹"
                      className="rounded-md border border-muted/30 px-3 py-2 text-sm"
                    />
                    <textarea
                      rows={2}
                      value={quoteMessage}
                      onChange={(e) => setQuoteMessage(e.target.value)}
                      placeholder="Briefly explain your quote…"
                      className="rounded-md border border-muted/30 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitQuote(jp.id)}
                        disabled={submitting}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        {submitting ? "Sending…" : "Send quote"}
                      </button>
                      <button onClick={() => setQuoting(null)} className="text-sm text-muted underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setQuoting(jp.id);
                      setError(null);
                    }}
                    className="mt-3 rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent"
                  >
                    Send a quote
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}