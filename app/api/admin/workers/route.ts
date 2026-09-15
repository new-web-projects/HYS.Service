import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const verifiedParam = url.searchParams.get("verified");

  const workers = await prisma.user.findMany({
    where: {
      role: "WORKER",
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      ...(verifiedParam ? { workerProfile: { isVerified: verifiedParam === "true" } } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      banned: true,
      createdAt: true,
      workerProfile: {
        select: { category: { select: { name: true } }, isVerified: true, isAvailable: true, rating: true, reviewCount: true, ordersCompleted: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ workers });
}