"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Conversation = {
  id: string;
  status: string;
  customer: { id: string; name: string };
  worker: { id: string; name: string };
  jobPost: { id: string; title: string } | null;
  booking: { id: string; status: string; finalPrice: string | null } | null;
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
};

export default function ChatsInboxPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);

  useEffect(() => {
    fetch("/api/conversations/mine")
      .then((res) => res.json())
      .then((data) => setConversations(data.conversations ?? []));
  }, []);

  if (conversations === null) return <main className="mx-auto max-w-2xl px-6 py-8 text-sm text-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Chats</h1>

      {conversations.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No conversations yet.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {conversations.map((c) => {
            const title = c.jobPost?.title ?? `${c.customer.name} ↔ ${c.worker.name}`;
            return (
              <li key={c.id}>
                <Link
                  href={`/chat/${c.id}`}
                  className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${
                    c.unreadCount > 0 ? "border-accent/40 bg-accent/5" : "border-border"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{title}</p>
                    {c.lastMessage && <p className="truncate text-xs text-muted">{c.lastMessage.content}</p>}
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}