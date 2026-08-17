import { requireRole } from "@/lib/auth-guard";
import { ChangePasswordForm } from "@/components/shared/ChangePasswordForm";

export default async function WorkerAccountPage() {
  const user = await requireRole("WORKER");

  return (
    <div className="flex max-w-md flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Account settings</h1>
        <p className="mt-1 text-sm text-muted">Signed in as {user.email}</p>
      </div>

      <section>
        <h2 className="font-medium">Change password</h2>
        <div className="mt-3">
          <ChangePasswordForm />
        </div>
      </section>

      <section>
        <h2 className="font-medium">Notifications</h2>
        <p className="mt-1 text-sm text-muted">
          Notification preferences arrive with the notification system
          itself (Part 12) — nothing to configure yet.
        </p>
      </section>
    </div>
  );
}
