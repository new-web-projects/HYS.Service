import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status"); // "active" | "past" | omitted = all

  const isWorker = user.role === "WORKER";
  const roleWhere = isWorker ? { workerId: user.id } : { customerId: user.id };

  const ACTIVE_STATUSES = ["PENDING_RESPONSE", "DISCUSSING", "PRICE_PENDING", "READY_FOR_PAYMENT", "PAID"] as const;
  const PAST_STATUSES = ["COMPLETED", "CANCELLED"] as const;
  const statusWhere =
    statusFilter === "active"
      ? { status: { in: ACTIVE_STATUSES as unknown as string[] } }
      : statusFilter === "past"
        ? { status: { in: PAST_STATUSES as unknown as string[] } }
        : {};

  const bookings = await prisma.booking.findMany({
    where: { ...roleWhere, ...statusWhere },
    include: {
      customer: { select: { id: true, name: true, image: true } },
      worker: { select: { id: true, name: true, image: true } },
      conversation: { select: { id: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ bookings });
}