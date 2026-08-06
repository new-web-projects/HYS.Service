'use client';

import { useEffect, useState }        from 'react';
import { useForm }                    from 'react-hook-form';
import { zodResolver }                from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link                           from 'next/link';
import { usePublicAuthStore }         from '@/store/publicAuthStore';
import { loginSchema }                from '@/lib/validators/schemas';
import {
  UserIcon, LockIcon, SpinnerIcon,
  ArrowRightIcon, WrenchIcon, KeyIcon,
}                                     from '@/components/icons';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;
const LS_KEY       = 'cms_customer_login_bf';
const RESET_KEY    = 'cms_recent_reset';

function readBF()  { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') ?? { count: 0, lockedUntil: null }; } catch { return { count: 0, lockedUntil: null }; } }
function writeBF(v){ try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }
function clearBF() { try { localStorage.removeItem(LS_KEY); } catch {} }
function toMMSS(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function wasRecentReset() { try { const t = parseInt(localStorage.getItem(RESET_KEY) ?? '0', 10); return t > 0 && Date.now() - t < 10 * 60 * 1000; } catch { return false; } }
function clearRecentReset() { try { localStorage.removeItem(RESET_KEY); } catch {} }

export default function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get('redirect');
  const fromReset    = searchParams.get('from') === 'reset';

  const { login } = usePublicAuthStore();

  const [serverError,   setServerError]   = useState('');
  const [showResetHint, setShowResetHint] = useState(false);
  const [isLocked,      setIsLocked]      = useState(false);
  const [lockSeconds,   setLockSeconds]   = useState(0);
  const [submitting,    setSubmitting]    = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    const bf = readBF();
    if (bf.lockedUntil && Date.now() < bf.lockedUntil) {
      setIsLocked(true);
      setLockSeconds(Math.ceil((bf.lockedUntil - Date.now()) / 1000));
    } else if (bf.lockedUntil) {
      clearBF();
    }
    if (fromReset || wasRecentReset()) setShowResetHint(true);
  }, [fromReset]);

  useEffect(() => {
    if (!isLocked) return;
    const id = setInterval(() => {
      const bf = readBF();
      if (!bf.lockedUntil || Date.now() >= bf.lockedUntil) {
        clearBF(); setIsLocked(false); setLockSeconds(0); setServerError('');
      } else {
        setLockSeconds(Math.ceil((bf.lockedUntil - Date.now()) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isLocked]);

  async function onSubmit({ email, password }) {
    if (isLocked) return;
    setSubmitting(true);
    setServerError('');

    // PART 5: Debug log — remove after confirming fix
    console.debug('[CustomerLogin] Attempting login for:', email);

    try {
      const { user } = await login(email, password);

      // PART 5: Debug log — remove after confirming fix
      console.debug('[CustomerLogin] Resolved role:', user?.role);

      const REDIRECTS = {
        customer:   redirectTo ?? '/customer-dashboard',
        worker:     '/worker-dashboard',
        admin:      '/dashboard',
        superadmin: '/dashboard',
        editor:     '/dashboard',
      };

      clearBF();
      clearRecentReset();
      router.replace(REDIRECTS[user?.role] ?? '/customer-dashboard');

    } catch (err) {
      console.error('[CustomerLogin] Error:', err.message);

      const bf = readBF();
      bf.count = (bf.count ?? 0) + 1;

      if (bf.count >= MAX_ATTEMPTS) {
        bf.lockedUntil = Date.now() + LOCKOUT_MS;
        bf.count       = 0;
        writeBF(bf);
        setIsLocked(true);
        setLockSeconds(Math.ceil(LOCKOUT_MS / 1000));
      } else {
        writeBF(bf);
        const left = MAX_ATTEMPTS - bf.count;
        setServerError(`${err.message} ${left} attempt(s) remaining.`);
        if (wasRecentReset()) setShowResetHint(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 text-sm ' +
    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
    'focus:border-transparent disabled:opacity-40 transition-colors bg-white';

  return (
    <div className="w-full max-w-md">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600
                        rounded-2xl mb-4 shadow-lg">
          <UserIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome Back</h1>
        <p className="text-gray-500 mt-2 text-sm">Sign in to your customer account</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-xl">

        {/* Post-reset hint */}
        {showResetHint && (
          <div className="mb-5 rounded-xl bg-blue-50 border border-blue-200 p-4 animate-fade-in">
            <div className="flex items-start gap-3">
              <LockIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-blue-800 text-sm font-semibold mb-0.5">
                  Recently reset your password?
                </p>
                <p className="text-blue-700 text-xs leading-relaxed">
                  Please wait a few seconds before logging in again. If it still fails,
                  wait 5–10 seconds and try once more.
                </p>
              </div>
              <button onClick={() => setShowResetHint(false)}
                      className="text-blue-400 hover:text-blue-600 text-lg -mt-0.5">
                ×
              </button>
            </div>
          </div>
        )}

        {/* Lockout */}
        {isLocked && (
          <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-4">
            <p className="font-semibold text-red-700 mb-1">Account Temporarily Locked</p>
            <p className="text-red-600 text-sm">
              Try again in{' '}
              <span className="font-mono font-bold">{toMMSS(lockSeconds)}</span>.
            </p>
          </div>
        )}

        {/* Error */}
        {serverError && !isLocked && (
          <div className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3
                          text-red-700 text-sm">
            {serverError}
            {showResetHint && (
              <p className="text-red-500 text-xs mt-1.5">
                If you just reset your password, please wait a few seconds and try again.
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              id="email" type="email" autoComplete="email"
              disabled={isLocked || submitting} placeholder="you@example.com"
              {...register('email')}
              className={inputCls}
            />
            {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                           bg-blue-50 border border-blue-200 text-blue-600
                           hover:bg-blue-100 text-xs font-semibold transition-all"
              >
                <KeyIcon className="w-3 h-3" />
                Forgot Password?
              </Link>
            </div>
            <input
              id="password" type="password" autoComplete="current-password"
              disabled={isLocked || submitting} placeholder="••••••••"
              {...register('password')}
              className={inputCls}
            />
            {errors.password && <p className="mt-1.5 text-xs text-red-500">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLocked || submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold
                       rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? (
              <>
                <SpinnerIcon className="w-4 h-4" />
                Signing in…
              </>
            ) : (
              <>
                Sign In
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/*
          PART 2: Removed admin login link from this page.
          Admin login is ONLY at /admin/login.
          Only worker login reference is kept here.
        */}
        <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link href="/auth/signup"
                  className="text-blue-600 hover:text-blue-800 font-semibold transition-colors">
              Create one free
            </Link>
          </p>
          <Link
            href="/worker/login"
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl
                       bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300
                       transition-all duration-150 group"
          >
            <div className="flex items-center gap-2.5">
              <WrenchIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              <span className="text-gray-500 group-hover:text-gray-700 text-sm font-medium
                               transition-colors">
                Signing in as a Worker?
              </span>
            </div>
            <ArrowRightIcon className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}