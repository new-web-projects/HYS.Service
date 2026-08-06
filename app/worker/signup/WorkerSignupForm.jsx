'use client';

import { useState, useEffect }           from 'react';
import Link                              from 'next/link';
import { useRouter }                     from 'next/navigation';
import { useForm }                       from 'react-hook-form';
import { zodResolver }                   from '@hookform/resolvers/zod';
import { usePublicAuthStore, ROLE_REDIRECTS } from '@/store/publicAuthStore';
import { useContentStore }               from '@/store/contentStore';
import { useToast }                      from '@/components/shared/Toast';
import { signupSchema }                  from '@/lib/validators/schemas';
import { CheckIcon, LockIcon, WarningIcon } from '@/components/icons';

/* ── Static data ─────────────────────────────────────────────────────────── */
const HOW_IT_WORKS = [
  {
    n:     '1',
    title: 'Create your profile',
    desc:  'Sign up in minutes, set your service category, and add your location.',
  },
  {
    n:     '2',
    title: 'Receive job requests',
    desc:  'Customers near you send booking requests. Review, chat, and agree on a price.',
  },
  {
    n:     '3',
    title: 'Complete & get paid',
    desc:  'Finish the job, collect payment, and build your rating with every review.',
  },
];

const WORKER_BENEFITS = [
  'Get customers near you',
  'Receive bookings automatically',
  'Track your earnings',
  'Withdraw payments anytime',
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

function MapPinIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
         stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

/* ── Component ────────────────────────────────────────────────────────────── */
export default function WorkerSignupForm() {
  const router = useRouter();
  const { signup } = usePublicAuthStore();
  const toast = useToast((s) => s.show);
  const {
    categories,
    categoriesLoading,
    subscribeCategories,
    unsubscribeCategories,
  } = useContentStore();

  const [submitting,      setSubmitting]      = useState(false);
  const [success,         setSuccess]         = useState(false);
  const [serverError,     setServerError]     = useState('');
  const [isOtherCategory, setIsOtherCategory] = useState(false);
  const [customCatName,   setCustomCatName]   = useState('');
  const [showPassword,    setShowPassword]    = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
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
      role:            'worker',
      categoryId:      '',
      categoryName:    '',
    },
  });

  const categoryId = watch('categoryId');
  const password   = watch('password') || '';
  const passwordChecks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One number',            met: /\d/.test(password) },
    { label: 'One uppercase letter',  met: /[A-Z]/.test(password) },
  ];

  /* Load categories from Firestore */
  useEffect(() => {
    subscribeCategories();
    return () => unsubscribeCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCategories = categories.filter((c) => c.status === 'active');

  /* ── Category handlers — preserved exactly from old SignupForm ──────────── */
  function handleCategorySelect(e) {
    const id = e.target.value;
    if (id === 'other') {
      setIsOtherCategory(true);
      setValue('categoryId', `pending-${Date.now()}`, { shouldValidate: true });
      setValue('categoryName', customCatName);
    } else {
      setIsOtherCategory(false);
      const cat = activeCategories.find((c) => c.id === id);
      setValue('categoryId',   id,          { shouldValidate: true });
      setValue('categoryName', cat?.name ?? '');
    }
  }

  function handleCustomCatChange(e) {
    const name = e.target.value;
    setCustomCatName(name);
    setValue('categoryId',   `pending-${Date.now()}`, { shouldValidate: true });
    setValue('categoryName', name);
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */
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
        role:         'worker',
        categoryId:   data.categoryId   ?? '',
        categoryName: data.categoryName ?? '',
      });
      // Part 4 UX: confirm success before navigating away, rather than an
      // abrupt redirect. The toast is mounted globally (app/layout.jsx) so
      // it keeps showing for a moment after landing on the dashboard too.
      setSuccess(true);
      toast('Your worker account has been created!', 'success');
      setTimeout(() => {
        router.replace(ROLE_REDIRECTS.worker ?? '/worker-dashboard');
      }, 900);
    } catch (err) {
      const msg = err.message ?? '';
      if (msg.includes('email-already-in-use')) {
        setServerError('An account with this email already exists. Sign in instead.');
      } else if (msg.includes('weak-password')) {
        setServerError('Password is too weak. Use at least 8 characters.');
      } else {
        setServerError(msg || 'Signup failed. Please try again.');
      }
      setSubmitting(false);
    }
  }

  const busy = submitting || success;

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white text-sm ' +
    'placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-amber-400/50 ' +
    'focus:border-transparent transition-colors ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]
                     lg:bg-white/[0.04] lg:border lg:border-white/10 lg:rounded-[2rem]
                     overflow-hidden">

      {/* ── Left: value-prop / how-it-works panel ────────────────────────── */}
      <div className="px-1 lg:px-12 pt-2 lg:pt-14 pb-8 lg:pb-14 flex flex-col">
        <Link
          href="/get-started"
          className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70
                     text-sm font-medium mb-8 transition-colors w-fit"
        >
          ← Back
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400 mb-3">
          For service professionals
        </p>
        <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight mb-3">
          Join HYS Services and Grow Your Business
        </h2>
        <p className="text-white/80 text-sm leading-relaxed mb-8 max-w-sm">
          Connect with customers, receive service requests, manage bookings,
          and build your professional reputation.
        </p>

        {/* How it works */}
        <div className="space-y-5 mb-8">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.n} className="flex items-start gap-4">
              <span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300
                                font-bold text-sm flex items-center justify-center shrink-0">
                {step.n}
              </span>
              <div>
                <p className="text-white font-semibold text-sm mb-0.5">{step.title}</p>
                <p className="text-white/80 text-sm leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Benefits */}
        <ul className="space-y-2.5 mb-auto">
          {WORKER_BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-3 text-white/60 text-sm">
              <span className="w-5 h-5 rounded-full bg-amber-500/15 text-amber-300
                                flex items-center justify-center shrink-0">
                <CheckIcon className="w-3 h-3" />
              </span>
              {b}
            </li>
          ))}
        </ul>

        {/* Trust note */}
        <div className="hidden lg:flex items-center gap-2.5 pt-10 text-white/35 text-xs">
          <LockIcon className="w-4 h-4 shrink-0" />
          Your information is encrypted and never shared without your consent.
        </div>
      </div>

      {/* ── Right: form panel ─────────────────────────────────────────────── */}
      <div className="bg-white/[0.05] border border-white/10
                       lg:border-y-0 lg:border-r-0 rounded-3xl lg:rounded-none
                       p-7 sm:p-10 lg:p-14">

        {/* Part 4 — premium accent bar */}
        <div className="h-1 w-16 rounded-full bg-gradient-to-r from-amber-400 to-amber-200 mb-6" />

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Create Your Worker Account
        </h1>
        <p className="text-white/50 text-sm mb-7">
          Free to join. Start receiving bookings once verified.
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
          {/* Hidden fields required by signupSchema */}
          <input type="hidden" {...register('role')} />
          <input type="hidden" {...register('categoryName')} />
          <input type="hidden" {...register('categoryId')} />

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
                placeholder="Min. 8 characters"
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
                        c.met ? 'text-amber-300' : 'text-white/40'
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

          {/* Part 4 — field grouping: Professional Details */}
          <div className="pt-2">
            <div className="border-t border-white/10 mb-4" />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/40 mb-1">
              Professional Details
            </p>
          </div>

          {/* Service category */}
          <div>
            <label className="block text-sm font-extrabold text-white/90 mb-1.5">
              Your Service Category <span className="text-amber-400">*</span>
            </label>

            {categoriesLoading ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5
                              border border-white/10">
                <span className="w-4 h-4 border-2 border-white/20 border-t-white/60
                                 rounded-full animate-spin" />
                <span className="text-white/40 text-sm">Loading categories…</span>
              </div>
            ) : (
              <select
                value={isOtherCategory ? 'other' : categoryId.startsWith('pending-') ? 'other' : categoryId}
                onChange={handleCategorySelect}
                className={`${inputCls} appearance-none`}
                disabled={busy}
              >
                <option value="" className="bg-gray-900">Select a category…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">
                    {c.name}
                  </option>
                ))}
                <option value="other" className="bg-gray-900">
                  + Other — suggest a new category
                </option>
              </select>
            )}

            {errors.categoryId && (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-400">
                <WarningIcon className="w-3.5 h-3.5 shrink-0" />
                {errors.categoryId.message}
              </p>
            )}

            <div
              className={`grid transition-all duration-300 ease-out ${
                isOtherCategory ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden space-y-1">
                <input
                  value={customCatName}
                  onChange={handleCustomCatChange}
                  placeholder="e.g. Solar Panel Installation"
                  className={inputCls}
                  disabled={busy}
                />
                <p className="text-xs text-white/30 leading-relaxed">
                  Your suggestion will be reviewed by an admin and activated within 24 hours.
                </p>
              </div>
            </div>
          </div>

          {/* Location notice */}
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4
                          flex items-start gap-3">
            <MapPinIcon className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-semibold mb-0.5">
                Location — set after signup
              </p>
              <p className="text-amber-300/70 text-xs leading-relaxed">
                After creating your account you will be taken to your profile where you can
                set your location so nearby customers can find you.
              </p>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className={`w-full py-4 mt-2 text-white font-bold text-base rounded-xl
                       transition-all disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 ${
                         success
                           ? 'bg-amber-500'
                           : 'bg-amber-600 hover:bg-amber-700 disabled:opacity-40'
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
              'Join as a Service Professional →'
            )}
          </button>

          <p className="text-center text-white/30 text-xs">
            By signing up you agree to our Terms of Service.
          </p>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          Already have an account?{' '}
          <Link
            href="/worker/login"
            className="text-white/100 hover:text-white font-semibold transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
