"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: reqError } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/auth/reset-password",
      });
      // Deliberately shown on failure too (aside from a genuine rate-limit
      // hit) — confirming or denying an account exists here is exactly the
      // email-enumeration risk V1's check-email endpoint worked around for
      // *login* specifically; a password-reset form has no equivalent
      // legitimate need to distinguish the two, so it always says the same
      // thing.
      if (reqError && reqError.status === 429) {
        setError("Too many requests. Try again later.");
      } else {
        setSent(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted">
          If an account exists for {email}, a reset link is on its way.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </main>
  );
}
