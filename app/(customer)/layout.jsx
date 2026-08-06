'use client';

import { useEffect }          from 'react';
import { useRouter }          from 'next/navigation';
import { usePublicAuthStore } from '@/store/publicAuthStore';
import LoadingSpinner         from '@/components/shared/LoadingSpinner';

export default function CustomerLayout({ children }) {
  const { user, loading, init } = usePublicAuthStore();
  const router                  = useRouter();

  /**
   * FIX: Call init() (correct method name), not initialize().
   * init() sets up the Firebase onAuthStateChanged listener which
   * populates the user object and sets loading = false.
   */
  useEffect(() => {
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (user.role !== 'customer') {
      const destinations = {
        admin:      '/dashboard',
        superadmin: '/dashboard',
        editor:     '/dashboard',
        worker:     '/worker-dashboard',
      };
      router.replace(destinations[user.role] ?? '/auth/login');
    }
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" label="Loading…" />
      </div>
    );
  }

  if (!user || user.role !== 'customer') {
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