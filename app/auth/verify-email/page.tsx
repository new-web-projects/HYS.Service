export default function VerifyEmailPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Email verified</h1>
      <p className="text-sm text-muted">
        Your email is confirmed. You can log in now.
      </p>
      <a
        href="/auth/login"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Log in
      </a>
    </main>
  );
}
