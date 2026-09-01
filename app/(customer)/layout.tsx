import { requireRole } from "@/lib/auth-guard";
import { CustomerNav } from "@/components/shared/CustomerNav";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CUSTOMER");

  return (
    <div className="flex min-h-screen flex-col">
      <CustomerNav userName={user.name} />
      <main className="flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}