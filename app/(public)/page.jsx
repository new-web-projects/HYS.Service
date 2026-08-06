import Link from 'next/link';

export const metadata = {
  title:       'HYS Services — Find Skilled Professionals Near You',
  description:
    'Book verified plumbers, electricians, carpenters, cleaners and more. ' +
    'Compare quotes, chat with workers, and pay securely.',
};

// ── Category SVG icons (replacing emojis — Part 8) ───────────────────────────

function PlumbingIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  );
}

function ElectricalIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function CarpentryIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
    </svg>
  );
}

function PaintingIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}

function CleaningIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function ACIcon() {
  return (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

const CATEGORIES = [
  { name: 'Plumbing',   Icon: PlumbingIcon,   color: 'text-blue-600   bg-blue-100'   },
  { name: 'Electrical', Icon: ElectricalIcon, color: 'text-yellow-600 bg-yellow-100' },
  { name: 'Carpentry',  Icon: CarpentryIcon,  color: 'text-amber-700  bg-amber-100'  },
  { name: 'Painting',   Icon: PaintingIcon,   color: 'text-purple-600 bg-purple-100' },
  { name: 'Cleaning',   Icon: CleaningIcon,   color: 'text-emerald-600 bg-emerald-100'},
  { name: 'AC Service', Icon: ACIcon,         color: 'text-cyan-600   bg-cyan-100'   },
];

// ── Features ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    title: 'Verified Professionals',
    desc:  'Every worker is identity-verified and rated by real customers.',
    icon:  (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24"
           stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    color: 'text-blue-600 bg-blue-100',
  },
  {
    title: 'Compare Quotes',
    desc:  'Post a job request and let workers compete with their best price.',
    icon:  (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24"
           stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    title: 'Chat Before Booking',
    desc:  'Discuss your job details and agree on a final price before you commit.',
    icon:  (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24"
           stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    color: 'text-purple-600 bg-purple-100',
  },
  {
    title: 'Nearest Workers First',
    desc:  'We detect your location and show available professionals closest to you.',
    icon:  (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24"
           stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    color: 'text-rose-600 bg-rose-100',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Post a Job or Browse',
    desc:  'Describe what you need or browse workers by category near you.',
  },
  {
    step: '02',
    title: 'Compare and Chat',
    desc:  'Receive quotes from multiple workers. Chat to discuss details and price.',
  },
  {
    step: '03',
    title: 'Book and Pay Securely',
    desc:  'Confirm your booking. Pay securely after the job is done.',
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="bg-white">

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br
                          from-blue-600 via-blue-700 to-indigo-800">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/5 rounded-full" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-white/5 rounded-full" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-20 sm:py-28
                        text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                          bg-white/10 border border-white/20 text-white text-sm
                          font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Verified professionals available now
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight
                         tracking-tight mb-6">
            Find Skilled
            <br />
            <span className="text-blue-200">Professionals</span> Near You
          </h1>

          <p className="text-blue-100 text-lg sm:text-xl leading-relaxed mb-10
                        max-w-2xl mx-auto">
            Book verified plumbers, electricians, carpenters, cleaners and more.
            Compare quotes, chat directly, and pay only when you're satisfied.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/services"
              className="px-8 py-4 rounded-2xl bg-white text-blue-700 font-bold text-lg
                         hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl
                         hover:-translate-y-0.5 w-full sm:w-auto text-center"
            >
              Browse Workers
            </Link>
            <Link
              href="/get-started"
              className="px-8 py-4 rounded-2xl bg-white/10 border border-white/30
                         text-white font-bold text-lg hover:bg-white/20 transition-all
                         w-full sm:w-auto text-center"
            >
              Get Started — Free
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6
                          text-blue-200 text-sm">
            {['No booking fees', 'Verified ID checks', 'Secure payments', 'Rated reviews'].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories — Part 8: SVG icons instead of emoji ─────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900">Popular Services</h2>
          <p className="text-gray-500 mt-2">
            Find professionals for any home service need
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map(({ name, Icon, color }) => (
            <Link
              key={name}
              href="/services"
              className="flex flex-col items-center gap-3 p-5 bg-gray-50 hover:bg-blue-50
                         border border-gray-100 hover:border-blue-200 rounded-2xl
                         transition-all group hover:-translate-y-0.5"
            >
              <div className={`w-12 h-12 rounded-xl ${color} flex items-center
                               justify-center`}>
                <Icon />
              </div>
              <span className="text-gray-700 group-hover:text-blue-700 font-semibold
                               text-sm text-center leading-tight">
                {name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Why Choose HYS Services?
            </h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">
              We make it simple to find, hire, and pay trusted home service professionals.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map(({ title, desc, icon, color }) => (
              <div key={title}
                   className="bg-white rounded-2xl border border-gray-100 shadow-sm
                              p-6 flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl ${color} flex items-center
                                 justify-center shrink-0`}>
                  {icon}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900">How It Works</h2>
          <p className="text-gray-500 mt-2">Get professional help in 3 easy steps</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
            <div key={step} className="text-center relative">
              {/* Connector line between steps */}
              {i < HOW_IT_WORKS.length - 1 && (
                <div className="hidden sm:block absolute top-7 left-[calc(50%+28px)]
                                right-[calc(-50%+28px)] h-0.5 bg-gray-200" />
              )}
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-extrabold
                              text-xl flex items-center justify-center mx-auto mb-4
                              relative z-10">
                {step}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Join thousands of customers who find reliable professionals through HYS Services.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/get-started"
              className="px-8 py-4 rounded-2xl bg-white text-blue-700 font-bold
                         hover:bg-blue-50 transition-all shadow-lg w-full sm:w-auto
                         text-center"
            >
              Create Free Account
            </Link>
            <Link
              href="/services"
              className="px-8 py-4 rounded-2xl border-2 border-white/40 text-white
                         font-bold hover:bg-white/10 transition-all w-full sm:w-auto
                         text-center"
            >
              Browse Workers
            </Link>
          </div>
          <p className="mt-8 text-blue-200 text-sm">
            Are you a service professional?{' '}
            <Link href="/worker/signup"
                  className="text-white font-semibold underline underline-offset-2
                             hover:text-blue-100 transition-colors">
              Join as a Worker
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}