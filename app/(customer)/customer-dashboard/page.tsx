import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { customerProfileCompletion } from "@/lib/profile-completion";

export default async function CustomerDashboardPage() {
  const user = await requireRole("CUSTOMER");
  const profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });

  const completion = customerProfileCompletion({
    phone: user.phone,
    gender: user.gender,
    addressLine: profile?.addressLine ?? null,
    city: profile?.city ?? null,
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>

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
            <a href="/customer-profile" className="underline">
              Complete your profile
            </a>
          </p>
        )}
      </section>

      <section className="rounded-lg border border-muted/20 p-5">
        <h2 className="font-medium">Coming in later Parts</h2>
        <p className="mt-1 text-sm text-muted">
          Nearby worker search and booking (Part 6–7), chat (Part 7), payments
          (Part 8), and reviews (Part 9) all land here once built — this page
          isn&apos;t hiding a finished feature, those parts just haven&apos;t
          been built yet.
        </p>
      </section>
    </div>
  );
}
