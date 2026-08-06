import PublicNav      from '@/components/public/PublicNav';
import Link           from 'next/link';
import { cached, AppCache } from '@/lib/cache';

export const metadata = {
  title: {
    default: 'HYS Services — Find Home Service Professionals',
    template: '%s | HYS Services',
  },
  description:
    'Find skilled home service professionals near you. Book plumbers, electricians, ' +
    'carpenters, cleaners and more — verified, rated, and available now.',
};

/**
 * BUG FIX: dozens of components (HeroSection, TextSection, ContactSection,
 * job-board, not-found.jsx, ...) style themselves with
 * `var(--color-brand, #3b82f6)`, and lib/cache.js's own top-of-file comment
 * says this layout is supposed to read `settings/global` and expose it —
 * but nothing ever actually fetched settings here or set the CSS variable.
 * The admin's Primary Color picker in Settings saved correctly; it just
 * never reached the page, so every component silently used the hardcoded
 * fallback. This mirrors the dual-mode fetch pattern already used in
 * app/(public)/[slug]/page.jsx.
 */
async function getPrimaryColor() {
  const mode = process.env.NEXT_PUBLIC_BACKEND_MODE;

  try {
    if (mode === 'server') {
      const prisma   = (await import('@/lib/prisma/client')).default;
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      return settings?.primaryColor || '#3B82F6';
    }

    if (mode === 'firebase') {
      return cached(
        AppCache.SETTINGS,
        async () => {
          const { db }              = await import('@/lib/firebase/config');
          const { doc, getDoc }     = await import('firebase/firestore');
          const snap = await getDoc(doc(db, 'settings', 'global'));
          return snap.exists() ? (snap.data().primaryColor || '#3B82F6') : '#3B82F6';
        },
        AppCache.SETTINGS_TTL,
      );
    }
  } catch (err) {
    console.error('[PublicLayout] Failed to read primaryColor:', err.message);
  }

  return '#3B82F6';
}

export default async function PublicLayout({ children }) {
  const primaryColor = await getPrimaryColor();

  return (
    /*
     * min-h-screen flex flex-col ensures the layout fills the full viewport
     * and the footer is pushed to the bottom even on short pages.
     * PublicNav is a Client Component ('use client') — Next.js 14 handles this
     * correctly inside a Server Component layout.
     */
    <div
      className="min-h-screen flex flex-col bg-gray-50"
      style={{ '--color-brand': primaryColor }}
    >

      {/* Sticky top navigation */}
      <PublicNav />

      {/* Page content — flex-1 makes this section grow to fill remaining space */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer — always at bottom */}
      <footer className="bg-white border-t border-gray-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

          {/* Top row: brand + links */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center
                          justify-between gap-8">

            {/* Brand */}
            <div className="max-w-xs">
              <p className="font-extrabold text-xl text-gray-900">
                HYS<span className="text-blue-600">.</span>{' '}
                <span className="text-gray-700 font-semibold text-base">Services</span>
              </p>
              <p className="text-gray-500 text-sm mt-1 leading-relaxed">
                Connecting skilled professionals with customers across India.
              </p>
            </div>

            {/* Navigation links */}
            <nav className="flex flex-wrap gap-x-8 gap-y-3">
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-800 uppercase tracking-widest">
                  Platform
                </p>
                <div className="space-y-1.5">
                  {[
                    { href: '/',         label: 'Home'        },
                    { href: '/services', label: 'Find Workers' },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="block text-gray-600 hover:text-gray-900 text-sm
                                 transition-colors"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-800 uppercase tracking-widest">
                  Account
                </p>
                <div className="space-y-1.5">
                  {[
                    { href: '/auth/login',         label: 'Sign In'         },
                    { href: '/auth/signup',        label: 'Create Account'  },
                    { href: '/auth/forgot-password', label: 'Reset Password' },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="block text-gray-600 hover:text-gray-900 text-sm
                                 transition-colors"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-800 uppercase tracking-widest">
                  Workers
                </p>
                <div className="space-y-1.5">
                  {[
                    { href: '/worker/signup',  label: 'Join as Worker'  },
                    { href: '/worker/login',   label: 'Worker Login'    },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="block text-gray-600 hover:text-gray-900 text-sm
                                 transition-colors"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </div>

          {/* Bottom row: copyright + trust badges */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row
                          items-center justify-between gap-3">
            <p className="text-gray-500 text-xs">
              © {new Date().getFullYear()} HYS Services. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {[
                'Secure Payments',
                'Verified Professionals',
                '24/7 Support',
              ].map((badge) => (
                <span key={badge}
                      className="flex items-center gap-1.5 text-gray-500 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}