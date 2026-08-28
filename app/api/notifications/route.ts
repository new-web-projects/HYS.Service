import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectCrossOrigin } from "@/lib/same-origin";

export async function GET(request: Request) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: user.id, readAt: null } });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  const originRejection = rejectCrossOrigin(request);
  if (originRejection) return originRejection;

  const { user, response } = await requireUserApi();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;

  if (id) {
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  } else {
    // No id: mark everything read (the notification bell's "mark all read").
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}