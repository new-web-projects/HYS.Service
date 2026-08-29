import { prisma } from "@/lib/prisma";
import { getIO } from "@/lib/socket-server";
import { sendEmail } from "@/lib/email";

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Only for events worth an email, not every chat message — see call sites. */
  email?: { to: string; subject: string; text: string };
};

/**
 * Three delivery channels for one event: persisted (Notification row, so
 * it's still there next time the recipient opens the app), live
 * (Socket.IO push to their personal room — a no-op if getIO() is
 * undefined, e.g. running `next dev` directly instead of server.ts, or on
 * a Vercel deployment with no socket layer attached), and email (only
 * when the caller passes one — booking-request/accepted are worth an
 * email, an individual chat message is not).
 */
export async function notify(input: NotifyInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    },
  });

  getIO()?.to(`user:${input.userId}`).emit("notification", notification);

  if (input.email) {
    // Never let a slow/misconfigured SMTP provider fail the request that
    // triggered it (e.g. a worker accepting a booking) — notification
    // delivery is best-effort, the underlying state change already
    // committed by the time this runs.
    sendEmail(input.email).catch((err: unknown) => {
      console.error(`[notify] email send failed for ${input.userId}:`, err);
    });
  }

  return notification;
}

/**
 * Total unread chat messages across every conversation the user is part
 * of — one query (an OR list, not N per-conversation round-trips) shared
 * by both dashboards so the count logic lives in exactly one place.
 * Mirrors the per-conversation version in
 * app/api/conversations/mine/route.ts, which needs the breakdown by
 * conversation rather than just the total this returns.
 */
export async function getUnreadChatCount(userId: string, role: "CUSTOMER" | "WORKER"): Promise<number> {
  const isCustomer = role === "CUSTOMER";
  const conversations = await prisma.conversation.findMany({
    where: isCustomer ? { customerId: userId } : { workerId: userId },
    select: { id: true, customerLastReadAt: true, workerLastReadAt: true },
  });
  if (conversations.length === 0) return 0;

  return prisma.message.count({
    where: {
      OR: conversations.map((c: (typeof conversations)[number]) => {
        const lastReadAt = isCustomer ? c.customerLastReadAt : c.workerLastReadAt;
        return {
          conversationId: c.id,
          senderId: { not: userId },
          ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
        };
      }),
    },
  });
}