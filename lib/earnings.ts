import { prisma, type TransactionClient } from "@/lib/prisma";
import type { Settings } from "@/lib/generated/prisma/client";

export const MIN_WITHDRAWAL = 1000;
export const MAX_WITHDRAWAL = 20000;
export const WITHDRAWAL_STEP = 1000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isValidWithdrawalAmount(amount: number): boolean {
  return (
    Number.isFinite(amount) &&
    amount >= MIN_WITHDRAWAL &&
    amount <= MAX_WITHDRAWAL &&
    amount % WITHDRAWAL_STEP === 0
  );
}

export type WithdrawalFeeBreakdown = {
  amount: number;
  processingFee: number;
  gstPortionOfFee: number;
  netAmount: number;
};

/**
 * Processing fee is GST-inclusive (business rule: "processing fee must
 * already include 18% GST") — withdrawalFeePercent is the full rate the
 * worker pays, not a base rate GST gets added on top of. gstPortionOfFee
 * is backed out of that inclusive fee purely for the "GST included in
 * processing fee" display line the worker must be shown — it is not an
 * additional charge.
 */
export function computeWithdrawalFee(
  amount: number,
  settings: Pick<Settings, "withdrawalFeePercent" | "gstPercent">,
): WithdrawalFeeBreakdown {
  const feePercent = Number(settings.withdrawalFeePercent);
  const gstPercent = Number(settings.gstPercent);
  const processingFee = round2((amount * feePercent) / 100);
  const gstPortionOfFee = round2((processingFee * gstPercent) / (100 + gstPercent));
  const netAmount = round2(amount - processingFee);
  return { amount: round2(amount), processingFee, gstPortionOfFee, netAmount };
}

export type BalanceSummary = { held: number; available: number; reserved: number; withdrawn: number };

/**
 * `available` and `reserved` are both derived from AVAILABLE-status
 * earnings' remaining balance (amount minus every existing allocation
 * against it — rejected-withdrawal allocations are deleted immediately
 * by releaseWithdrawalAllocations, so they never linger here). For each
 * such earning, `remaining = amount - allocated` is genuinely unclaimed
 * money; the slice of `allocated` that belongs to a still-PENDING
 * withdrawal is `reserved`, everything else is free. The two never
 * overlap, so they can be summed independently without double-counting.
 * `withdrawn` is the lifetime total actually paid out — APPROVED
 * allocations only.
 */
export async function getWorkerBalance(workerId: string): Promise<BalanceSummary> {
  const [heldAgg, availableEarnings, withdrawnAgg] = await Promise.all([
    prisma.earning.aggregate({ where: { workerId, status: "HELD" }, _sum: { amount: true } }),
    prisma.earning.findMany({
      where: { workerId, status: "AVAILABLE" },
      select: {
        amount: true,
        allocations: { select: { amount: true, withdrawal: { select: { status: true } } } },
      },
    }),
    prisma.withdrawalAllocation.aggregate({
      where: { withdrawal: { workerId, status: "APPROVED" } },
      _sum: { amount: true },
    }),
  ]);

  let available = 0;
  let reserved = 0;
  for (const earning of availableEarnings) {
    const allocated = earning.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const remaining = Number(earning.amount) - allocated;
    const pendingHere = earning.allocations
      .filter((a) => a.withdrawal.status === "PENDING")
      .reduce((sum, a) => sum + Number(a.amount), 0);
    available += remaining;
    reserved += pendingHere;
  }

  return {
    held: round2(Number(heldAgg._sum.amount ?? 0)),
    available: round2(available),
    reserved: round2(reserved),
    withdrawn: round2(Number(withdrawnAgg._sum.amount ?? 0)),
  };
}

