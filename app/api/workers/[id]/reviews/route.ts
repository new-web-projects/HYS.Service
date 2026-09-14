import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public — same posture as /api/workers/[id] and /api/workers/search,
// both unauthenticated, since reviews are shown on the public profile.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const reviews = await prisma.review.findMany({
    where: { workerId: id },
    include: { customer: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ reviews });
}