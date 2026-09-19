/** File Path: app/api/support-tickets/route.ts */

import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { createTicketSchema } from "@/lib/support-validators";

export async function GET() {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const tickets = await prisma.supportTicket.findMany({
    where: { requesterId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ tickets });
}

/**
 * ticketNumber is generated in two steps: create the row (Postgres
 * assigns ticketSequence via its own autoincrement — race-safe by
 * construction, no separate counter table needed), then format and
 * store the human-facing "HYS-000001" number from that.
 */
export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const { allowed } = await rateLimit(`support-ticket:${user.id}`, 10, 60 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many tickets. Try again later." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        ticketNumber: "PENDING", // placeholder, overwritten immediately below
        requesterId: user.id,
        subject: parsed.data.subject,
        issueType: parsed.data.issueType,
        messages: {
          create: {
            senderId: user.id,
            content: parsed.data.message,
            attachmentUrl: parsed.data.attachmentUrl,
          },
        },
      },
    });
    const ticketNumber = `HYS-${String(created.ticketSequence).padStart(6, "0")}`;
    return tx.supportTicket.update({ where: { id: created.id }, data: { ticketNumber } });
  });

  return NextResponse.json({ ticket });
}