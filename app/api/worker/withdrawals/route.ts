import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import {
  isValidWithdrawalAmount,
  computeWithdrawalFee,
  getWorkerBalance,
  allocateEarningsForWithdrawal,
  MIN_WITHDRAWAL,
  MAX_WITHDRAWAL,
  WITHDRAWAL_STEP,
} from "@/lib/earnings";
import { withdrawalRequestSchema } from "@/lib/earnings-validators";
import { notify } from "@/lib/notifications";

export async function GET() {
  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const withdrawals = await prisma.withdrawal.findMany({
    where: { workerId: user.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ withdrawals });
}

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const { allowed } = await rateLimit(`withdrawal:${user.id}`, 5, 60 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = withdrawalRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { amount, method, upiId, bankAccountName, bankAccountNumber, bankIfsc } = parsed.data;

  if (!isValidWithdrawalAmount(amount)) {
    return NextResponse.json(
      {
        error: `Amount must be between ₹${MIN_WITHDRAWAL} and ₹${MAX_WITHDRAWAL}, in multiples of ₹${WITHDRAWAL_STEP}.`,
      },
      { status: 400 },
    );
  }
  if (method === "UPI" && !upiId) {
    return NextResponse.json({ error: "UPI ID is required." }, { status: 400 });
  }
  if (method === "BANK" && (!bankAccountName || !bankAccountNumber || !bankIfsc)) {
    return NextResponse.json({ error: "Account name, number, and IFSC are all required." }, { status: 400 });
  }

  // One pending withdrawal per worker at a time — confirmed V1 behavior,
  // preserved here. This is also what keeps the allocation logic in
  // lib/earnings.ts simple and race-free: with only ever one PENDING
  // withdrawal per worker, there's no way for two requests to compete for
  // the same earning's remaining balance.
  const existingPending = await prisma.withdrawal.findFirst({ where: { workerId: user.id, status: "PENDING" } });
  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a withdrawal request pending — wait for it to be processed first." },
      { status: 409 },
    );
  }

  const balance = await getWorkerBalance(user.id);
  if (balance.available < amount) {
    return NextResponse.json({ error: "That's more than your available balance." }, { status: 400 });
  }

  const settings = await getSettings();
  const fee = computeWithdrawalFee(amount, settings);

  try {
    const withdrawal = await prisma.$transaction(async (tx) => {
      const created = await tx.withdrawal.create({
        data: {
          workerId: user.id,
          amount: fee.amount,
          method,
          upiId: method === "UPI" ? upiId : null,
          bankAccountName: method === "BANK" ? bankAccountName : null,
          bankAccountNumber: method === "BANK" ? bankAccountNumber : null,
          bankIfsc: method === "BANK" ? bankIfsc : null,
          processingFee: fee.processingFee,
          netAmount: fee.netAmount,
        },
      });
      // Re-checked against the same invariant inside the transaction —
      // the getWorkerBalance() call above is what gives a fast, clean
      // error message; this is what actually has to be correct.
      await allocateEarningsForWithdrawal(tx, user.id, created.id, amount);
      return created;
    });

    await notify({
      userId: user.id,
      type: "withdrawal_requested",
      title: "Withdrawal requested",
      body: `Your request for ₹${amount.toLocaleString("en-IN")} is pending admin approval.`,
      data: { withdrawalId: withdrawal.id },
    });

    return NextResponse.json({ withdrawal });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "That's more than your available balance." }, { status: 400 });
    }
    throw err;
  }
}