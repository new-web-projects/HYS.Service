import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, image: true } },
      worker: { select: { id: true, name: true, image: true } },
      jobPost: { select: { id: true, title: true, status: true } },
      booking: {
        select: {
          id: true,
          status: true,
          description: true,
          basePrice: true,
          finalPrice: true,
          platformFee: true,
          gstAmount: true,
        },
      },
    },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conversation.customerId !== user.id && conversation.workerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ conversation, viewerRole: user.id === conversation.customerId ? "customer" : "worker" });
}