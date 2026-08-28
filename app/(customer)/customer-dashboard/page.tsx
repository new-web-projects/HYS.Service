import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { customerProfileCompletion } from "@/lib/profile-completion";

const STATUS_LABEL: Record<string, string> = {
  PENDING_RESPONSE: "Waiting for worker",
  DISCUSSING: "Chat open",
  PRICE_PENDING: "Price pending",
  READY_FOR_PAYMENT: "Ready for payment",
  PAID: "Paid",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function CustomerDashboardPage() {
  const user = await requireRole("CUSTOMER");
  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });

  const completion = customerProfileCompletion({
    phone: user.phone,
    gender: user.gender,
    addressLine: profile?.addressLine ?? null,
    city: profile?.city ?? null,
  });

  const [recentBookings, unreadCount] = await Promise.all([
    prisma.booking.findMany({
      where: { customerId: user.id },
      include: { worker: { select: { name: true } }, conversation: { select: { id: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <Link href="/notifications" className="relative text-sm underline text-muted">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>

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
            <Link href="/customer-profile" className="underline">
              Complete your profile
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-muted/20 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Recent bookings</h2>
          <Link href="/customer-bookings" className="text-sm underline">
            View all
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No bookings yet.{" "}
            <Link href="/services" className="underline">
              Find a worker
            </Link>{" "}
            or{" "}
            <Link href="/post-job" className="underline">
              post a job
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {recentBookings.map((b: (typeof recentBookings)[number]) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <span>{b.worker?.name ?? "Worker"}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{STATUS_LABEL[b.status] ?? b.status}</span>
                  {b.conversation && (
                    <Link href={`/chat/${b.conversation.id}`} className="underline">
                      Chat
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-muted/20 p-5">
        <h2 className="font-medium">Coming in later Parts</h2>
        <p className="mt-1 text-sm text-muted">
          Payments (Part 8) and reviews (Part 9) land here once built —
          booking and chat are live now.
        </p>
      </section>
    </div>
  );
}