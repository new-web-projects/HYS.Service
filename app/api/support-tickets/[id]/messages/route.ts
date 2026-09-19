/** File Path: app/api/support-tickets/[id]/messages/route.ts */

import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { sendTicketMessageSchema } from "@/lib/support-validators";
import { notify } from "@/lib/notifications";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN"];

/**
 * One shared endpoint for both the requester's replies and staff
 * replies/internal notes — the permission and visibility differences
 * are enforced here rather than by duplicating this logic in two
 * routes. Only staff can ever set isInternalNote; a requester's request
 * body is never trusted for that regardless of what it contains.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const { allowed } = await rateLimit(`support-message:${user.id}`, 30, 60 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many messages. Try again later." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = sendTicketMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isStaff = STAFF_ROLES.includes(user.role);
  if (ticket.requesterId !== user.id && !isStaff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (ticket.status === "CLOSED") {
    return NextResponse.json({ error: "This ticket is closed." }, { status: 409 });
  }

  const isInternalNote = isStaff && Boolean(parsed.data.isInternalNote);

  const [message] = await prisma.$transaction([
    prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        senderId: user.id,
        content: parsed.data.content,
        attachmentUrl: parsed.data.attachmentUrl,
        isInternalNote,
      },
      include: { sender: { select: { name: true, role: true } } },
    }),
    // A reply moves things along — a requester's reply after staff was
    // waiting on them clears that state back to in-progress; a staff
    // reply (not an internal note) signals the requester needs to look.
    prisma.supportTicket.update({
      where: { id },
      data: {
        status: isInternalNote
          ? undefined
          : isStaff
            ? "WAITING_FOR_CUSTOMER"
            : ticket.status === "WAITING_FOR_CUSTOMER"
              ? "IN_PROGRESS"
              : undefined,
      },
    }),
  ]);

  if (!isInternalNote) {
    const recipientId = isStaff ? ticket.requesterId : ticket.assignedToId;
    if (recipientId) {
      await notify({
        userId: recipientId,
        type: "support_ticket_reply",
        title: `New reply on ${ticket.subject}`,
        body: parsed.data.content.slice(0, 200),
        data: { ticketId: id },
      });
    }
  }

  return NextResponse.json({ message });
}