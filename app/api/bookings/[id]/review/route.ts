import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { submitReviewSchema } from "@/lib/chat-validators";
import { notify } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("CUSTOMER");
  if (response) return response;

  const { id } = await params;
  const { allowed } = await rateLimit(`review:${user.id}`, 20, 60 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = submitReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id }, include: { review: true } });
  if (!booking || booking.customerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "COMPLETED") {
    return NextResponse.json({ error: "You can only review a completed job." }, { status: 409 });
  }
  if (booking.review) {
    return NextResponse.json({ error: "You've already reviewed this booking." }, { status: 409 });
  }
  if (!booking.workerId) {
    return NextResponse.json({ error: "This booking has no worker to review." }, { status: 409 });
  }
  const workerId = booking.workerId;

  const review = await prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        bookingId: id,
        customerId: user.id,
        workerId,
        rating: parsed.data.rating,
        comment: parsed.data.comment,
      },
    });
    // Recomputed from a real aggregate rather than an incremental running
    // average — self-correcting against any drift, and at this scale
    // (reviews per worker) the extra query is cheap.
    const agg = await tx.review.aggregate({ where: { workerId }, _avg: { rating: true }, _count: true });
    await tx.workerProfile.update({
      where: { userId: workerId },
      data: {
        rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
        reviewCount: agg._count,
      },
    });
    return created;
  });

  await notify({
    userId: workerId,
    type: "review_received",
    title: "New review",
    body: `You received a ${parsed.data.rating}-star review.`,
    data: { bookingId: id },
  });

  return NextResponse.json({ review });
}