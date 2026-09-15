"use client";

import { useEffect, useState } from "react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  user: { name: string; role: string };
};

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Notifications</h1>
      <p className="mt-1 text-sm text-muted">A system-wide feed of what&apos;s been sent to customers and workers.</p>
      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">{n.title}</p>
              <p className="text-muted">{n.body}</p>
              <p className="mt-1 text-xs text-muted">
                {n.user.name} ({n.user.role}) · {new Date(n.createdAt).toLocaleString()} {n.readAt ? "· read" : "· unread"}
              </p>
            </li>
          ))}
          {notifications.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        </ul>
      )}
    </div>
  );
}