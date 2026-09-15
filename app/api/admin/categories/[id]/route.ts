import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { logAdminAction } from "@/lib/audit-log";

const updateSchema = z.object({
  isApproved: z.boolean().optional(),
  name: z.string().min(2).max(60).optional(),
  icon: z.string().max(60).nullish(),
});

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
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.name && parsed.data.name !== category.name) {
    const nameTaken = await prisma.category.findUnique({ where: { name: parsed.data.name } });
    if (nameTaken) return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
  }

  const updated = await prisma.category.update({ where: { id }, data: parsed.data });

  await logAdminAction({
    actorId: user.id,
    action: parsed.data.isApproved === true ? "category.approve" : "category.update",
    entity: "Category",
    entityId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ category: updated });
}