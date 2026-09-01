"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Booking = {
  id: string;
  status: string;
  description: string;
  basePrice: string | null;
  finalPrice: string | null;
  worker: { id: string; name: string; image: string | null };
  conversation: { id: string } | null;
  updatedAt: string;
};

type JobPost = {
  id: string;
  title: string;
  status: string;
  category: { name: string };
  _count: { conversations: number };
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_RESPONSE: "Waiting for worker",
  DISCUSSING: "Chat open",
  PRICE_PENDING: "Price pending",
  READY_FOR_PAYMENT: "Ready for payment",
  PAID: "Paid",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_RESPONSE: "bg-amber-50 text-amber-700",
  DISCUSSING: "bg-blue-50 text-blue-700",
  PRICE_PENDING: "bg-blue-50 text-blue-700",
  READY_FOR_PAYMENT: "bg-emerald-50 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-muted/15 text-muted",
  CANCELLED: "bg-red-50 text-red-700",
};

export default function CustomerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [jobPosts, setJobPosts] = useState<JobPost[] | null>(null);

  useEffect(() => {
    fetch("/api/bookings/mine")
      .then((res) => res.json())
      .then((data) => setBookings(data.bookings ?? []));
    fetch("/api/job-posts?mine=true")
      .then((res) => res.json())
      .then((data) => setJobPosts(data.jobPosts ?? []));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <Link href="/post-job" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Post a job
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium text-muted">Bookings</h2>
        {bookings === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : bookings.length === 0 ? (
          <p className="text-sm text-muted">
            No bookings yet — find a worker on the{" "}
            <Link href="/services" className="underline">
              services page
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {bookings.map((b) => (
              <li key={b.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{b.worker.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{b.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[b.status] ?? "bg-muted/15"}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-accent">
                    {b.finalPrice ? `₹${Number(b.finalPrice).toLocaleString("en-IN")}` : b.basePrice ? `~₹${Number(b.basePrice).toLocaleString("en-IN")}` : "—"}
                  </p>
                  <div className="flex items-center gap-3">
                    {b.status === "READY_FOR_PAYMENT" && (
                      <Link
                        href={`/customer-bookings/${b.id}/pay`}
                        className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                      >
                        Pay now
                      </Link>
                    )}
                    {b.conversation && (
                      <Link href={`/chat/${b.conversation.id}`} className="text-sm font-medium underline">
                        Open chat
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted">My job posts</h2>
        {jobPosts === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : jobPosts.length === 0 ? (
          <p className="text-sm text-muted">
            No job posts yet.{" "}
            <Link href="/post-job" className="underline">
              Post one
            </Link>{" "}
            to get quotes from multiple workers.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobPosts.map((jp) => (
              <li key={jp.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{jp.title}</p>
                    <p className="text-xs text-muted">{jp.category.name}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${jp.status === "OPEN" ? "bg-blue-50 text-blue-700" : jp.status === "FILLED" ? "bg-emerald-50 text-emerald-700" : "bg-muted/15"}`}>
                    {jp.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-muted">
                    {jp._count.conversations} {jp._count.conversations === 1 ? "quote" : "quotes"}
                  </p>
                  <Link href={`/customer-job-posts/${jp.id}`} className="text-sm font-medium underline">
                    {jp.status === "OPEN" ? "Review quotes" : "View"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}