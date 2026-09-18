/** File Path: app/api/error-reports/route.ts */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-guard";
import { rejectCrossOrigin } from "@/lib/same-origin";
import { rateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const reportSchema = z.object({
  message: z.string().min(3).max(300),
  description: z.string().max(2000).optional(),
  route: z.string().max(500).optional(),
});

/**
 * "Users should be able to report errors. Reports must reach Admin
 * Panel" — this is deliberately a separate, user-authored ErrorReport,
 * not the same table the automatic error-boundary capture writes to
 * (ErrorLog). A report is something a person chose to tell you; a log
 * entry is something the app noticed on its own — conflating them would
 * bury the ones a person actually cared enough to describe.
 */
export async function POST(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "unknown";
  const user = await getCurrentUser().catch(() => null);
  const { allowed } = await rateLimit(`error-report:${user?.id ?? forwardedFor}`, 10, 60 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const report = await prisma.errorReport.create({
    data: {
      message: parsed.data.message,
      description: parsed.data.description,
      route: parsed.data.route,
      userId: user?.id,
    },
  });

  return NextResponse.json({ report });
}