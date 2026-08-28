import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const url = new URL(request.url);
  const jobPostId = url.searchParams.get("jobPostId");

  const isCustomer = user.role === "CUSTOMER";
  const roleWhere = isCustomer ? { customerId: user.id } : { workerId: user.id };

  const conversations = await prisma.conversation.findMany({
    where: { ...roleWhere, ...(jobPostId ? { jobPostId } : {}) },
    include: {
      customer: { select: { id: true, name: true, image: true } },
      worker: { select: { id: true, name: true, image: true } },
      jobPost: { select: { id: true, title: true, status: true } },
      booking: { select: { id: true, status: true, finalPrice: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const withUnread = conversations.map((c: (typeof conversations)[number]) => {
    const lastMessage = c.messages[0] ?? null;
    const lastReadAt = isCustomer ? c.customerLastReadAt : c.workerLastReadAt;
    const hasUnread = Boolean(
      lastMessage && lastMessage.senderId !== user.id && (!lastReadAt || lastMessage.createdAt > lastReadAt),
    );
    return {
      id: c.id,
      status: c.status,
      customer: c.customer,
      worker: c.worker,
      jobPost: c.jobPost,
      booking: c.booking,
      updatedAt: c.updatedAt,
      lastMessage,
      hasUnread,
    };
  });

  return NextResponse.json({ conversations: withUnread });
}