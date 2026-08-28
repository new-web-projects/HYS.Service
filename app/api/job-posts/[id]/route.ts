import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const jobPost = await prisma.jobPost.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, icon: true } } },
  });
  if (!jobPost) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = jobPost.customerId === user.id;

  if (isOwner) {
    const conversations = await prisma.conversation.findMany({
      where: { jobPostId: id },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            image: true,
            workerProfile: { select: { rating: true, reviewCount: true, isVerified: true, experienceYears: true } },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ jobPost, viewerRole: "owner", conversations });
  }

  if (user.role !== "WORKER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const myConversation = await prisma.conversation.findUnique({
    where: { jobPostId_workerId: { jobPostId: id, workerId: user.id } },
    select: { id: true, status: true },
  });

  return NextResponse.json({ jobPost, viewerRole: "worker", myConversation });
}