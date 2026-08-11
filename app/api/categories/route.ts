import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Deliberately minimal — read-only, approved categories only. Part 6
 * ("Categories + Location + Service Marketplace") owns the real category
 * system (admin create/approve/manage, icons, service-page filtering).
 * This exists now only because worker signup needs a category list today.
 */
export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isApproved: true },
    select: { id: true, name: true, slug: true, icon: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}
