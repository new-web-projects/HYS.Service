import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import {
  workerProfileCompletion,
  documentVerificationStatus,
  VERIFICATION_STATUS_LABEL,
} from "@/lib/profile-completion";

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

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>

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
          Booking requests and chat (Part 7), earnings and withdrawals (Part
          9), and document upload for verification (Part 11) all land here
          once built.
        </p>
      </section>
    </div>
  );
}