/**
 * Called inside the same transaction that creates a Withdrawal row.
 * Selects AVAILABLE earnings oldest-first, creating WithdrawalAllocation
 * rows until `amount` is fully covered. Throws INSUFFICIENT_BALANCE
 * (aborting the transaction) if it can't — the caller should already
 * have checked this with getWorkerBalance() for a clean error message;
 * this is the transactional re-check against the same invariant so
 * nothing can slip through between the two reads.
 *
 * An earning whose entire remaining balance gets consumed here flips to
 * RESERVED — purely a status/UI signal, since "AVAILABLE" and
 * "RESERVED" both resolve through the same amount-remaining math in
 * getWorkerBalance either way. The one earning that only needed a
 * *partial* allocation to finish covering `amount` stays AVAILABLE,
 * correctly reflecting that it still has a genuinely free remainder for
 * next time — this is what avoids ever needing to split an Earning row.
 */
export async function allocateEarningsForWithdrawal(
  tx: TransactionClient,
  workerId: string,
  withdrawalId: string,
  amount: number,
): Promise<void> {
  const earnings = await tx.earning.findMany({
    where: { workerId, status: "AVAILABLE" },
    include: { allocations: true },
    orderBy: { createdAt: "asc" },
  });

  let stillNeeded = amount;
  for (const earning of earnings) {
    if (stillNeeded <= 0) break;
    const alreadyAllocated = earning.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const remaining = round2(Number(earning.amount) - alreadyAllocated);
    if (remaining <= 0) continue;

    const take = round2(Math.min(remaining, stillNeeded));
    await tx.withdrawalAllocation.create({
      data: { withdrawalId, earningId: earning.id, amount: take },
    });
    if (round2(remaining - take) <= 0) {
      await tx.earning.update({ where: { id: earning.id }, data: { status: "RESERVED" } });
    }
    stillNeeded = round2(stillNeeded - take);
  }

  if (stillNeeded > 0) {
    throw new Error("INSUFFICIENT_BALANCE");
  }
}

/**
 * Reverses a rejected withdrawal's reservation: deletes its allocation
 * rows and puts every earning it touched back to AVAILABLE. Safe even
 * when an earning also carries older, already-APPROVED allocations from
 * a *previous* withdrawal (partial-consumption history) — only this
 * withdrawal's own rows are removed, so that history is untouched, and
 * the earning's remaining balance after removal is always > 0 (an
 * allocation amount is always positive), so AVAILABLE is always the
 * correct status to restore.
 */
export async function releaseWithdrawalAllocations(tx: TransactionClient, withdrawalId: string): Promise<void> {
  const allocations = await tx.withdrawalAllocation.findMany({
    where: { withdrawalId },
    select: { earningId: true },
  });
  await tx.withdrawalAllocation.deleteMany({ where: { withdrawalId } });
  const earningIds = [...new Set(allocations.map((a) => a.earningId))];
  if (earningIds.length > 0) {
    await tx.earning.updateMany({ where: { id: { in: earningIds } }, data: { status: "AVAILABLE" } });
  }
}

/**
 * Called after a Withdrawal is marked APPROVED. For each earning this
 * withdrawal drew from, flips it to WITHDRAWN once its remaining balance
 * (amount minus every allocation against it, this withdrawal's included)
 * reaches zero. An earning only partially drawn from stays AVAILABLE —
 * its genuine remainder is still there for a future withdrawal, which is
 * the entire point of tracking allocations instead of a single
 * earning-to-withdrawal link.
 */
export async function finalizeWithdrawalEarnings(tx: TransactionClient, withdrawalId: string): Promise<void> {
  const allocations = await tx.withdrawalAllocation.findMany({
    where: { withdrawalId },
    select: { earningId: true },
  });
  const earningIds = [...new Set(allocations.map((a) => a.earningId))];
  for (const earningId of earningIds) {
    const earning = await tx.earning.findUnique({ where: { id: earningId }, include: { allocations: true } });
    if (!earning || earning.status === "WITHDRAWN") continue;
    const allocated = earning.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const remaining = round2(Number(earning.amount) - allocated);
    if (remaining <= 0) {
      await tx.earning.update({ where: { id: earningId }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } });
    }
  }
}