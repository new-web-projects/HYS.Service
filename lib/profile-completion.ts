/**
 * V1 had a profile-completion percentage on both dashboards but this audit
 * never recorded its exact per-field weights (see the Part 1 report) — this
 * is a reasonable reconstruction, not a byte-exact port. Documented here so
 * it's easy to adjust rather than guessed at silently.
 *
 * Two fields that would normally count (profile photo, verification
 * document) are excluded from the denominator entirely until Part 11
 * (Storage) exists — an unreachable field would only ever show as
 * permanently missing, which is misleading rather than honest about what's
 * actually available to complete right now.
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
}): CompletionResult {
  return summarize([
    { label: "Phone number", complete: Boolean(input.phone) },
    { label: "Gender", complete: Boolean(input.gender) },
    { label: "Address", complete: Boolean(input.addressLine) },
    { label: "City", complete: Boolean(input.city) },
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
  ]);
}
