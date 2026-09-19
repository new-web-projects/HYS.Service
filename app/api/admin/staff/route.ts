/** File Path: app/api/admin/staff/route.ts */

import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ staff });
}