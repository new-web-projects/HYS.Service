import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { logAdminAction } from "@/lib/audit-log";

export async function GET() {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const categories = await prisma.category.findMany({
    include: { submittedBy: { select: { name: true } }, _count: { select: { workerProfiles: true } } },
    orderBy: [{ isApproved: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ categories });
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const createCategorySchema = z.object({
  name: z.string().min(2).max(60),
  icon: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const existingName = await prisma.category.findUnique({ where: { name: parsed.data.name } });
  if (existingName) {
    return NextResponse.json({ error: "A category with that name already exists." }, { status: 409 });
  }

  const baseSlug = slugify(parsed.data.name);
  const existing = await prisma.category.findUnique({ where: { slug: baseSlug } });
  const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  const category = await prisma.category.create({
    data: { name: parsed.data.name, slug, icon: parsed.data.icon, isApproved: true },
  });

  await logAdminAction({
    actorId: user.id,
    action: "category.create",
    entity: "Category",
    entityId: category.id,
    metadata: { name: category.name },
  });

  return NextResponse.json({ category });
}