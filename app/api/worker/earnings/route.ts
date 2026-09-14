import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getWorkerBalance } from "@/lib/earnings";

export async function GET() {
  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const [balance, earnings] = await Promise.all([
    getWorkerBalance(user.id),
    prisma.earning.findMany({
      where: { workerId: user.id },
      include: { booking: { select: { description: true, customer: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ balance, earnings });
}