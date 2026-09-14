import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { WithdrawalStatus } from "@/lib/generated/prisma/client";

const VALID_STATUSES: WithdrawalStatus[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

/**
 * Admin-only, deliberately built now ahead of Part 10's actual Admin
 * Panel UI — same pattern Part 8 already established (admin-role checks
 * exist in the booking/payment routes before any admin page could call
 * them). Usable today via a direct API call or similar; Part 10 gives it
 * a real interface.
 */
export async function GET(request: Request) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam && VALID_STATUSES.includes(statusParam as WithdrawalStatus)
      ? (statusParam as WithdrawalStatus)
      : undefined;

  const withdrawals = await prisma.withdrawal.findMany({
    where: status ? { status } : {},
    include: { worker: { select: { id: true, name: true, email: true } } },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ withdrawals });
}