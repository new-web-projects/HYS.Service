import { requireRole } from "@/lib/auth-guard";
import { AdminNav } from "@/components/shared/AdminNav";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["ADMIN", "SUPER_ADMIN"]);

  return (
    <div className="flex min-h-screen flex-col">
      <AdminNav userName={user.name} role={user.role} />
      <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}