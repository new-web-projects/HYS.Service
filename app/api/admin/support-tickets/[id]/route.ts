/** File Path: app/api/admin/support-tickets/[id]/route.ts */

import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { updateTicketSchema } from "@/lib/support-validators";
import { logAdminAction } from "@/lib/audit-log";
import { notify } from "@/lib/notifications";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findUnique({ where: { id: parsed.data.assignedToId } });
    if (!assignee || !["ADMIN", "SUPER_ADMIN"].includes(assignee.role)) {
      return NextResponse.json({ error: "Tickets can only be assigned to an admin." }, { status: 400 });
    }
  }

  const updated = await prisma.supportTicket.update({ where: { id }, data: parsed.data });

  if (parsed.data.status && parsed.data.status !== ticket.status) {
    await notify({
      userId: ticket.requesterId,
      type: "support_ticket_status",
      title: `${ticket.ticketNumber} status updated`,
      body: `Your ticket is now ${parsed.data.status.replace(/_/g, " ").toLowerCase()}.`,
      data: { ticketId: id },
    });
  }

  await logAdminAction({
    actorId: user.id,
    action: "support_ticket.update",
    entity: "SupportTicket",
    entityId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ticket: updated });
}