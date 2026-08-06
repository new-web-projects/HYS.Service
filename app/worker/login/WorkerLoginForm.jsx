'use client';

import { useEffect, useState }        from 'react';
import { useForm }                    from 'react-hook-form';
import { zodResolver }                from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link                           from 'next/link';
import { usePublicAuthStore }         from '@/store/publicAuthStore';
import { loginSchema }                from '@/lib/validators/schemas';
import {
  WorkerIcon, LockIcon, SpinnerIcon, WrenchIcon,
  ArrowRightIcon, UserIcon, KeyIcon,
}                                     from '@/components/icons';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;
const LS_KEY       = 'cms_worker_login_bf';

function readBF()  { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') ?? { count: 0, lockedUntil: null }; } catch { return { count: 0, lockedUntil: null }; } }
function writeBF(v){ try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }
function clearBF() { try { localStorage.removeItem(LS_KEY); } catch {} }
function toMMSS(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export default function WorkerLoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const { login } = usePublicAuthStore();

  const [serverError, setServerError] = useState('');
  const [isLocked,    setIsLocked]    = useState(false);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [submitting,  setSubmitting]  = useState(false);

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
  }, []);

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
    console.debug('[WorkerLogin] Attempting login for:', email);

    try {
      const { user } = await login(email, password);

      // PART 5: Debug log — remove after confirming fix
      console.debug('[WorkerLogin] Login resolved. uid:', user?.uid, 'role:', user?.role);

      /**
       * BUG FIX: Previously this check used strict 'worker' comparison which
       * failed if role was stored as 'Worker' (capital W).
       * publicAuthStore.normalizeRole() now lowercases all roles before returning,
       * so this comparison is always correct.
       *
       * IMPORTANT: isVerified and isAvailable are NOT checked here.
       * Workers can log in regardless of verification or availability status.
       */
      if (user?.role !== 'worker') {
        const { logout } = usePublicAuthStore.getState();
        await logout();

        let msg = 'This email is not registered as a worker account.';
        if (user?.role === 'customer') {
          msg = 'This is a customer account. Please use the Customer login page.';
        } else if (['admin', 'superadmin', 'editor'].includes(user?.role)) {
          msg = 'Admin accounts must use the Admin login page at /admin/login.';
        }

        setServerError(msg);
        setSubmitting(false);
        return;
      }

      clearBF();
      console.debug('[WorkerLogin] Success — redirecting to /worker-dashboard');
      router.replace('/worker-dashboard');

    } catch (err) {
      // PART 5: Debug log — remove after confirming fix
      console.error('[WorkerLogin] Login error:', err.message);

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
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-white/15 text-white text-sm ' +
    'placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400/60 ' +
    'focus:border-blue-400/40 disabled:opacity-40 transition-all duration-150';

  return (
    <div className="w-full max-w-md">

      {/* Header */}
      <div className="text-center mb-8">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4
                     shadow-lg border border-white/20"
          style={{ background: 'linear-gradient(135deg, #1e40af, #1d4ed8)' }}
        >
          <WrenchIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Worker Portal</h1>
        <p className="text-white/50 mt-2 text-sm">HYS Services — Professional Login</p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full
                        bg-green-500/15 border border-green-400/25">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Worker Access</span>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

        {/* Lockout */}
        {isLocked && (
          <div className="mb-6 rounded-xl bg-red-500/15 border border-red-500/25 p-4">
            <p className="font-semibold text-red-300 mb-1">Account Temporarily Locked</p>
            <p className="text-red-400 text-sm">
              Too many failed attempts. Try again in{' '}
              <span className="font-mono font-bold text-red-200">{toMMSS(lockSeconds)}</span>.
            </p>
          </div>
        )}

        {/* Error */}
        {serverError && !isLocked && (
          <div className="mb-5 rounded-xl bg-red-500/15 border border-red-400/25
                          px-4 py-3 text-red-300 text-sm leading-relaxed">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-1.5">
              Registered Email
            </label>
            <input
              id="email" type="email" autoComplete="email"
              disabled={isLocked || submitting}
              placeholder="worker@example.com"
              {...register('email')}
              className={inputCls}
            />
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="text-sm font-medium text-white/70">
                Password
              </label>
              {/*
                PART 2: "Forgot Password" link — visually highlighted with
                background + border so it is unmissable on mobile
              */}
              <Link
                href="/auth/forgot-password"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                           bg-blue-500/20 border border-blue-400/30 text-blue-300
                           hover:bg-blue-500/30 hover:text-blue-200 text-xs font-semibold
                           transition-all duration-150"
              >
                <KeyIcon className="w-3 h-3" />
                Forgot Password?
              </Link>
            </div>
            <input
              id="password" type="password" autoComplete="current-password"
              disabled={isLocked || submitting}
              placeholder="••••••••"
              {...register('password')}
              className={inputCls}
            />
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLocked || submitting}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold
                       rounded-xl transition-all duration-150 disabled:opacity-40
                       disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm
                       shadow-lg hover:shadow-blue-500/25"
          >
            {submitting ? (
              <>
                <SpinnerIcon className="w-4 h-4" />
                Authenticating…
              </>
            ) : (
              <>
                <WorkerIcon className="w-4 h-4" />
                Access Worker Portal
                <ArrowRightIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/*
          PART 2: Bottom links — each is visually distinct with its own
          highlighted pill style so they are readable on mobile
        */}
        <div className="mt-7 pt-5 border-t border-white/10 space-y-3">

          <p className="text-white/40 text-xs text-center uppercase tracking-widest font-medium">
            Other Options
          </p>

          {/* Customer Login — highlighted */}
          <Link
            href="/auth/login"
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl
                       bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20
                       transition-all duration-150 group"
          >
            <div className="flex items-center gap-2.5">
              <UserIcon className="w-4 h-4 text-white/40 group-hover:text-white/70 transition-colors" />
              <span className="text-white/60 group-hover:text-white/90 text-sm font-medium
                               transition-colors">
                Customer Login
              </span>
            </div>
            <ArrowRightIcon className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
          </Link>

          {/* Register as Worker — highlighted, more prominent */}
          <Link
            href="/worker/signup"
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl
                       bg-blue-500/10 border border-blue-400/20 hover:bg-blue-500/20
                       hover:border-blue-400/40 transition-all duration-150 group"
          >
            <div className="flex items-center gap-2.5">
              <WrenchIcon className="w-4 h-4 text-blue-400/70 group-hover:text-blue-300 transition-colors" />
              <span className="text-blue-300/80 group-hover:text-blue-200 text-sm font-semibold
                               transition-colors">
                Register as Worker
              </span>
            </div>
            <ArrowRightIcon className="w-4 h-4 text-blue-400/40 group-hover:text-blue-300 transition-colors" />
          </Link>

        </div>
      </div>
    </div>
  );
}