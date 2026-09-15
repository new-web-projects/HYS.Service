import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { logAdminAction } from "@/lib/audit-log";

/**
 * Moderation delete — for abusive/fraudulent reviews. Recomputes the
 * worker's rating the same way lib/review submission does: a real
 * aggregate, not a reversed running average, so it can never drift.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id } });
    const agg = await tx.review.aggregate({ where: { workerId: review.workerId }, _avg: { rating: true }, _count: true });
    await tx.workerProfile.update({
      where: { userId: review.workerId },
      data: { rating: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
    });
  });

  await logAdminAction({
    actorId: user.id,
    action: "review.delete",
    entity: "Review",
    entityId: id,
    metadata: { workerId: review.workerId, rating: review.rating },
  });

  return NextResponse.json({ success: true });
}