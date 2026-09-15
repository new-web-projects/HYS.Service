import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const reports = await prisma.errorReport.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ reports });
}