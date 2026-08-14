import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleApi } from "@/lib/auth-guard";
import { rejectCrossOrigin } from "@/lib/same-origin";

const bodySchema = z.object({ isAvailable: z.boolean() });

export async function PATCH(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("WORKER");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "isAvailable must be true or false." }, { status: 400 });
  }

  await prisma.workerProfile.update({
    where: { userId: user.id },
    data: { isAvailable: parsed.data.isAvailable },
  });

  return NextResponse.json({ ok: true, isAvailable: parsed.data.isAvailable });
}
