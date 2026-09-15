import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { logAdminAction } from "@/lib/audit-log";

const updateSchema = z.object({ status: z.enum(["open", "investigating", "resolved", "wont_fix"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const report = await prisma.errorReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.errorReport.update({ where: { id }, data: { status: parsed.data.status } });

  await logAdminAction({
    actorId: user.id,
    action: "error_report.update_status",
    entity: "ErrorReport",
    entityId: id,
    metadata: { status: parsed.data.status },
  });

  return NextResponse.json({ report: updated });
}