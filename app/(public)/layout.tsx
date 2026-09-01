import { getCurrentUser } from "@/lib/auth-guard";
import { PublicNav } from "@/components/shared/PublicNav";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav viewer={user ? { name: user.name, role: user.role } : null} />
      <div className="flex-1">{children}</div>
    </div>
  );
}