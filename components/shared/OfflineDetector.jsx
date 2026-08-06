'use client';

/**
 * components/shared/OfflineDetector.jsx — Part 14
 *
 * Client Component that shows a banner when the user goes offline.
 * Imported into the Server Component app/layout.jsx without breaking
 * the metadata export.
 */

import { useState, useEffect } from 'react';
import { OfflineBanner } from '@/components/shared/Skeletons';

export default function OfflineDetector() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Check initial state
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setOffline(true);
    }
    const handleOnline  = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return offline ? <OfflineBanner /> : null;
}
