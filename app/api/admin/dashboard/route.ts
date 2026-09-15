import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const [
    totalCustomers,
    totalWorkers,
    activeBookings,
    completedBookings,
    pendingWithdrawals,
    pendingCategoryApprovals,
    openErrorReports,
    revenueAgg,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.count({ where: { role: "WORKER" } }),
    prisma.booking.count({ where: { status: { in: ["PENDING_RESPONSE", "DISCUSSING", "PRICE_PENDING", "READY_FOR_PAYMENT", "PAID"] } } }),
    prisma.booking.count({ where: { status: "COMPLETED" } }),
    prisma.withdrawal.count({ where: { status: "PENDING" } }),
    prisma.category.count({ where: { isApproved: false } }),
    prisma.errorReport.count({ where: { status: "open" } }),
    prisma.booking.aggregate({
      where: { status: { in: ["PAID", "COMPLETED"] } },
      _sum: { platformFee: true, gstAmount: true },
    }),
  ]);

  return NextResponse.json({
    totalCustomers,
    totalWorkers,
    activeBookings,
    completedBookings,
    pendingWithdrawals,
    pendingCategoryApprovals,
    openErrorReports,
    platformRevenue: Number(revenueAgg._sum.platformFee ?? 0) + Number(revenueAgg._sum.gstAmount ?? 0),
  });
}