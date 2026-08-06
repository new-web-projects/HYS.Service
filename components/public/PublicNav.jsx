'use client';

import { useState, useEffect } from 'react';
import Link                    from 'next/link';
import { usePathname }         from 'next/navigation';
import { usePublicAuthStore }  from '@/store/publicAuthStore';

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function CloseMenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

// ── Main nav ──────────────────────────────────────────────────────────────────

export default function PublicNav() {
  const { user, logout } = usePublicAuthStore();
  const pathname         = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled,   setScrolled]   = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    handler();
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function isActive(href) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const dashboardHref =
    user?.role === 'worker'   ? '/worker-dashboard'  :
    user?.role === 'customer' ? '/customer-dashboard' :
    '/dashboard';

  return (
    <header
      className={`sticky top-0 z-40 bg-white transition-all duration-200
                  ${scrolled ? 'shadow-md' : 'border-b border-gray-100'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* ── Brand logo ───────────────────────────────────────────── */}
          {/*
            FIX:
            1. Removed gap-2 from the Link — it was putting a gap BETWEEN
               "HYS" and "." making them look separated.
            2. Removed `hidden sm:inline` from "Services" — it was hiding
               the word on all screens smaller than 640px (mobile).
            3. Added shrink-0 so the brand never gets squeezed by nav items.
            4. The dot now sits flush against "HYS" with no gap, then
               "Services" follows with ml-1.5 — matching the footer style.
          */}
          <Link
            href="/"
            className="flex items-center font-extrabold text-xl tracking-tight
                       text-gray-900 hover:opacity-80 transition-opacity shrink-0"
          >
            {/* "HYS" and "." are flush — no gap between them */}
            <span>HYS</span>
            <span className="text-blue-600">.</span>
            {/*
              "Services" is ALWAYS visible (no hidden class).
              ml-1.5 gives a small readable gap after the dot.
              text-gray-500 matches the footer's secondary text colour.
            */}
            <span className="ml-1.5 text-base font-semibold text-gray-800">
              Services
            </span>
          </Link>

          {/* ── Desktop nav links ─────────────────────────────────────── */}
          <nav className="hidden sm:flex items-center gap-1">
            {[
              { href: '/',         label: 'Home'        },
              { href: '/services', label: 'Find Workers' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors
                            ${isActive(href)
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* ── Desktop auth ──────────────────────────────────────────── */}
          <div className="hidden sm:flex items-center gap-2">
            {user ? (
              <>
                <span className="text-gray-400 text-sm">
                  Hi, {user.name?.split(' ')[0] ?? 'there'}
                </span>
                <Link
                  href={dashboardHref}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700
                             hover:bg-gray-50 transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm
                             font-medium text-gray-500 hover:text-red-600
                             hover:bg-red-50 transition-colors"
                >
                  <LogoutIcon />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600
                             hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/get-started"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                             text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ──────────────────────────────────────── */}
          {/*
            shrink-0 ensures the hamburger button never disappears when
            the brand name and button are both on a narrow screen.
          */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="sm:hidden p-2.5 rounded-xl text-gray-500 hover:bg-gray-100
                       transition-colors shrink-0"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <CloseMenuIcon /> : <HamburgerIcon />}
          </button>

        </div>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {[
            { href: '/',         label: 'Home'        },
            { href: '/services', label: 'Find Workers' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors
                          ${isActive(href)
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </Link>
          ))}

          <div className="pt-2 mt-2 border-t border-gray-100 space-y-1">
            {user ? (
              <>
                <div className="px-4 py-2 text-xs text-gray-400 font-medium">
                  Signed in as {user.email}
                </div>
                <Link
                  href={dashboardHref}
                  className="block px-4 py-2.5 rounded-xl text-sm font-medium
                             text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  My Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-left flex items-center gap-2 px-4 py-2.5
                             rounded-xl text-sm font-medium text-red-500
                             hover:bg-red-50 transition-colors"
                >
                  <LogoutIcon />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="block px-4 py-2.5 rounded-xl text-sm font-medium
                             text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/get-started"
                  className="block px-4 py-2.5 rounded-xl bg-blue-600 text-white
                             text-sm font-semibold text-center hover:bg-blue-700
                             transition-colors"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}