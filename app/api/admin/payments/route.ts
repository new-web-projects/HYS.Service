import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import type { PaymentGateway } from "@/lib/generated/prisma/client";

const VALID_GATEWAYS: PaymentGateway[] = ["RAZORPAY", "PHONEPE", "PAYTM"];

export async function GET(request: Request) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const url = new URL(request.url);
  const gatewayParam = url.searchParams.get("gateway");
  const gateway =
    gatewayParam && VALID_GATEWAYS.includes(gatewayParam as PaymentGateway) ? (gatewayParam as PaymentGateway) : undefined;

  const transactions = await prisma.transaction.findMany({
    where: gateway ? { gateway } : {},
    select: {
      id: true,
      gateway: true,
      gatewayOrderId: true,
      gatewayPaymentId: true,
      amount: true,
      status: true,
      createdAt: true,
      booking: { select: { id: true, customer: { select: { name: true } }, worker: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ transactions });
}