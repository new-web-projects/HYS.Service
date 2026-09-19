/** File Path: app/api/support-tickets/[id]/route.ts */

import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const isStaff = STAFF_ROLES.includes(user.role);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      requester: { select: { id: true, name: true, email: true, role: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: {
        // Internal notes are staff-only — a requester must never see
        // them, even by requesting this same endpoint directly.
        where: isStaff ? {} : { isInternalNote: false },
        include: { sender: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.requesterId !== user.id && !isStaff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ticket });
}