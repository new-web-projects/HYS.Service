'use client';

import { useEffect }                    from 'react';
import { useRouter }                    from 'next/navigation';
import { useAuthStore }                 from '@/store/authStore';
import AdminSidebar                     from '@/components/admin/AdminSidebar';
import { ConfirmDialog }                from '@/components/shared/ConfirmDialog';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const {
    user,
    isLoading,
    initialize,
    sessionWarning,
    countdown,
    extendSession,
    logout,
  } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/auth/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-admin-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-admin-muted text-sm">Loading session…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-admin-bg text-admin-text flex">

      {/* Session expiry warning banner */}
      {sessionWarning && (
        <div
          className="fixed inset-x-0 top-0 z-50 bg-amber-400 text-amber-950 shadow-lg animate-slide-in"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-medium">
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Session expires in{' '}
              <strong className="font-mono tabular-nums">{countdown}s</strong> — you will be signed out automatically.
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={extendSession}
                className="px-3 py-1.5 bg-amber-900/15 hover:bg-amber-900/25 rounded-lg text-xs font-semibold transition-colors"
              >
                Stay signed in
              </button>
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-amber-900/15 hover:bg-amber-900/25 rounded-lg text-xs font-semibold transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <AdminSidebar />

      {/* Main content */}
      <div className={`flex-1 min-w-0 overflow-y-auto ${sessionWarning ? 'mt-[52px]' : ''}`}>
        {children}
      </div>

      {/* Global UI overlays */}
      <ConfirmDialog />
    </div>
  );
}