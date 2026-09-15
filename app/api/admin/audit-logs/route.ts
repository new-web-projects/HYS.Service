import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const url = new URL(request.url);
  const entity = url.searchParams.get("entity")?.trim();

  const logs = await prisma.auditLog.findMany({
    where: entity ? { entity } : {},
    include: { actor: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  });
  return NextResponse.json({ logs });
}