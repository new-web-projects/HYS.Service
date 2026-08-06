'use client';

import { useState }              from 'react';
import Link                      from 'next/link';
import { useRouter }             from 'next/navigation';
import { useForm }               from 'react-hook-form';
import { zodResolver }           from '@hookform/resolvers/zod';
import { usePublicAuthStore, ROLE_REDIRECTS } from '@/store/publicAuthStore';
import { useToast }              from '@/components/shared/Toast';
import { signupSchema }          from '@/lib/validators/schemas';
import { CheckIcon, ArrowRightIcon, LockIcon, WarningIcon } from '@/components/icons';

/* ── Benefits data ───────────────────────────────────────────────────────── */
const BENEFITS = [
  {
    title: 'Find verified workers',
    desc:  'Every professional is identity-checked and rated by real customers.',
  },
  {
    title: 'Secure booking system',
    desc:  'Your bookings and payments are protected at every step.',
  },
  {
    title: 'Transparent pricing',
    desc:  'See the full price breakdown before you confirm — no surprises.',
  },
  {
    title: 'Real-time chat',
    desc:  'Discuss the job and agree on a price directly with your worker.',
  },
];

const GENDER_OPTIONS = [
  { value: '',                  label: 'Select gender…'    },
  { value: 'male',              label: 'Male'              },
  { value: 'female',            label: 'Female'            },
  { value: 'non-binary',        label: 'Non-binary'        },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

/* ── Inline icons ────────────────────────────────────────────────────────── */
function EyeIcon({ open, className = 'w-4 h-4' }) {
  return open ? (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function CustomerSignupForm() {
  const router        = useRouter();
  const { signup }    = usePublicAuthStore();
  const toast          = useToast((s) => s.show);
  const [submitting,   setSubmitting]   = useState(false);
  const [success,      setSuccess]      = useState(false);
  const [serverError,  setServerError]  = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    // Part 4 UX: validate a field once the person leaves it (onBlur), then
    // keep re-checking on every keystroke afterwards (onChange) so an error
    // clears the moment it's fixed — feedback that's present but not naggy.
    mode: 'onBlur',
    reValidateMode: 'onChange',
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name:            '',
      email:           '',
      phone:           '',
      gender:          '',
      password:        '',
      confirmPassword: '',
      role:            'customer',
    },
  });

  const password = watch('password') || '';
  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One number',            met: /\d/.test(password) },
    { label: 'One uppercase letter',  met: /[A-Z]/.test(password) },
  ];

  async function onSubmit(data) {
    if (submitting || success) return; // guard against double-submit
    setSubmitting(true);
    setServerError('');
    try {
      await signup({
        email:        data.email,
        password:     data.password,
        name:         data.name,
        phone:        data.phone  ?? '',
        gender:       data.gender ?? '',
        role:         'customer',
        categoryId:   '',
        categoryName: '',
      });
      // Part 4 UX: confirm success before navigating away, rather than an
      // abrupt redirect. The toast is mounted globally (app/layout.jsx) so
      // it keeps showing for a moment after landing on the dashboard too.
      setSuccess(true);
      toast('Your customer account has been created!', 'success');
      setTimeout(() => {
        router.replace(ROLE_REDIRECTS.customer ?? '/customer-dashboard');
      }, 900);
    } catch (err) {
      const msg = err.message ?? '';
      if (msg.includes('email-already-in-use')) {
        setServerError('An account with this email already exists. Sign in instead.');
      } else if (msg.includes('weak-password')) {
        setServerError('Password is too weak. Use at least 8 characters.');
      } else {
        setServerError(msg || 'Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  const busy = submitting || success;

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white text-sm ' +
    'placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 ' +
    'focus:border-transparent transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]
                     lg:bg-white/[0.04] lg:border lg:border-white/10 lg:rounded-[2rem]
                     overflow-hidden">

      {/* ── Benefits panel ──────────────────────────────────────────────── */}
      <div className="px-1 lg:px-12 pt-2 lg:pt-14 pb-8 lg:pb-14 flex flex-col">
        <Link
          href="/get-started"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70
                     text-sm font-medium mb-8 transition-colors w-fit"
        >
          ← Back
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400 mb-3">
          For customers
        </p>
        <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight mb-3">
          Why join HYS Services?
        </h2>
        <p className="text-white/80 text-sm leading-relaxed mb-8 lg:mb-10 max-w-sm">
          Create your free account and start booking trusted help in minutes.
        </p>

        <ul className="space-y-5 lg:space-y-6">
          {BENEFITS.map((b) => (
            <li key={b.title} className="flex items-start gap-4">
              <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-300
                                flex items-center justify-center shrink-0">
                <CheckIcon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-white font-semibold text-sm mb-0.5">{b.title}</p>
                <p className="text-white/80 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex items-center gap-2.5 mt-auto pt-10 text-white/35 text-xs">
          <LockIcon className="w-4 h-4 shrink-0" />
          Your information is encrypted and never shared without your consent.
        </div>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────────── */}
      <div className="bg-white/[0.05] border border-white/10
                       lg:border-y-0 lg:border-r-0 rounded-3xl lg:rounded-none
                       p-7 sm:p-10 lg:p-14">

        {/* Part 4 — premium accent bar */}
        <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200 mb-6" />

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Create Your Customer Account
        </h1>
        <p className="text-white/50 text-sm mb-7">
          Takes less than a minute — no credit card required.
        </p>

        {/* Part 4 — server error banner, smoothly collapses in/out */}
        <div
          className={`grid transition-all duration-300 ease-out ${
            serverError ? 'grid-rows-[1fr] opacity-100 mb-5' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-xl bg-red-500/15 border border-red-500/30
                            px-4 py-3 text-red-300 text-sm flex items-start gap-2">
              <WarningIcon className="w-4 h-4 shrink-0 mt-0.5" />
              {serverError}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={busy} className="space-y-4">
          <input type="hidden" {...register('role')} />

          {/* Part 4 — field grouping: Personal Details */}
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40">
            Personal Details
          </p>

          {/* Full name */}
          <div>
            <label className="block text-sm font-extrabold text-white/90 mb-1.5">
              Full Name
            </label>
            <input
              {...register('name')}
              placeholder="Your full name"
              className={inputCls}
              autoComplete="name"
              disabled={busy}
            />
            {errors.name && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-extrabold text-white/90 mb-1.5">
              Email Address
            </label>
            <input
              {...register('email')}
              type="email"
              placeholder="you@example.com"
              className={inputCls}
              autoComplete="email"
              disabled={busy}
            />
            {errors.email && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Mobile Number + Gender side by side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-extrabold text-white/90 mb-1.5">
                Mobile Number
              </label>
              <input
                {...register('phone')}
                type="tel"
                placeholder="+91 98765 43210"
                className={inputCls}
                autoComplete="tel"
                disabled={busy}
              />
              {errors.phone && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                  {errors.phone.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-extrabold text-white/90 mb-1.5">
                Gender
              </label>
              <select
                {...register('gender')}
                className={`${inputCls} appearance-none`}
                disabled={busy}
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-gray-900">
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.gender && (
                <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                  <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                  {errors.gender.message}
                </p>
              )}
            </div>
          </div>

          {/* Part 4 — field grouping: Account Security */}
          <div className="pt-2">
            <div className="border-t border-white/10 mb-4" />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1">
              Account Security
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-extrabold text-white/90 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                className={`${inputCls} pr-11`}
                autoComplete="new-password"
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30
                           hover:text-white/60 transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Part 4 — live password requirements checklist */}
            <div
              className={`grid transition-all duration-300 ease-out ${
                password.length > 0 ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <ul className="space-y-1">
                  {passwordChecks.map((c) => (
                    <li
                      key={c.label}
                      className={`flex items-center gap-1.5 text-xs transition-colors ${
                        c.met ? 'text-emerald-300' : 'text-white/40'
                      }`}
                    >
                      <CheckIcon className="w-3 h-3 shrink-0" />
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {password.length === 0 && (
              <p className="mt-1.5 text-xs text-white/30">At least 8 characters</p>
            )}
            {errors.password && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-extrabold text-white/90 mb-1.5">
              Confirm Password
            </label>
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              placeholder="Repeat password"
              className={inputCls}
              autoComplete="new-password"
              disabled={busy}
            />
            {errors.confirmPassword && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className={`w-full py-4 mt-2 text-white font-bold text-base rounded-xl
                       transition-all disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 ${
                         success
                           ? 'bg-emerald-500'
                           : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40'
                       }`}
          >
            {success ? (
              <>
                <CheckIcon className="w-5 h-5" />
                Account created! Redirecting…
              </>
            ) : submitting ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white
                                 rounded-full animate-spin" />
                Creating your account…
              </>
            ) : (
              <>
                Start Finding Trusted Professionals
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-white/30 text-xs">
            By signing up you agree to our Terms of Service.
          </p>
        </form>

        <p className="text-center text-white/65 text-sm mt-6">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="text-white/100 hover:text-white font-semibold transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
