import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { expressInterestSchema } from "@/lib/chat-validators";
import { notify } from "@/lib/notifications";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const limit = await rateLimit(`jobpost:interest:${user.id}`, 30, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many quotes sent. Try again later." }, { status: 429 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = expressInterestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const jobPost = await prisma.jobPost.findUnique({ where: { id } });
  if (!jobPost || jobPost.status !== "OPEN") {
    return NextResponse.json({ error: "This job post is no longer open." }, { status: 409 });
  }

  const existing = await prisma.conversation.findUnique({
    where: { jobPostId_workerId: { jobPostId: id, workerId: user.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "You've already expressed interest in this job." }, { status: 409 });
  }

  const conversation = await prisma.$transaction(async (tx: typeof prisma) => {
    const conversation = await tx.conversation.create({
      data: {
        customerId: jobPost.customerId,
        workerId: user.id,
        jobPostId: id,
        status: "PRICE_PROPOSED",
        proposedPrice: parsed.data.price,
      },
    });
    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: user.id,
        type: "PRICE_PROPOSAL",
        content: parsed.data.message,
        priceAmount: parsed.data.price,
      },
    });
    return conversation;
  });

  await notify({
    userId: jobPost.customerId,
    type: "job_interest",
    title: "New quote on your job post",
    body: `${user.name} quoted ₹${parsed.data.price} for "${jobPost.title}"`,
    data: { jobPostId: id, conversationId: conversation.id },
  });

  return NextResponse.json({ conversation }, { status: 201 });
}