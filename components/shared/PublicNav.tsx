"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/shared/LogoutButton";

type Viewer = { name: string; role: "CUSTOMER" | "WORKER" | "ADMIN" | "SUPER_ADMIN" } | null;

const DASHBOARD_PATH: Record<string, string> = {
  CUSTOMER: "/customer-dashboard",
  WORKER: "/worker-dashboard",
  ADMIN: "/admin",
  SUPER_ADMIN: "/admin",
};

export function PublicNav({ viewer }: { viewer: Viewer }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-muted/20">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold">
            HYS Services
          </Link>
          <nav className="hidden gap-4 text-sm sm:flex">
            <Link href="/services" className="text-muted hover:text-foreground">
              Find a worker
            </Link>
            {viewer?.role === "CUSTOMER" && (
              <Link href="/post-job" className="text-muted hover:text-foreground">
                Post a job
              </Link>
            )}
            {viewer?.role === "WORKER" && (
              <Link href="/job-board" className="text-muted hover:text-foreground">
                Job board
              </Link>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-4 text-sm sm:flex">
          {viewer ? (
            <>
              <Link href={DASHBOARD_PATH[viewer.role]} className="font-medium">
                Dashboard
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-muted hover:text-foreground">
                Log in
              </Link>
              <Link href="/get-started" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-muted/30 sm:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-muted/20 px-4 py-3 sm:hidden">
          <Link href="/services" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm hover:bg-muted/10">
            Find a worker
          </Link>
          {viewer?.role === "CUSTOMER" && (
            <Link href="/post-job" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm hover:bg-muted/10">
              Post a job
            </Link>
          )}
          {viewer?.role === "WORKER" && (
            <Link href="/job-board" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm hover:bg-muted/10">
              Job board
            </Link>
          )}
          {viewer ? (
            <div className="mt-2 flex items-center justify-between border-t border-muted/20 px-2 pt-3">
              <Link href={DASHBOARD_PATH[viewer.role]} onClick={() => setOpen(false)} className="text-sm font-medium">
                Dashboard
              </Link>
              <LogoutButton />
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-1 border-t border-muted/20 px-2 pt-3">
              <Link href="/auth/login" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm hover:bg-muted/10">
                Log in
              </Link>
              <Link href="/get-started" onClick={() => setOpen(false)} className="rounded-md px-2 py-2 text-sm hover:bg-muted/10">
                Sign up
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}