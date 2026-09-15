import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { BookingStatus } from "@/lib/generated/prisma/client";

const VALID_STATUSES: BookingStatus[] = [
  "PENDING_RESPONSE",
  "DISCUSSING",
  "PRICE_PENDING",
  "READY_FOR_PAYMENT",
  "PAID",
  "COMPLETED",
  "CANCELLED",
];

export async function GET(request: Request) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam as BookingStatus) ? (statusParam as BookingStatus) : undefined;

  const bookings = await prisma.booking.findMany({
    where: status ? { status } : {},
    select: {
      id: true,
      origin: true,
      status: true,
      description: true,
      finalPrice: true,
      createdAt: true,
      customer: { select: { id: true, name: true } },
      worker: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ bookings });
}