import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  workerProfileCompletion,
  documentVerificationStatus,
  VERIFICATION_STATUS_LABEL,
} from "@/lib/profile-completion";
import { getUnreadChatCount } from "@/lib/notifications";

export default async function WorkerDashboardPage() {
  const user = await requireRole("WORKER");
  const profile = await prisma.workerProfile.findUnique({ where: { userId: user.id } });

  if (!profile) {
    return <p className="text-sm text-red-600">Worker profile not found. Contact support.</p>;
  }

  const completion = workerProfileCompletion({
    phone: user.phone,
    gender: user.gender,
    bio: profile.bio,
    experienceDesc: profile.experienceDesc,
    addressLine: profile.addressLine,
    city: profile.city,
    isVerified: profile.isVerified,
    skills: profile.skills,
  });

  const [pendingCount, activeBookings, unreadCount, unreadChatCount] = await Promise.all([
    prisma.booking.count({ where: { workerId: user.id, status: "PENDING_RESPONSE" } }),
    prisma.booking.findMany({
      where: { workerId: user.id, status: { in: ["DISCUSSING", "PRICE_PENDING", "READY_FOR_PAYMENT", "PAID"] } },
      include: { customer: { select: { name: true } }, conversation: { select: { id: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    getUnreadChatCount(user.id, "WORKER"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <div className="flex items-center gap-4">
          <Link href="/chats" className="relative text-sm underline text-muted">
            Chats
            {unreadChatCount > 0 && (
              <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                {unreadChatCount}
              </span>
            )}
          </Link>
          <Link href="/notifications" className="text-sm underline text-muted">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                {unreadCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-muted/20 p-4">
          <p className="text-xs text-muted">Availability</p>
          <p className="mt-1 font-medium">{profile.isAvailable ? "Available" : "Unavailable"}</p>
        </div>
        <div className="rounded-lg border border-muted/20 p-4">
          <p className="text-xs text-muted">Verification</p>
          <p className="mt-1 font-medium">
            {
              VERIFICATION_STATUS_LABEL[
                documentVerificationStatus({
                  documentType: profile.documentType,
                  documentVerifiedAt: profile.documentVerifiedAt,
                })
              ]
            }
          </p>
        </div>
        <div className="rounded-lg border border-muted/20 p-4">
          <p className="text-xs text-muted">Rating</p>
          <p className="mt-1 font-medium">
            {profile.reviewCount > 0 ? `${profile.rating} (${profile.reviewCount})` : "No reviews yet"}
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-muted/20 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">
            Booking requests{pendingCount > 0 && ` (${pendingCount} new)`}
          </h2>
          <Link href="/worker-bookings" className="text-sm underline">
            View all
          </Link>
        </div>
        {activeBookings.length === 0 && pendingCount === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing right now.{" "}
            <Link href="/job-board" className="underline">
              Browse the job board
            </Link>{" "}
            for open jobs in your category.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {activeBookings.map((b: (typeof activeBookings)[number]) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <span>{b.customer.name}</span>
                {b.conversation && (
                  <Link href={`/chat/${b.conversation.id}`} className="underline">
                    Chat
                  </Link>
                )}
              </li>
            ))}
            {pendingCount > 0 && (
              <li>
                <Link href="/worker-bookings" className="text-sm font-medium text-accent underline">
                  {pendingCount} pending {pendingCount === 1 ? "request needs" : "requests need"} a response →
                </Link>
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-muted/20 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Profile completion</h2>
          <span className="text-sm text-muted">{completion.percent}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted/20">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${completion.percent}%` }}
          />
        </div>
        {completion.missing.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            Still missing: {completion.missing.join(", ")}.{" "}
            <Link href="/worker-profile" className="underline">
              Complete your profile
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-muted/20 p-5">
        <h2 className="font-medium">Coming in later Parts</h2>
        <p className="mt-1 text-sm text-muted">
          Earnings and withdrawals (Part 9), and document upload for
          verification (Part 11) — that one needs a storage provider that
          isn&apos;t configured until then, so it stays a manual/admin
          process until it is.
        </p>
      </section>
    </div>
  );
}