import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { logAdminAction } from "@/lib/audit-log";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const customer = await prisma.user.findUnique({
    where: { id, role: "CUSTOMER" },
    include: {
      customerProfile: true,
      bookingsAsCustomer: {
        select: { id: true, status: true, description: true, finalPrice: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ customer });
}

const banSchema = z.object({
  banned: z.boolean(),
  banReason: z.string().max(300).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = banSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id, role: "CUSTOMER" } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data: { banned: parsed.data.banned, banReason: parsed.data.banned ? (parsed.data.banReason ?? null) : null },
  });

  await logAdminAction({
    actorId: user.id,
    action: parsed.data.banned ? "customer.ban" : "customer.unban",
    entity: "User",
    entityId: id,
    metadata: parsed.data.banReason ? { reason: parsed.data.banReason } : undefined,
  });

  return NextResponse.json({ customer: updated });
}