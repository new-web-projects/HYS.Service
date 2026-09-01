import { requireRole } from "@/lib/auth-guard";
import { WorkerNav } from "@/components/shared/WorkerNav";

export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("WORKER");

  return (
    <div className="flex min-h-screen flex-col">
      <WorkerNav userName={user.name} />
      <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}