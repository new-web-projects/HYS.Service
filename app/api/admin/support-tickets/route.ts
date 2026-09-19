/** File Path: app/api/admin/support-tickets/route.ts */

import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { TicketStatus } from "@/lib/generated/prisma/client";

const VALID_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"];

export async function GET(request: Request) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam && VALID_STATUSES.includes(statusParam as TicketStatus) ? (statusParam as TicketStatus) : undefined;
  const q = url.searchParams.get("q")?.trim();

  const tickets = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { ticketNumber: { contains: q, mode: "insensitive" } },
              { subject: { contains: q, mode: "insensitive" } },
              { requester: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      requester: { select: { name: true, email: true, role: true } },
      assignedTo: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ tickets });
}