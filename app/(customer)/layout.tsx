import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { LogoutButton } from "@/components/shared/LogoutButton";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CUSTOMER");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-muted/20 px-6 py-4">
        <nav className="flex gap-4 text-sm">
          <Link href="/" className="text-muted">
            HYS Services
          </Link>
          <Link href="/customer-dashboard" className="font-medium">
            Dashboard
          </Link>
          <Link href="/customer-profile" className="text-muted">
            Profile
          </Link>
          <Link href="/customer-account" className="text-muted">
            Account
          </Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted">{user.name}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
