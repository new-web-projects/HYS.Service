'use client';

import { useEffect }          from 'react';
import { useRouter }          from 'next/navigation';
import { usePublicAuthStore } from '@/store/publicAuthStore';
import LoadingSpinner         from '@/components/shared/LoadingSpinner';

export default function WorkerLayout({ children }) {
  const { user, loading, init } = usePublicAuthStore();
  const router                  = useRouter();

  /**
   * FIX: The previous layout called `initialize()` which does not exist.
   * The correct method name in publicAuthStore is `init()`.
   */
  useEffect(() => {
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/worker/login');
      return;
    }

    if (user.role !== 'worker') {
      // Redirect to the correct dashboard for this role
      const destinations = {
        admin:      '/dashboard',
        superadmin: '/dashboard',
        editor:     '/dashboard',
        customer:   '/customer-dashboard',
      };
      router.replace(destinations[user.role] ?? '/auth/login');
    }
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show spinner while auth state is resolving
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" label="Loading…" />
      </div>
    );
  }

  // Don't render children until we've confirmed the user is a worker
  if (!user || user.role !== 'worker') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" label="Redirecting…" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}