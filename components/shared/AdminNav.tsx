/** File Path: components/shared/AdminNav.tsx */

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Wrench,
  Tags,
  CalendarCheck,
  CreditCard,
  Wallet,
  Star,
  Bell,
  AlertTriangle,
  ScrollText,
  Settings,
  LifeBuoy,
  Menu,
  X,
} from "lucide-react";
import { LogoutButton } from "@/components/shared/LogoutButton";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/workers", label: "Workers", icon: Wrench },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/errors", label: "Errors", icon: AlertTriangle },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav({ userName, role }: { userName: string; role: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-muted/20">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-sm font-semibold">
            HYS Admin
          </Link>
          <span className="rounded-full bg-muted/10 px-2 py-0.5 text-xs text-muted">{role}</span>
        </div>

        <div className="hidden items-center gap-4 text-sm sm:flex">
          <span className="text-muted">{userName}</span>
          <LogoutButton />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-muted/30 sm:hidden"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <nav className={`${open ? "flex" : "hidden"} flex-col gap-1 border-t border-muted/20 px-3 py-3 sm:flex sm:flex-row sm:flex-wrap sm:gap-2 sm:px-6`}>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted hover:bg-muted/10 hover:text-foreground sm:py-1.5"
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        ))}
        <div className="mt-2 flex items-center justify-between border-t border-muted/20 px-2 pt-3 sm:hidden">
          <span className="text-sm text-muted">{userName}</span>
          <LogoutButton />
        </div>
      </nav>
    </header>
  );
}