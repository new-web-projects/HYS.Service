"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/shared/LogoutButton";

const LINKS = [
  { href: "/worker-dashboard", label: "Dashboard" },
  { href: "/worker-profile", label: "Profile" },
  { href: "/worker-account", label: "Account" },
  { href: "/worker-bookings", label: "Bookings" },
  { href: "/job-board", label: "Job board" },
  { href: "/chats", label: "Chats" },
  { href: "/notifications", label: "Notifications" },
];

export function WorkerNav({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-muted/20">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold">
            HYS Services
          </Link>
          <nav className="hidden gap-4 text-sm lg:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-muted hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 text-sm lg:flex">
          <span className="text-muted">{userName}</span>
          <LogoutButton />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-muted/30 lg:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-muted/20 px-4 py-3 lg:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 text-sm hover:bg-muted/10"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-muted/20 px-2 pt-3">
            <span className="text-sm text-muted">{userName}</span>
            <LogoutButton />
          </div>
        </nav>
      )}
    </header>
  );
}