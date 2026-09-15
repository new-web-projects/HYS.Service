import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoleApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { getSettings } from "@/lib/settings";
import { refreshMaintenanceCache } from "@/lib/maintenance";
import { logAdminAction } from "@/lib/audit-log";

export async function GET() {
  const { response } = await requireRoleApi(["ADMIN", "SUPER_ADMIN"]);
  if (response) return response;

  const settings = await getSettings();
  return NextResponse.json({ settings });
}

const settingsUpdateSchema = z.object({
  siteName: z.string().min(1).max(100).optional(),
  siteLogoUrl: z.string().url().max(500).nullish(),
  platformFeeType: z.enum(["percent", "fixed"]).optional(),
  platformFeePercent: z.number().min(0).max(100).optional(),
  platformFeeFixed: z.number().min(0).optional(),
  gstPercent: z.number().min(0).max(100).optional(),
  gstDisplayMode: z.boolean().optional(),
  withdrawalFeePercent: z.number().min(0).max(100).optional(),
  razorpayEnabled: z.boolean().optional(),
  phonepeEnabled: z.boolean().optional(),
  paytmEnabled: z.boolean().optional(),
  paymentMode: z.enum(["TEST", "LIVE"]).optional(),
  storageProvider: z.enum(["CLOUDINARY", "S3"]).optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).nullish(),
  errorRevealEnabled: z.boolean().optional(),
});

/**
 * SUPER_ADMIN only, not plain ADMIN — this endpoint controls money
 * (platform fee, GST, withdrawal fee), which live payment gateways are
 * reachable by customers, and whether the entire site is down. A regular
 * ADMIN can view everything above through GET but can't change any of it.
 */
export async function PATCH(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireRoleApi("SUPER_ADMIN");
  if (response) return response;

  const body = await request.json().catch(() => null);
  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No changes provided." }, { status: 400 });
  }

  await getSettings(); // ensures the singleton row exists before we update it
  const settings = await prisma.settings.update({ where: { id: "global" }, data: parsed.data });

  if ("maintenanceMode" in parsed.data || "maintenanceMessage" in parsed.data) {
    await refreshMaintenanceCache({ enabled: settings.maintenanceMode, message: settings.maintenanceMessage });
  }

  await logAdminAction({
    actorId: user.id,
    action: "settings.update",
    entity: "Settings",
    entityId: "global",
    metadata: parsed.data,
  });

  return NextResponse.json({ settings });
}