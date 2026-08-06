'use client';

import { useState, useEffect }        from 'react';
import { useForm }                    from 'react-hook-form';
import { zodResolver }                from '@hookform/resolvers/zod';
import { useRouter, useSearchParams }  from 'next/navigation';
import Link                           from 'next/link';
import { usePublicAuthStore, ROLE_REDIRECTS } from '@/store/publicAuthStore';
import { useContentStore }            from '@/store/contentStore';
import { signupSchema }               from '@/lib/validators/schemas';

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signup }   = usePublicAuthStore();
  const {
    categories,
    categoriesLoading,
    subscribeCategories,
    unsubscribeCategories,
  } = useContentStore();

  const [selectedRole,     setSelectedRole]     = useState(''); // 'customer' | 'worker'
  const [submitting,       setSubmitting]        = useState(false);
  const [serverError,      setServerError]       = useState('');
  const [isOtherCategory,  setIsOtherCategory]  = useState(false);
  const [customCatName,    setCustomCatName]    = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name:            '',
      email:           '',
      password:        '',
      confirmPassword: '',
      role:            '',
      categoryId:      '',
      categoryName:    '',
    },
  });

  const categoryId = watch('categoryId');

  // Load categories for worker signup
  useEffect(() => {
    subscribeCategories();
    return () => unsubscribeCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Part 1 — deep-link support: the new /get-started chooser links here as
  // /auth/signup?role=customer, skipping the (now redundant) in-form role
  // picker below. Falls through to the normal two-step flow if the param
  // is missing or invalid, so nothing existing breaks.
  useEffect(() => {
    const role = searchParams.get('role');
    if (role === 'customer' || role === 'worker') {
      selectRole(role);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectRole(role) {
    setSelectedRole(role);
    setValue('role', role, { shouldValidate: true });
  }

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

  async function onSubmit(data) {
    setSubmitting(true);
    setServerError('');
    try {
      await signup({
        email:        data.email,
        password:     data.password,
        name:         data.name,
        role:         data.role,
        categoryId:   data.categoryId   ?? '',
        categoryName: data.categoryName ?? '',
      });
      router.replace(ROLE_REDIRECTS[data.role] ?? '/auth/login');
    } catch (err) {
      const msg = err.message ?? '';
      if (msg.includes('email-already-in-use')) {
        setServerError('An account with this email already exists. Sign in instead.');
      } else if (msg.includes('weak-password')) {
        setServerError('Password is too weak. Use at least 8 characters.');
      } else {
        setServerError(msg || 'Signup failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm ' +
    'placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/40 ' +
    'focus:border-transparent transition-colors';

  const activeCategories = categories.filter((c) => c.status === 'active');

  // ── Step 1: Role selection ─────────────────────────────────────────────
  if (!selectedRole) {
    return (
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
            Create Your Account
          </h1>
          <p className="text-white/60 text-base">
            Join as a customer to find services, or as a worker to offer yours.
          </p>
        </div>

        <div className="space-y-4">
          {[
            {
              role:  'customer',
              emoji: '🙋',
              title: 'Find Services',
              desc:  'Hire skilled professionals for tasks at home or work.',
            },
            {
              role:  'worker',
              emoji: '🔧',
              title: 'Offer Services',
              desc:  'Find clients near you and grow your business.',
            },
          ].map(({ role, emoji, title, desc }) => (
            <button
              key={role}
              type="button"
              onClick={() => selectRole(role)}
              className="w-full flex items-start gap-5 p-6 rounded-2xl border-2 border-white/10
                         hover:border-white/30 bg-white/5 hover:bg-white/10
                         transition-all duration-200 group text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center
                              text-3xl shrink-0 group-hover:scale-110 transition-transform">
                {emoji}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">{title}</h3>
                <p className="text-white/50 text-sm mt-1 leading-relaxed">{desc}</p>
              </div>
              <svg
                className="w-6 h-6 text-white/30 group-hover:text-white/70 ml-auto mt-3
                           shrink-0 transition-colors"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          ))}

          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/auth/login"
                  className="text-white/70 hover:text-white font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Registration form ──────────────────────────────────────────
  return (
    <div className="w-full max-w-lg">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
          {selectedRole === 'customer' ? 'Customer Account' : 'Worker Account'}
        </h1>
        <p className="text-white/50 text-sm">
          {selectedRole === 'customer'
            ? 'Book trusted professionals near you'
            : 'Find clients in your area and grow your business'}
        </p>
      </div>

      {/* Role badge + change button */}
      <div className="flex items-center justify-between mb-6 px-4 py-3 rounded-xl
                      bg-white/5 border border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{selectedRole === 'customer' ? '🙋' : '🔧'}</span>
          <p className="text-white font-semibold text-sm capitalize">
            {selectedRole} Account
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedRole('');
            setValue('role', '');
            setIsOtherCategory(false);
            setCustomCatName('');
          }}
          className="text-white/40 hover:text-white text-xs font-medium transition-colors"
        >
          ← Change
        </button>
      </div>

      {serverError && (
        <div className="mb-5 rounded-xl bg-red-500/15 border border-red-500/30
                        px-4 py-3 text-red-300 text-sm">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <input type="hidden" {...register('role')} />
        <input type="hidden" {...register('categoryName')} />
        <input type="hidden" {...register('categoryId')} />

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Full Name</label>
          <input
            {...register('name')}
            placeholder="Your full name"
            className={inputCls}
            autoComplete="name"
          />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-1.5">Email Address</label>
          <input
            {...register('email')}
            type="email"
            placeholder="you@example.com"
            className={inputCls}
            autoComplete="email"
          />
          {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
        </div>

        {/* Passwords */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Password</label>
            <input
              {...register('password')}
              type="password"
              placeholder="Min. 8 characters"
              className={inputCls}
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">Confirm Password</label>
            <input
              {...register('confirmPassword')}
              type="password"
              placeholder="Repeat password"
              className={inputCls}
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        {/* Category — workers only */}
        {selectedRole === 'worker' && (
          <div>
            <label className="block text-sm font-medium text-white/60 mb-1.5">
              Your Service Category *
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
                value={isOtherCategory ? 'other' : (categoryId.startsWith('pending-') ? 'other' : categoryId)}
                onChange={handleCategorySelect}
                className={`${inputCls} appearance-none`}
              >
                <option value="" className="bg-gray-900">Select a category…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">
                    {c.name}
                  </option>
                ))}
                <option value="other" className="bg-gray-900">
                  ➕ Other — suggest a new category
                </option>
              </select>
            )}

            {errors.categoryId && (
              <p className="mt-1 text-xs text-red-400">{errors.categoryId.message}</p>
            )}

            {/* "Other" typed input */}
            {isOtherCategory && (
              <div className="mt-2 space-y-1">
                <input
                  value={customCatName}
                  onChange={handleCustomCatChange}
                  placeholder="e.g. Solar Panel Installation"
                  className={inputCls}
                  autoFocus
                />
                <p className="text-xs text-white/30 leading-relaxed">
                  Your suggestion will be reviewed by an admin and activated within 24 hours.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Location notice for workers */}
        {selectedRole === 'worker' && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
            <p className="text-amber-300 text-sm font-semibold mb-1">
              📍 Location — set after signup
            </p>
            <p className="text-amber-300/70 text-xs leading-relaxed">
              After creating your account you will be taken to your profile where you can
              set your location so nearby customers can find you.
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 mt-2 bg-white text-gray-900 font-bold text-base rounded-xl
                     hover:bg-gray-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-900
                               rounded-full animate-spin" />
              Creating account…
            </>
          ) : (
            `Create ${selectedRole === 'customer' ? 'Customer' : 'Worker'} Account →`
          )}
        </button>

        <p className="text-center text-white/30 text-xs">
          By signing up you agree to our Terms of Service.
        </p>
      </form>

      <p className="text-center text-white/40 text-sm mt-6">
        Already have an account?{' '}
        <Link href="/auth/login"
              className="text-white/70 hover:text-white font-semibold transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}