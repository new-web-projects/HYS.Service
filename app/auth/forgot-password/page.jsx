'use client';

import { useState }    from 'react';
import Link            from 'next/link';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }           from 'zod';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
});

// ─── Firebase error → readable message ────────────────────────────────────────

function parseFirebaseError(code) {
  const messages = {
    'auth/user-not-found':    'No account exists with this email address.',
    'auth/invalid-email':     'The email address is not valid.',
    'auth/too-many-requests': 'Too many requests. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  };
  return messages[code] ?? 'Something went wrong. Please try again.';
}

// ─── Success state component ──────────────────────────────────────────────────

function SuccessState({ email }) {
  return (
    <div className="w-full max-w-md animate-fade-in-up">

      {/* Success card */}
      <div className="bg-admin-card border border-admin-border rounded-2xl p-8 shadow-xl text-center">

        {/* Icon */}
        <div className="w-16 h-16 bg-emerald-500/15 rounded-2xl flex items-center justify-center
                        mx-auto mb-5 border border-emerald-500/20">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24"
               stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-admin-text mb-2">Check Your Email</h2>

        <p className="text-admin-muted text-sm leading-relaxed mb-2">
          Password reset link has been sent to:
        </p>
        <p className="text-brand-400 font-semibold text-sm mb-5 break-all">{email}</p>

        {/* How it works */}
        <div className="bg-admin-bg border border-admin-border rounded-xl p-4 text-left mb-5 space-y-2">
          <p className="text-xs font-bold text-admin-muted uppercase tracking-widest mb-3">
            How password reset works
          </p>
          {[
            { icon: '1', text: 'Open the email and click the reset link.' },
            { icon: '2', text: 'Set your new password on the Firebase page.' },
            { icon: '3', text: 'Your password updates immediately. Your old password is automatically invalidated.' },
            { icon: '4', text: 'Return here and sign in with your new password.' },
          ].map(({ icon, text }) => (
            <div key={icon} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-brand-600/20 text-brand-400 text-xs
                               font-bold flex items-center justify-center shrink-0 mt-0.5">
                {icon}
              </span>
              <p className="text-admin-muted text-xs leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        {/* ⚠️ Session delay warning */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-base shrink-0">⚠</span>
            <div>
              <p className="text-amber-300 text-xs font-semibold mb-1">
                After resetting your password
              </p>
              <p className="text-amber-300/80 text-xs leading-relaxed">
                After resetting your password from the email link, please wait a few seconds
                before logging in again. Your browser may briefly cache your old session.
                If login fails immediately after reset, wait 5–10 seconds and try once more.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/auth/login"
            className="flex items-center justify-center gap-2 w-full py-3 bg-brand-600
                       hover:bg-brand-700 text-white text-sm font-semibold rounded-xl
                       transition-colors"
          >
            Go to Login
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>

          <p className="text-admin-muted text-xs">
            Didn't receive an email? Check your spam folder or{' '}
            <button
              onClick={() => window.location.reload()}
              className="text-brand-400 hover:text-brand-300 underline transition-colors"
            >
              try again
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [sentEmail,  setSentEmail]  = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  async function onSubmit({ email }) {
    setSubmitting(true);
    setServerError('');

    try {
      const { auth }                   = await import('@/lib/firebase/config');
      const { sendPasswordResetEmail } = await import('firebase/auth');

      await sendPasswordResetEmail(auth, email.trim());

      setSentEmail(email.trim());
      setSubmitted(true);
    } catch (err) {
      setServerError(parseFirebaseError(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-admin-bg flex items-center justify-center px-4 py-12">
        <SuccessState email={sentEmail} />
      </div>
    );
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-admin-bg border border-admin-border text-admin-text ' +
    'text-sm placeholder-admin-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
    'focus:border-transparent disabled:opacity-40 transition-colors';

  return (
    <div className="min-h-screen bg-admin-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-600/15
                          border border-brand-500/20 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-admin-text tracking-tight">Forgot Password?</h1>
          <p className="text-admin-muted mt-2 text-sm leading-relaxed">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        <div className="bg-admin-card border border-admin-border rounded-2xl p-8 shadow-xl">

          {/* Error */}
          {serverError && (
            <div className="mb-5 rounded-xl bg-red-500/10 border border-red-500/20
                            px-4 py-3 flex items-start gap-3">
              <span className="text-red-400 text-base shrink-0 mt-0.5">✕</span>
              <p className="text-red-400 text-sm">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

            <div>
              <label htmlFor="email"
                     className="block text-sm font-medium text-admin-muted mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                disabled={submitting}
                placeholder="you@example.com"
                {...register('email')}
                className={inputCls}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-semibold
                         rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2 text-sm"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white
                                   rounded-full animate-spin" />
                  Sending reset link…
                </>
              ) : 'Send Reset Link'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-admin-muted">
            Remember your password?{' '}
            <Link href="/auth/login"
                  className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}