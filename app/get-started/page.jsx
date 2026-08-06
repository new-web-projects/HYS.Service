import Link from 'next/link';
import { Space_Grotesk } from 'next/font/google';
import { CheckIcon } from '@/components/icons';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-display',
});

export const metadata = {
  title: 'Get Started — HYS Services',
  description:
    'Find trusted professionals near you or join HYS Services as a verified service provider.',
};

const CUSTOMER_BENEFITS = [
  'Find verified workers',
  'Secure booking system',
  'Transparent pricing',
  'Real-time chat',
];

const WORKER_BENEFITS = [
  'Get customers',
  'Receive bookings',
  'Track earnings',
  'Withdraw payments',
];

/* ── Path icons — simple, on-brand line icons (Heroicons-outline style,
   matching components/icons/index.jsx conventions) ──────────────────── */

function SearchIcon({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM21 21l-4.35-4.35" />
    </svg>
  );
}

function ToolboxIcon({ className = 'w-7 h-7' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 9.75A1.5 1.5 0 014.5 8.25h15A1.5 1.5 0 0121 9.75v8.25a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18V9.75z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 8.25v-1.5a2.25 2.25 0 012.25-2.25h3a2.25 2.25 0 012.25 2.25v1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5h18M10.5 13.5v1.5M13.5 13.5v1.5" />
    </svg>
  );
}

function ArrowIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-paper">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="max-w-6xl mx-auto px-5 sm:px-8 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-2">
              <p className="font-extrabold text-xl text-gray-900">
                HYS<span className="text-blue-700">.</span>{' '}
                <span className="text-gray-900 font-semibold text-base">Services</span>
              </p>
        </Link>
        <p className="text-xs text-ink/50">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-semibold text-ink hover:text-hire-600 transition-colors">
            Sign in
          </Link>
        </p>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-10 text-center">
        <p
          className="animate-fade-in-up text-xs font-semibold uppercase tracking-[0.2em] text-ink/40 mb-4"
          style={{ animationDelay: '0ms' }}
        >
          Two sides of one marketplace
        </p>
        <h1
          className={`${display.className} animate-fade-in-up font-bold tracking-tight
                     text-[2.25rem] sm:text-5xl text-ink leading-[1.1]`}
          style={{ animationDelay: '60ms' }}
        >
          Choose How You Want To Use HYS Services
        </h1>
        <p
          className="animate-fade-in-up mt-5 text-base sm:text-lg text-ink/60 leading-relaxed max-w-xl mx-auto"
          style={{ animationDelay: '120ms' }}
        >
          Find trusted professionals near you or join as a verified service
          provider.
        </p>
      </section>

      {/* ── The fork — two paths joined at a seam ──────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8">
        <div
          className="animate-fade-in-up relative grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-20"
          style={{ animationDelay: '180ms' }}
        >
          {/* Desktop seam: vertical hairline + OR badge, sitting in the gutter
              between the two cards (needs a real gap to be visible against) */}
          <div className="hidden lg:block absolute inset-y-2 left-1/2 w-px -translate-x-1/2 z-10">
            <div className="h-full w-full border-l-2 border-dashed border-seam" />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                         w-12 h-12 rounded-full bg-paper border border-seam
                         flex items-center justify-center text-xs font-bold
                         tracking-widest text-ink/40 shadow-sm"
            >
              OR
            </div>
          </div>

          {/* ── Customer card — Hire ───────────────────────────────────── */}
          <article
            className="group relative bg-hire-50 border border-hire-100 rounded-3xl
                       p-7 sm:p-9 flex flex-col
                       transition-all duration-300 hover:-translate-y-1
                       hover:shadow-[0_24px_48px_-24px_rgba(36,84,235,0.35)]"
          >
            <div className="w-14 h-14 rounded-2xl bg-hire-600 text-white flex items-center
                             justify-center shrink-0 mb-6">
              <SearchIcon />
            </div>
            <h2 className={`${display.className} font-bold text-2xl text-ink mb-2`}>
              Hire a Professional
            </h2>
            <p className="text-ink/60 leading-relaxed mb-8">
              Find trusted workers, compare options, chat before booking, and
              hire with confidence.
            </p>
            <Link
              href="/auth/signup?role=customer"
              className="mt-auto inline-flex items-center justify-center gap-2
                         px-6 py-3.5 rounded-2xl bg-hire-600 group-hover:bg-hire-700
                         text-white font-semibold transition-colors"
            >
              Create Customer Account
              <ArrowIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </article>

          {/* Mobile seam: horizontal hairline + OR badge — placed here in DOM
              order so it renders BETWEEN the two cards, not above both */}
          <div className="lg:hidden relative h-px">
            <div className="absolute inset-x-6 top-0 border-t-2 border-dashed border-seam" />
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
                         w-10 h-10 rounded-full bg-paper border border-seam
                         flex items-center justify-center text-xs font-bold
                         tracking-widest text-ink/40 shadow-sm"
            >
              OR
            </div>
          </div>

          {/* ── Worker card — Earn ─────────────────────────────────────── */}
          <article
            className="group relative bg-earn-50 border border-earn-100 rounded-3xl
                       p-7 sm:p-9 flex flex-col
                       transition-all duration-300 hover:-translate-y-1
                       hover:shadow-[0_24px_48px_-24px_rgba(194,102,10,0.35)]"
          >
            <div className="w-14 h-14 rounded-2xl bg-earn-600 text-white flex items-center
                             justify-center shrink-0 mb-6">
              <ToolboxIcon />
            </div>
            <h2 className={`${display.className} font-bold text-2xl text-ink mb-2`}>
              Join as a Service Professional
            </h2>
            <p className="text-ink/60 leading-relaxed mb-8">
              Offer your services, receive bookings, earn money, and grow
              your business.
            </p>
            <Link
              href="/worker/signup"
              className="mt-auto inline-flex items-center justify-center gap-2
                         px-6 py-3.5 rounded-2xl bg-earn-600 group-hover:bg-earn-700
                         text-white font-semibold transition-colors"
            >
              Create Worker Account
              <ArrowIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </article>
        </div>
      </section>

      {/* ── Benefits comparison ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 mt-16 sm:mt-24 pb-20 sm:pb-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-hire-600 mb-4">
              For customers
            </p>
            <ul className="space-y-3.5">
              {CUSTOMER_BENEFITS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink/75">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-hire-100 text-hire-600
                                    flex items-center justify-center shrink-0">
                    <CheckIcon className="w-3 h-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-earn-600 mb-4">
              For workers
            </p>
            <ul className="space-y-3.5">
              {WORKER_BENEFITS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-ink/75">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-earn-100 text-earn-600
                                    flex items-center justify-center shrink-0">
                    <CheckIcon className="w-3 h-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
