import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/**
 * A system-wide recent-activity feed, not a per-user inbox (that already
 * exists at /notifications). The master prompt lists "Notifications" as
 * an Admin Panel module without elaborating further; this is the most
 * defensible reading that doesn't invent a whole preferences system out
 * of scope for this Part.
 */
export async function GET() {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const notifications = await prisma.notification.findMany({
    include: { user: { select: { name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ notifications });
}