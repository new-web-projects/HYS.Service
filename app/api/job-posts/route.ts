import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { createJobPostSchema } from "@/lib/chat-validators";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mine = url.searchParams.get("mine") === "true";

  if (mine) {
    // A customer viewing their own posts, any status — not the worker
    // job-board browsing view below, which is OPEN-only.
    const { user, response } = await requireRoleApi("CUSTOMER");
    if (response) return response;
    const jobPosts = await prisma.jobPost.findMany({
      where: { customerId: user.id },
      include: { category: { select: { id: true, name: true } }, _count: { select: { conversations: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ jobPosts });
  }

  const { response } = await requireRoleApi("WORKER");
  if (response) return response;

  const categoryId = url.searchParams.get("categoryId");
  const jobPosts = await prisma.jobPost.findMany({
    where: { status: "OPEN", ...(categoryId ? { categoryId } : {}) },
    include: {
      customer: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      _count: { select: { conversations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ jobPosts });
}

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("CUSTOMER");
  if (response) return response;

  const limit = await rateLimit(`jobpost:create:${user.id}`, 5, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many job posts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createJobPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const category = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || !category.isApproved) {
    return NextResponse.json({ error: "Select a valid category." }, { status: 400 });
  }

  const jobPost = await prisma.jobPost.create({
    data: { ...parsed.data, customerId: user.id, status: "OPEN" },
  });

  return NextResponse.json({ jobPost }, { status: 201 });
}