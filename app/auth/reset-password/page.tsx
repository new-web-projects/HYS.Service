"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is invalid or has expired. Request a new one.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) {
        setError(
          resetError.status === 429
            ? "Too many attempts. Try again later."
            : "This reset link is invalid or has expired. Request a new one.",
        );
        return;
      }
      router.push("/auth/login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        New password
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-muted/30 px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      {/* useSearchParams() (reading ?token=) requires a Suspense boundary
          for static prerendering — without this, `next build` fails with
          "useSearchParams() should be wrapped in a suspense boundary".
          Caught by an actual build, not by inspection. */}
      <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
