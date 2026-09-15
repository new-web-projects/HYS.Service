import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  const customers = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      banned: true,
      createdAt: true,
      customerProfile: { select: { city: true } },
      _count: { select: { bookingsAsCustomer: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ customers });
}