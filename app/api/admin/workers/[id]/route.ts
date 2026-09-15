import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { logAdminAction } from "@/lib/audit-log";
import { notify } from "@/lib/notifications";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const { id } = await params;
  const worker = await prisma.user.findUnique({
    where: { id, role: "WORKER" },
    include: {
      workerProfile: { include: { category: { select: { name: true } } } },
      bookingsAsWorker: {
        select: { id: true, status: true, description: true, finalPrice: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ worker });
}

const updateSchema = z.object({
  banned: z.boolean().optional(),
  banReason: z.string().max(300).optional(),
  isVerified: z.boolean().optional(),
});

/**
 * `isVerified` is set directly by admin here — a manual, single-mechanism
 * toggle, deliberately simpler than V1's three uncoordinated mechanisms
 * (Part 1 audit, Bug B7). Document-based verification (checking an
 * actually-uploaded ID) becomes possible once Part 11 (Storage) lets a
 * worker upload one; this stays the mechanism until then, and is a
 * reasonable one to keep afterward too, alongside a document check
 * rather than instead of it.
 */
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

  const target = await prisma.user.findUnique({ where: { id, role: "WORKER" } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { banned, banReason, isVerified } = parsed.data;

  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data:
        banned === undefined
          ? {}
          : { banned, banReason: banned ? (banReason ?? null) : null },
    }),
    ...(isVerified === undefined
      ? []
      : [prisma.workerProfile.update({ where: { userId: id }, data: { isVerified } })]),
  ]);

  if (isVerified === true) {
    await notify({
      userId: id,
      type: "worker_verified",
      title: "You're verified",
      body: "Your account has been verified by the HYS Services team.",
    });
  }

  await logAdminAction({
    actorId: user.id,
    action: "worker.update",
    entity: "User",
    entityId: id,
    metadata: parsed.data,
  });

  return NextResponse.json({ worker: updatedUser });
}