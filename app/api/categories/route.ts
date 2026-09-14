import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Deliberately minimal — read-only, approved categories only. Admin
 * create/approve/manage and icons are Part 10's job (Admin Panel); this
 * exists now only because worker signup and service-page filtering need
 * a category list today.
 */
export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isApproved: true },
    select: { id: true, name: true, slug: true, icon: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ categories });
}