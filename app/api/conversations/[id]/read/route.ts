import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { getIO } from "@/lib/socket-server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { customerId: true, workerId: true },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isCustomer = user.id === conversation.customerId;
  const isWorker = user.id === conversation.workerId;
  if (!isCustomer && !isWorker) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  await prisma.conversation.update({
    where: { id },
    data: isCustomer ? { customerLastReadAt: now } : { workerLastReadAt: now },
  });

  getIO()?.to(`conversation:${id}`).emit("read-receipt", { userId: user.id, readAt: now.toISOString() });

  return NextResponse.json({ readAt: now.toISOString() });
}