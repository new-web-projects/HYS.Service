"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useConversationSocket } from "@/lib/socket-client";

type Message = {
  id: string;
  senderId: string;
  type: "TEXT" | "PRICE_PROPOSAL" | "PRICE_ACCEPTED" | "PRICE_CONFIRMED" | "SYSTEM";
  content: string;
  priceAmount: string | null;
  createdAt: string;
  sender: { id: string; name: string; image: string | null };
};

type ConversationDetail = {
  id: string;
  status: "OPEN" | "PRICE_PROPOSED" | "PRICE_CONFIRMED" | "CLOSED";
  proposedPrice: string | null;
  customerConfirmed: boolean;
  workerConfirmed: boolean;
  customer: { id: string; name: string; image: string | null };
  worker: { id: string; name: string; image: string | null };
  jobPost: { id: string; title: string; status: string } | null;
  booking: {
    id: string;
    status: string;
    description: string;
    basePrice: string | null;
    finalPrice: string | null;
    platformFee: string | null;
    gstAmount: string | null;
  } | null;
};

// Baseline safety net alongside the socket, not a replacement for it — see
// server.ts's file header for why (Vercel can't hold a socket connection
// at all, so this is what keeps chat working there, just with this much
// latency instead of instant).
const POLL_INTERVAL_MS = 8000;

const BOOKING_STATUS_COPY: Record<string, (names: { customer: string; worker: string }) => string> = {
  PENDING_RESPONSE: ({ worker }) => `Waiting for ${worker} to accept this request.`,
  DISCUSSING: () => "Chat is open — agree on a final price below.",
  PRICE_PENDING: ({ customer }) => `${customer} accepted the price — waiting for the worker to confirm it.`,
  READY_FOR_PAYMENT: () => "Price confirmed. Payment isn't wired up yet — that's Part 8.",
  PAID: () => "Paid — job in progress.",
  COMPLETED: () => "This job is complete.",
  CANCELLED: () => "This booking was cancelled.",
};

