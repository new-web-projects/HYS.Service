'use client';

import { useEffect, useState }        from 'react';
import { useForm }                    from 'react-hook-form';
import { zodResolver }                from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link                           from 'next/link';
import { usePublicAuthStore }         from '@/store/publicAuthStore';
import { loginSchema }                from '@/lib/validators/schemas';
import { AdminIcon, LockIcon, SpinnerIcon } from '@/components/icons';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;
const LS_KEY       = 'cms_admin_login_bf';

function readBF()  { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? 'null') ?? { count: 0, lockedUntil: null }; } catch { return { count: 0, lockedUntil: null }; } }
function writeBF(v){ try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }
function clearBF() { try { localStorage.removeItem(LS_KEY); } catch {} }
function toMMSS(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export default function AdminLoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get('redirect') ?? '/dashboard';

  const { adminLogin } = usePublicAuthStore();

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

    try {
      const { user } = await adminLogin(email, password);

      clearBF();
      // BUG FIX: this always redirected to '/dashboard', ignoring the
      // `redirectTo` value already computed from `?redirect=` above. An
      // admin sent here by middleware after trying to open a specific
      // protected page (e.g. /admin/login?redirect=/settings) would land
      // back on the dashboard instead of the page they wanted.
      router.replace(redirectTo);
    } catch (err) {
      const bf   = readBF();
      bf.count   = (bf.count ?? 0) + 1;
      if (bf.count >= MAX_ATTEMPTS) {
        bf.lockedUntil = Date.now() + LOCKOUT_MS;
        bf.count       = 0;
        writeBF(bf);
        setIsLocked(true);
        setLockSeconds(Math.ceil(LOCKOUT_MS / 1000));
      } else {
        writeBF(bf);
        const left = MAX_ATTEMPTS - bf.count;
        setServerError(`Invalid credentials. ${left} attempt(s) remaining.`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-admin-bg border border-admin-border text-admin-text ' +
    'text-sm placeholder-admin-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
    'focus:border-transparent disabled:opacity-40 transition-colors';

  return (
    <div className="w-full max-w-md">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600
                        rounded-2xl mb-4 shadow-lg">
          <AdminIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-admin-text tracking-tight">Admin Login</h1>
        <p className="text-admin-muted mt-2 text-sm">
          HYS Services — Admin Panel
        </p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full
                        bg-brand-600/10 border border-brand-500/20">
          <div className="w-2 h-2 rounded-full bg-brand-400" />
          <span className="text-brand-400 text-xs font-semibold">Admin Access Only</span>
        </div>
      </div>

      <div className="bg-admin-card border border-admin-border rounded-2xl p-8 shadow-xl">

        {isLocked && (
          <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/25 p-4">
            <p className="font-semibold text-red-400 mb-1">Account Temporarily Locked</p>
            <p className="text-red-300 text-sm">
              Try again in{' '}
              <span className="font-mono font-bold text-red-200">{toMMSS(lockSeconds)}</span>.
            </p>
          </div>
        )}

        {serverError && !isLocked && (
          <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20
                          px-4 py-3 text-red-400 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-admin-muted mb-1.5">
              Admin Email
            </label>
            <input
              id="email" type="email" autoComplete="email"
              disabled={isLocked || submitting} placeholder="admin@hysservices.com"
              {...register('email')}
              className={inputCls}
            />
            {errors.email && <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="text-sm font-medium text-admin-muted">
                Password
              </label>
              <Link href="/auth/forgot-password"
                    className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                Forgot password?
              </Link>
            </div>
            <input
              id="password" type="password" autoComplete="current-password"
              disabled={isLocked || submitting} placeholder="••••••••"
              {...register('password')}
              className={inputCls}
            />
            {errors.password && <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isLocked || submitting}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold
                       rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? (
              <>
                <SpinnerIcon className="w-4 h-4" />
                Authenticating…
              </>
            ) : (
              <>
                <LockIcon className="w-4 h-4" />
                Access Admin Panel
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-admin-border">
          <p className="text-admin-muted text-xs text-center">
            Not an admin?{' '}
            <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 transition-colors">
              Customer login
            </Link>
            {' · '}
            <Link href="/worker/login" className="text-brand-400 hover:text-brand-300 transition-colors">
              Worker login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}