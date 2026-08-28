"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { bookingId?: string; conversationId?: string; jobPostId?: string } | null;
  readAt: string | null;
  createdAt: string;
};

function linkFor(n: Notification): string | null {
  if (n.data?.conversationId) return `/chat/${n.data.conversationId}`;
  if (n.data?.jobPostId) return `/customer-job-posts/${n.data.jobPostId}`;
  return null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications ?? []));
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setNotifications((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)) ?? null);
  }

  if (notifications === null) return <main className="mx-auto max-w-2xl px-6 py-8 text-sm text-muted">Loading…</main>;

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {hasUnread && (
          <button onClick={markAllRead} className="text-sm underline text-muted">
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const href = linkFor(n);
            const content = (
              <div className={`rounded-lg border p-3 ${n.readAt ? "border-border" : "border-accent/40 bg-accent/5"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  {!n.readAt && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                </div>
                <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted">{new Date(n.createdAt).toLocaleString("en-IN")}</p>
              </div>
            );
            return (
              <li key={n.id} onClick={() => !n.readAt && markRead(n.id)}>
                {href ? <Link href={href}>{content}</Link> : content}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}