function formatMoney(value: string | number | null) {
  if (value === null) return null;
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function ChatWindow({ conversationId, viewerId }: { conversationId: string; viewerId: string }) {
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposeAmount, setProposeAmount] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { socket, connected, sendTyping, sendStopTyping } = useConversationSocket(conversationId);

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessages((prev) => {
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const loadConversation = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}`);
    if (res.ok) {
      const data = await res.json();
      setConversation(data.conversation);
    }
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    const res = await fetch(`/api/conversations/${conversationId}/messages`);
    if (res.ok) {
      const data = await res.json();
      mergeMessages(data.messages);
    }
  }, [conversationId, mergeMessages]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/conversations/${conversationId}`),
      fetch(`/api/conversations/${conversationId}/messages`),
    ])
      .then(async ([convoRes, msgRes]) => {
        if (!convoRes.ok) {
          setLoadError(convoRes.status === 403 ? "You don't have access to this chat." : "Chat not found.");
          return;
        }
        setConversation((await convoRes.json()).conversation);
        if (msgRes.ok) mergeMessages((await msgRes.json()).messages);
      })
      .finally(() => setLoading(false));
  }, [conversationId, mergeMessages]);

  useEffect(() => {
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    if (!socket) return;
    function handleNewMessage(message: Message) {
      mergeMessages([message]);
      setOtherTyping(false);
    }
    function handleTyping(payload: { userId: string }) {
      if (payload.userId !== viewerId) setOtherTyping(true);
    }
    function handleStopTyping(payload: { userId: string }) {
      if (payload.userId !== viewerId) setOtherTyping(false);
    }
    function handleBookingUpdated() {
      loadConversation();
    }
    socket.on("new-message", handleNewMessage);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);
    socket.on("booking-updated", handleBookingUpdated);
    return () => {
      socket.off("new-message", handleNewMessage);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
      socket.off("booking-updated", handleBookingUpdated);
    };
  }, [socket, viewerId, mergeMessages, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (messages.length === 0) return;
    fetch(`/api/conversations/${conversationId}/read`, { method: "POST" });
  }, [conversationId, messages.length]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">Loading chat…</div>;
  }
  if (loadError || !conversation) {
    return <div className="flex h-full items-center justify-center text-sm text-muted">{loadError ?? "Chat not found."}</div>;
  }

  const isCustomer = conversation.customer.id === viewerId;
  const otherParty = isCustomer ? conversation.worker : conversation.customer;
  const chatLocked = conversation.booking?.status === "PENDING_RESPONSE";
  const canSend = !chatLocked && conversation.status !== "CLOSED";
  const canPropose = !isCustomer && canSend;
  const canAccept =
    isCustomer && conversation.status === "PRICE_PROPOSED" && !conversation.customerConfirmed && Boolean(conversation.booking);
  const canConfirm =
    !isCustomer && conversation.customerConfirmed && !conversation.workerConfirmed && Boolean(conversation.booking);
  const canCancel = conversation.booking !== null && !["PAID", "COMPLETED", "CANCELLED"].includes(conversation.booking.status);

  async function postMessage(body: { type: Message["type"]; content: string; priceAmount?: number }) {
    setSending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Couldn't send that. Try again.");
        return false;
      }
      mergeMessages([data.message]);
      if (data.booking) await loadConversation();
      return true;
    } finally {
      setSending(false);
    }
  }

  function handleTextChange(value: string) {
    setText(value);
    sendTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(sendStopTyping, 2000);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText("");
    sendStopTyping();
    await postMessage({ type: "TEXT", content });
  }

  async function handlePropose(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(proposeAmount);
    if (!amount || amount <= 0) {
      setActionError("Enter a valid amount.");
      return;
    }
    const ok = await postMessage({
      type: "PRICE_PROPOSAL",
      content: `Proposed price: ${formatMoney(amount)}`,
      priceAmount: amount,
    });
    if (ok) {
      setShowProposeForm(false);
      setProposeAmount("");
    }
  }

  async function handleAccept() {
    if (!conversation?.proposedPrice) return;
    await postMessage({
      type: "PRICE_ACCEPTED",
      content: `Accepted price: ${formatMoney(conversation.proposedPrice)}`,
    });
  }

  async function handleConfirm() {
    if (!conversation?.proposedPrice) return;
    await postMessage({
      type: "PRICE_CONFIRMED",
      content: `Confirmed final price: ${formatMoney(conversation.proposedPrice)}`,
    });
  }

  async function handleCancelBooking() {
    if (!conversation?.booking || cancelling) return;
    setCancelling(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${conversation.booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Couldn't cancel this booking.");
        return;
      }
      setConfirmingCancel(false);
      await loadConversation();
    } finally {
      setCancelling(false);
    }
  }

  const bannerText = conversation.booking
    ? BOOKING_STATUS_COPY[conversation.booking.status]?.({ customer: conversation.customer.name, worker: conversation.worker.name })
    : conversation.jobPost
      ? `Discussing "${conversation.jobPost.title}" — not selected yet.`
      : null;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/20 text-sm font-medium">
            {otherParty.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{otherParty.name}</p>
            <p className="truncate text-xs text-muted">
              {connected ? "Live" : "Reconnecting…"}
              {otherTyping && " · typing…"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {isCustomer && (
            <Link href={`/worker/${otherParty.id}`} className="text-xs whitespace-nowrap underline text-muted">
              Profile
            </Link>
          )}
          {canCancel && !confirmingCancel && (
            <button
              onClick={() => setConfirmingCancel(true)}
              className="text-xs whitespace-nowrap text-red-600 underline"
            >
              Cancel booking
            </button>
          )}
        </div>
      </header>

      {confirmingCancel && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-800">Cancel this booking? This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={handleCancelBooking}
              disabled={cancelling}
              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Yes, cancel"}
            </button>
            <button onClick={() => setConfirmingCancel(false)} className="text-xs text-muted underline">
              Never mind
            </button>
          </div>
        </div>
      )}

      {conversation.booking?.finalPrice ? (
        <div className="border-b border-border bg-accent/5 px-4 py-3 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            <dt className="text-muted">Final price</dt>
            <dd className="text-right">{formatMoney(conversation.booking.finalPrice)}</dd>
            <dt className="text-muted">Platform fee</dt>
            <dd className="text-right">{formatMoney(conversation.booking.platformFee)}</dd>
            <dt className="text-muted">GST (on platform fee)</dt>
            <dd className="text-right">{formatMoney(conversation.booking.gstAmount)}</dd>
            <dt className="font-medium">Total amount</dt>
            <dd className="text-right font-medium">
              {formatMoney(
                Number(conversation.booking.finalPrice) +
                  Number(conversation.booking.platformFee ?? 0) +
                  Number(conversation.booking.gstAmount ?? 0),
              )}
            </dd>
          </dl>
          {conversation.booking.status === "READY_FOR_PAYMENT" && (
            <>
              <p className="mt-2 text-xs text-muted">
                Once payment is completed, {isCustomer ? "you" : "the customer"} won&apos;t be able to cancel this
                booking.
              </p>
              <button
                type="button"
                disabled
                title="Payment isn't wired up yet — that's Part 8"
                className="mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50 sm:w-auto"
              >
                Proceed to payment
              </button>
            </>
          )}
          {conversation.booking.status === "PAID" && (
            <p className="mt-2 text-xs text-accent">Paid — this booking can no longer be cancelled.</p>
          )}
        </div>
      ) : (
        bannerText && <div className="border-b border-border bg-muted/10 px-4 py-2 text-xs text-muted">{bannerText}</div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {chatLocked && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-center text-xs text-amber-800">
            This chat opens once the worker accepts the booking request.
          </p>
        )}
        {messages.map((message) => {
          const mine = message.senderId === viewerId;
          const isPriceEvent = message.type !== "TEXT" && message.type !== "SYSTEM";
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  isPriceEvent
                    ? "border border-accent/30 bg-accent/10"
                    : mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/15"
                }`}
              >
                {isPriceEvent && (
                  <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide opacity-70">
                    {message.type === "PRICE_PROPOSAL" && "Price proposed"}
                    {message.type === "PRICE_ACCEPTED" && "Price accepted"}
                    {message.type === "PRICE_CONFIRMED" && "Price confirmed"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                <p className={`mt-1 text-[10px] ${mine && !isPriceEvent ? "text-primary-foreground/70" : "text-muted"}`}>
                  {formatTime(message.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {actionError && <p className="px-4 pb-1 text-xs text-red-600">{actionError}</p>}

      {(canPropose || canAccept || canConfirm) && (
        <div className="border-t border-border px-4 py-3">
          {canPropose && !showProposeForm && (
            <button
              onClick={() => setShowProposeForm(true)}
              className="rounded-md border border-accent px-3 py-1.5 text-xs font-medium text-accent"
            >
              Propose a price
            </button>
          )}
          {canPropose && showProposeForm && (
            <form onSubmit={handlePropose} className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                step={1}
                required
                value={proposeAmount}
                onChange={(e) => setProposeAmount(e.target.value)}
                placeholder="Amount in ₹"
                className="w-32 rounded-md border border-muted/30 px-2 py-1.5 text-sm"
              />
              <button type="submit" disabled={sending} className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                Send proposal
              </button>
              <button type="button" onClick={() => setShowProposeForm(false)} className="text-xs text-muted underline">
                Cancel
              </button>
            </form>
          )}
          {canAccept && (
            <button
              onClick={handleAccept}
              disabled={sending}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Accept {formatMoney(conversation.proposedPrice)}
            </button>
          )}
          {canConfirm && (
            <button
              onClick={handleConfirm}
              disabled={sending}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              Confirm final price — {formatMoney(conversation.proposedPrice)}
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-border px-4 py-3">
        <input
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={!canSend}
          placeholder={canSend ? "Type a message…" : "Chat isn't open yet"}
          className="flex-1 rounded-md border border-muted/30 px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend || sending || !text.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}