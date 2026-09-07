import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "@/lib/generated/prisma/client";

export async function GET(request: Request) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status"); // "active" | "past" | omitted = all

  const isWorker = user.role === "WORKER";
  const roleWhere = isWorker ? { workerId: user.id } : { customerId: user.id };

  // Plain, mutable arrays with an explicit BookingStatus[] annotation —
  // not `as const`. `as const` produces a readonly tuple
  // (`readonly [...]`), and Prisma's `{ in: BookingStatus[] }` filter
  // wants a genuinely mutable array — a readonly array isn't assignable
  // to it even though every literal value is a valid BookingStatus.
  // Confirmed against a real generated client's actual error, not
  // assumed: this is what broke when the previous fix removed a cast
  // without checking why it had been there.
  const ACTIVE_STATUSES: BookingStatus[] = [
    "PENDING_RESPONSE",
    "DISCUSSING",
    "PRICE_PENDING",
    "READY_FOR_PAYMENT",
    "PAID",
  ];
  const PAST_STATUSES: BookingStatus[] = ["COMPLETED", "CANCELLED"];

  const statusWhere =
    statusFilter === "active"
      ? { status: { in: ACTIVE_STATUSES } }
      : statusFilter === "past"
        ? { status: { in: PAST_STATUSES } }
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