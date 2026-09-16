/**
 * V1 had a profile-completion percentage on both dashboards but this audit
 * never recorded its exact per-field weights (see the Part 1 report) — this
 * is a reasonable reconstruction, not a byte-exact port. Documented here so
 * it's easy to adjust rather than guessed at silently.
 *
 * Profile photo now counts as of Part 11 (Storage) — it was excluded before
 * since there was no way to actually add one yet. Document verification
 * has counted since Part 5 via isVerified (the reviewed outcome, not
 * merely having uploaded something) and that stays unchanged: uploading a
 * document (Part 11) starts the review, it doesn't finish it.
 */

export type CompletionField = { label: string; complete: boolean };

export type CompletionResult = {
  percent: number;
  missing: string[];
};

function summarize(fields: CompletionField[]): CompletionResult {
  const complete = fields.filter((f) => f.complete).length;
  return {
    percent: Math.round((complete / fields.length) * 100),
    missing: fields.filter((f) => !f.complete).map((f) => f.label),
  };
}

export function customerProfileCompletion(input: {
  phone: string | null | undefined;
  gender: string | null | undefined;
  addressLine: string | null | undefined;
  city: string | null | undefined;
  image: string | null | undefined;
}): CompletionResult {
  return summarize([
    { label: "Phone number", complete: Boolean(input.phone) },
    { label: "Gender", complete: Boolean(input.gender) },
    { label: "Address", complete: Boolean(input.addressLine) },
    { label: "City", complete: Boolean(input.city) },
    { label: "Profile photo", complete: Boolean(input.image) },
  ]);
}

export function workerProfileCompletion(input: {
  phone: string | null | undefined;
  gender: string | null | undefined;
  bio: string | null | undefined;
  experienceDesc: string | null | undefined;
  addressLine: string | null | undefined;
  city: string | null | undefined;
  isVerified: boolean;
  skills: string[];
  image: string | null | undefined;
}): CompletionResult {
  return summarize([
    { label: "Phone number", complete: Boolean(input.phone) },
    { label: "Gender", complete: Boolean(input.gender) },
    { label: "Bio", complete: Boolean(input.bio) },
    { label: "Experience description", complete: Boolean(input.experienceDesc) },
    { label: "Address", complete: Boolean(input.addressLine) },
    { label: "City", complete: Boolean(input.city) },
    { label: "At least one skill", complete: input.skills.length > 0 },
    { label: "Document verification", complete: input.isVerified },
    { label: "Profile photo", complete: Boolean(input.image) },
  ]);
}

export type VerificationStatus = "not_started" | "pending" | "verified";

export function documentVerificationStatus(input: {
  documentType: string | null | undefined;
  documentVerifiedAt: Date | string | null | undefined;
}): VerificationStatus {
  if (input.documentVerifiedAt) return "verified";
  if (input.documentType) return "pending";
  return "not_started";
}

export const VERIFICATION_STATUS_LABEL: Record<VerificationStatus, string> = {
  not_started: "Not started",
  pending: "Pending review",
  verified: "Verified",
};