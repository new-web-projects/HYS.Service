import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { selectWorkerSchema } from "@/lib/chat-validators";
import { notify } from "@/lib/notifications";
import { getIO } from "@/lib/socket-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("CUSTOMER");
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = selectWorkerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const jobPost = await prisma.jobPost.findUnique({ where: { id } });
  if (!jobPost || jobPost.customerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (jobPost.status !== "OPEN") {
    return NextResponse.json({ error: "This job post has already been filled or closed." }, { status: 409 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: parsed.data.conversationId },
  });
  if (!conversation || conversation.jobPostId !== id || !conversation.workerId) {
    return NextResponse.json({ error: "That conversation doesn't belong to this job post." }, { status: 400 });
  }

  let result: { booking: { id: string }; otherWorkerIds: string[] };
  try {
    result = await prisma.$transaction(async (tx: typeof prisma) => {
      const booking = await tx.booking.create({
        data: {
          origin: "JOB_POST",
          customerId: user.id,
          workerId: conversation.workerId!,
          jobPostId: id,
          // JOB_POST bookings skip PENDING_RESPONSE entirely — the worker
          // already opted in by expressing interest and chatting, unlike
          // a DIRECT booking the worker hasn't seen yet.
          status: "DISCUSSING",
          description: jobPost.description,
          address: jobPost.addressLine || "See job post for location details",
          scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
          basePrice: conversation.proposedPrice ?? 0,
        },
      });
      await tx.conversation.update({ where: { id: conversation.id }, data: { bookingId: booking.id } });
      await tx.jobPost.update({ where: { id }, data: { status: "FILLED" } });

      const others = await tx.conversation.findMany({
        where: { jobPostId: id, id: { not: conversation.id } },
        select: { id: true, workerId: true },
      });
      await tx.conversation.updateMany({
        where: { jobPostId: id, id: { not: conversation.id } },
        data: { status: "CLOSED" },
      });

      return {
        booking,
        otherWorkerIds: others
          .map((o: { workerId: string | null }) => o.workerId)
          .filter((wid: string | null): wid is string => Boolean(wid)),
      };
    });
  } catch (err: unknown) {
    // Booking.jobPostId is @unique in the schema — the real safety net
    // against two near-simultaneous "select" calls both succeeding. This
    // catch only turns that DB-level rejection into a clean response
    // instead of an unhandled 500; it isn't what prevents the double
    // booking, the constraint already did that.
    const code = (err as { code?: string } | null)?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "This job was just filled — someone else was selected a moment ago." },
        { status: 409 },
      );
    }
    throw err;
  }
  const { booking, otherWorkerIds } = result;

  await notify({
    userId: conversation.workerId!,
    type: "job_selected",
    title: "You got the job!",
    body: `${user.name} selected you for "${jobPost.title}". Head to the chat to confirm details.`,
    data: { bookingId: booking.id, conversationId: conversation.id },
  });

  for (const workerId of otherWorkerIds) {
    await notify({
      userId: workerId,
      type: "job_filled",
      title: "Job filled",
      body: `"${jobPost.title}" was filled by another worker.`,
      data: { jobPostId: id },
    });
  }

  const io = getIO();
  io?.to(`conversation:${conversation.id}`).emit("booking-updated", { bookingId: booking.id, status: "DISCUSSING" });
  for (const other of otherWorkerIds) {
    io?.to(`user:${other}`).emit("notification", { type: "job_filled", jobPostId: id });
  }

  return NextResponse.json({ booking }, { status: 201 });
}