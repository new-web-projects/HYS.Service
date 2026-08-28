"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Conversation = {
  id: string;
  proposedPrice: string | null;
  status: string;
  worker: {
    id: string;
    name: string;
    image: string | null;
    workerProfile: { rating: string; reviewCount: number; isVerified: boolean; experienceYears: number } | null;
  };
  messages: { content: string; createdAt: string }[];
};

type JobPostDetail = {
  jobPost: { id: string; title: string; description: string; status: string; category: { name: string } };
  conversations: Conversation[];
};

export default function CustomerJobPostReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<JobPostDetail | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/job-posts/${params.id}`)
      .then((res) => res.json())
      .then(setData);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSelect(conversationId: string) {
    if (selecting) return;
    setSelecting(conversationId);
    setError(null);
    try {
      const res = await fetch(`/api/job-posts/${params.id}/select`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error ?? "Couldn't select this worker. Try again.");
        setSelecting(null);
        return;
      }
      router.push(`/chat/${conversationId}`);
    } catch {
      setError("Network error — try again.");
      setSelecting(null);
    }
  }

  if (!data) return <main className="mx-auto max-w-2xl px-6 py-8 text-sm text-muted">Loading…</main>;

  const { jobPost, conversations } = data;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/customer-bookings" className="text-xs text-muted underline">
        ← My bookings
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{jobPost.title}</h1>
      <p className="text-sm text-muted">{jobPost.category.name}</p>
      <p className="mt-3 text-sm leading-relaxed">{jobPost.description}</p>

      {jobPost.status !== "OPEN" && (
        <p className="mt-4 rounded-md bg-muted/10 px-3 py-2 text-sm text-muted">
          This job post is {jobPost.status.toLowerCase()} — no longer accepting new quotes.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <h2 className="mt-6 mb-3 text-sm font-medium text-muted">
        {conversations.length} {conversations.length === 1 ? "quote" : "quotes"}
      </h2>
      {conversations.length === 0 ? (
        <p className="text-sm text-muted">No quotes yet — check back soon.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {conversations.map((c) => (
            <li key={c.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {c.worker.name}
                    {c.worker.workerProfile?.isVerified && <span className="ml-1 text-xs text-accent">✓ Verified</span>}
                  </p>
                  {c.worker.workerProfile && (
                    <p className="text-xs text-muted">
                      ★ {Number(c.worker.workerProfile.rating).toFixed(1)} ({c.worker.workerProfile.reviewCount}) ·{" "}
                      {c.worker.workerProfile.experienceYears} yrs experience
                    </p>
                  )}
                </div>
                {c.proposedPrice && (
                  <p className="shrink-0 text-lg font-semibold text-accent">₹{Number(c.proposedPrice).toLocaleString("en-IN")}</p>
                )}
              </div>
              {c.messages[0] && <p className="mt-2 line-clamp-2 text-sm text-muted">{c.messages[0].content}</p>}
              <div className="mt-3 flex items-center gap-3">
                <Link href={`/chat/${c.id}`} className="text-sm underline">
                  Message
                </Link>
                {jobPost.status === "OPEN" && (
                  <button
                    onClick={() => handleSelect(c.id)}
                    disabled={selecting !== null}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {selecting === c.id ? "Selecting…" : "Select this worker"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}