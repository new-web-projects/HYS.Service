import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { finalizeWithdrawalEarnings, releaseWithdrawalAllocations } from "@/lib/earnings";
import { notify } from "@/lib/notifications";

const decisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(500).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
  if (!withdrawal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (withdrawal.status !== "PENDING") {
    return NextResponse.json({ error: "This withdrawal has already been processed." }, { status: 409 });
  }

  if (parsed.data.action === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({ where: { id }, data: { status: "APPROVED", processedAt: new Date() } });
      await finalizeWithdrawalEarnings(tx, id);
    });
    await notify({
      userId: withdrawal.workerId,
      type: "withdrawal_approved",
      title: "Withdrawal approved",
      body: `₹${Number(withdrawal.netAmount).toLocaleString("en-IN")} is on its way.`,
      data: { withdrawalId: id },
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.withdrawal.update({
        where: { id },
        data: { status: "REJECTED", processedAt: new Date(), rejectionReason: parsed.data.rejectionReason ?? null },
      });
      await releaseWithdrawalAllocations(tx, id);
    });
    await notify({
      userId: withdrawal.workerId,
      type: "withdrawal_rejected",
      title: "Withdrawal rejected",
      body: parsed.data.rejectionReason
        ? `Your withdrawal request was rejected: ${parsed.data.rejectionReason}`
        : "Your withdrawal request was rejected.",
      data: { withdrawalId: id },
    });
  }

  const updated = await prisma.withdrawal.findUnique({ where: { id } });
  return NextResponse.json({ withdrawal: updated });
}