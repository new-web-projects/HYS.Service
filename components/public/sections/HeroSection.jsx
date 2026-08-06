'use client';

import Link                   from 'next/link';
import { usePublicAuthStore } from '@/store/publicAuthStore';
import { ArrowRightIcon }     from '@/components/icons';

export default function HeroSection({
  heading            = '',
  subheading         = '',
  backgroundImageUrl = '',
  ctaText            = '',
  ctaLink            = '',
}) {
  const { user, isLoading } = usePublicAuthStore();

  /**
   * Hero button logic (Part 4 spec):
   * - Logged in  → /services
   * - Logged out → /auth/login  (changed from /auth/signup per new spec)
   * - External ctaLink → use as-is
   *
   * BUG FIX (Bug 2): Removed the secondary "Sign in" link that was creating
   * a duplicate sign-in button below the main CTA. The header nav already
   * has Sign In. Having it in the hero too caused visual duplication.
   */
  const resolvedHref = (() => {
    if (ctaLink && (ctaLink.startsWith('http') || ctaLink.startsWith('mailto'))) {
      return ctaLink;
    }
    if (!isLoading) {
      return user ? '/services' : '/auth/login';
    }
    return ctaLink || '/auth/login';
  })();

  return (
    <div
      className="relative min-h-[85vh] flex items-center justify-center text-center overflow-hidden"
      style={
        backgroundImageUrl
          ? {
              backgroundImage:    `url(${backgroundImageUrl})`,
              backgroundSize:     'cover',
              backgroundPosition: 'center',
            }
          : {}
      }
    >
      {/* Gradient background (no image) */}
      {!backgroundImageUrl && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg,
              var(--color-brand, #2563eb) 0%,
              color-mix(in srgb, var(--color-brand, #2563eb) 60%, #7c3aed) 100%)`,
          }}
        />
      )}

      {backgroundImageUrl && (
        <>
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-x-0 bottom-0 h-32
                          bg-gradient-to-t from-black/40 to-transparent" />
        </>
      )}

      {!backgroundImageUrl && (
        <>
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full
                          bg-white/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full
                          bg-white/5 blur-3xl pointer-events-none" />
        </>
      )}

      {/* Content */}
      <div className="relative z-10 section-wrapper section-padding animate-fade-in-up">
        <div className="max-w-4xl mx-auto">
          {heading && (
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white
                           leading-[1.08] tracking-tight mb-6 text-balance drop-shadow-sm">
              {heading}
            </h1>
          )}
          {subheading && (
            <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-2xl mx-auto
                          mb-10 leading-relaxed font-light">
              {subheading}
            </p>
          )}
          {ctaText && (
            <div className="flex items-center justify-center">
              {/*
                BUG FIX: Only ONE button here. No secondary "Sign in" link.
                The header always has Sign In. Duplicate removed.
              */}
              <Link
                href={resolvedHref}
                className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
                           bg-white text-gray-900 font-bold text-base
                           hover:bg-gray-100 active:scale-95 transition-all duration-150
                           shadow-xl hover:shadow-2xl"
              >
                {ctaText}
                <ArrowRightIcon className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 inset-x-0 pointer-events-none">
        <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg"
             className="w-full h-8 sm:h-12" preserveAspectRatio="none">
          <path
            d="M0 48L60 42C120 36 240 24 360 20C480 16 600 20 720 26C840 32 960 40 1080 40C1200 40 1320 32 1380 28L1440 24V48H0Z"
            fill="white"
          />
        </svg>
      </div>
    </div>
  );
}