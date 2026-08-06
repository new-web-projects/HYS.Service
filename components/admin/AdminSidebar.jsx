'use client';

import { useState, useEffect, useCallback } from 'react';
import Link                                  from 'next/link';
import { usePathname, useRouter }            from 'next/navigation';
import { useAuthStore }                      from '@/store/authStore';
import {
  DashboardIcon, PageIcon, CategoryIcon, UserIcon,
  WorkerIcon, BookingIcon, MediaIcon, SettingsIcon,
  TrashIcon, ServicesIcon, MenuIcon, CloseIcon,
  LogoutIcon, AdminIcon, PaymentIcon, BugIcon,
}                                            from '@/components/icons';

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_PRIMARY = [
  { href: '/dashboard',          label: 'Dashboard',     Icon: DashboardIcon, exact: true  },
  { href: '/pages',              label: 'Pages',          Icon: PageIcon,      exact: false },
  { href: '/categories',         label: 'Categories',     Icon: CategoryIcon,  exact: false },
  { href: '/users',              label: 'Users',          Icon: UserIcon,      exact: false },
  { href: '/workers-admin',      label: 'Workers',        Icon: WorkerIcon,    exact: false },
  { href: '/bookings',           label: 'Bookings',       Icon: BookingIcon,   exact: false },
  { href: '/admin-job-requests', label: 'Job Requests',   Icon: ServicesIcon,  exact: false },
  { href: '/media',              label: 'Media',          Icon: MediaIcon,     exact: false },
  { href: '/withdrawals',        label: 'Withdrawals',    Icon: PaymentIcon,   exact: false },
  { href: '/error-center',       label: 'Error Center',   Icon: BugIcon,       exact: false },
  { href: '/settings',           label: 'Settings',       Icon: SettingsIcon,  exact: false },
];

const NAV_SECONDARY = [
  { href: '/pages/trash', label: 'Trash', Icon: TrashIcon, exact: true },
];

// ─── NavLink ─────────────────────────────────────────────────────────────────

function NavLink({ href, label, Icon, exact, onClick }) {
  const pathname = usePathname();
  const active   = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-150
                  ${active
                    ? 'bg-brand-600/20 text-brand-400'
                    : 'text-admin-muted hover:bg-white/[0.05] hover:text-admin-text'}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
      {active && (
        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
      )}
    </Link>
  );
}

// ─── Sidebar content (shared between desktop and mobile) ──────────────────────

function SidebarContent({ user, onNavClick, onLogout }) {
  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="px-4 py-5 border-b border-admin-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shrink-0">
            <AdminIcon className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-admin-text text-sm truncate">Admin Panel</p>
            <p className="text-admin-muted text-xs truncate">{user?.name ?? 'Administrator'}</p>
          </div>
        </div>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_PRIMARY.map((item) => (
          <NavLink key={item.href} {...item} onClick={onNavClick} />
        ))}

        {/* Divider */}
        <div className="my-3 border-t border-admin-border" />

        {/* Secondary nav */}
        {NAV_SECONDARY.map((item) => (
          <NavLink key={item.href} {...item} onClick={onNavClick} />
        ))}
      </nav>

      {/* Footer — user info + logout */}
      <div className="px-3 py-4 border-t border-admin-border space-y-2">
        {user && (
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700
                            flex items-center justify-center text-white text-sm font-bold shrink-0">
              {(user.name || user.email || 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-admin-text text-xs font-semibold truncate">
                {user.name || 'Admin'}
              </p>
              <p className="text-admin-muted text-xs truncate">{user.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm
                     font-medium text-admin-muted hover:bg-white/[0.05] hover:text-red-400
                     transition-colors"
        >
          <LogoutIcon className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AdminSidebar() {
  const router  = useRouter();
  const { user, logout } = useAuthStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.replace('/admin/login');
  }, [logout, router]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <>
      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-admin-card
                        border-r border-admin-border min-h-screen">
        <SidebarContent
          user={user}
          onNavClick={undefined}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile hamburger button ────────────────────────────────────────── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2.5 bg-admin-card border
                   border-admin-border rounded-xl text-admin-muted hover:text-admin-text
                   transition-colors shadow-lg"
        aria-label="Open menu"
      >
        <MenuIcon className="w-5 h-5" />
      </button>

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm
                       animate-fade-in"
            onClick={closeMobile}
          />

          {/* Drawer */}
          <aside
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-admin-card
                       border-r border-admin-border shadow-2xl flex flex-col
                       animate-slide-in"
          >
            {/* Close button */}
            <button
              onClick={closeMobile}
              className="absolute top-4 right-4 p-2 rounded-xl text-admin-muted
                         hover:text-admin-text hover:bg-white/[0.05] transition-colors"
              aria-label="Close menu"
            >
              <CloseIcon className="w-5 h-5" />
            </button>

            <SidebarContent
              user={user}
              onNavClick={closeMobile}
              onLogout={handleLogout}
            />
          </aside>
        </>
      )}
    </>
  );
}