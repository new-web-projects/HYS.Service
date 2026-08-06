'use client';

import { useEffect, useState, useCallback } from 'react';
import { useForm, Controller }              from 'react-hook-form';
import { zodResolver }                      from '@hookform/resolvers/zod';
import { useToast }                         from '@/components/shared/Toast';
import { settingsSchema }                   from '@/lib/validators/schemas';
import LoadingSpinner                       from '@/components/shared/LoadingSpinner';
import {
  SettingsIcon, SpinnerIcon, CheckIcon, GlobeIcon,
  PaymentIcon, WarningIcon, InfoIcon, BugIcon,
}                                           from '@/components/icons';
import { invalidatePricingCache, getFeeRows } from '@/lib/pricing';

// ─── Developer Tools — Error Reveal toggle ────────────────────────────────────
// Reads/writes localStorage key `hys_error_reveal`.
// Synced with the global ErrorProvider panel toggle.

function DevToolsSection() {
  const [revealOn, setRevealOn] = useState(true);
  const toast = useToast((s) => s.show);

  // Read from localStorage on mount
  useEffect(() => {
    try {
      const v = localStorage.getItem('hys_error_reveal');
      setRevealOn(v === null ? true : v !== 'false');
    } catch { /* default true */ }
  }, []);

  function handleToggle(val) {
    setRevealOn(val);
    try {
      localStorage.setItem('hys_error_reveal', String(val));
      toast(
        val
          ? 'Error Reveal ON — technical details visible in the panel.'
          : 'Error Reveal OFF — professional error page will be shown to users.',
        'success',
      );
    } catch {
      toast('Could not save setting.', 'error');
    }
  }

  return (
    <div className="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <BugIcon className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h2 className="text-admin-text font-bold text-base">Developer Tools</h2>
          <p className="text-admin-muted text-xs">Debugging and error visibility settings</p>
        </div>
      </div>

      {/* Error Reveal row */}
      <div className="flex items-start justify-between gap-4 p-4 rounded-xl"
        style={{ background: 'var(--admin-bg, rgba(9,9,11,0.5))', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex-1 min-w-0">
          <p className="text-admin-text text-sm font-semibold">Error Reveal System</p>
          <p className="text-admin-muted text-xs mt-0.5 leading-relaxed">
            <strong className="text-admin-text">ON</strong> — floating developer panel shows full error details
            (type, file, function, route, stack trace, user context).<br />
            <strong className="text-admin-text">OFF</strong> — clean &ldquo;Something went wrong&rdquo; page is shown
            without exposing technical details.
          </p>
          <p className="text-xs mt-2 font-mono" style={{ color: '#52525b' }}>
            Stored in <code>localStorage.hys_error_reveal</code> · applies immediately · per-browser
          </p>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => handleToggle(!revealOn)}
          className="relative shrink-0 mt-0.5"
          aria-label={`Error Reveal ${revealOn ? 'ON' : 'OFF'}`}
          title={`Click to turn ${revealOn ? 'off' : 'on'}`}
        >
          <span
            className="block w-12 h-6 rounded-full transition-colors duration-200"
            style={{ background: revealOn ? '#dc2626' : 'rgba(63,63,70,0.6)' }}
          />
          <span
            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
            style={{ transform: revealOn ? 'translateX(24px)' : 'translateX(0)' }}
          />
        </button>
      </div>

      {/* State indicator */}
      <div className="flex items-center gap-2 text-xs"
        style={{ color: revealOn ? '#f87171' : '#71717a' }}>
        <span className={`w-1.5 h-1.5 rounded-full ${revealOn ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
        Error Reveal is currently{' '}
        <strong className={revealOn ? 'text-red-400' : 'text-zinc-500'}>
          {revealOn ? 'ENABLED' : 'DISABLED'}
        </strong>
        {' '}on this browser.
        <a href="/error-center" className="ml-2 text-indigo-400 hover:underline font-semibold">
          View Error Center →
        </a>
      </div>
    </div>
  );
}

const MODE = process.env.NEXT_PUBLIC_BACKEND_MODE;

// ─── Firestore helpers ───────────────────────────────────────────────────────

async function fetchSettings() {
  if (MODE === 'firebase') {
    const { db }          = await import('@/lib/firebase/config');
    const { doc, getDoc } = await import('firebase/firestore');
    try {
      const snap = await getDoc(doc(db, 'settings', 'global'));
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.error('[settings] fetch:', err.message);
      return null;
    }
  }
  if (MODE === 'server') {
    try {
      const res = await fetch('/api/settings', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data[0] : data;
    } catch (err) {
      console.error('[settings] server fetch:', err.message);
      return null;
    }
  }
  return null;
}

async function saveSettings(data) {
  if (MODE === 'firebase') {
    const { db }                      = await import('@/lib/firebase/config');
    const { doc, setDoc, Timestamp }  = await import('firebase/firestore');
    await setDoc(doc(db, 'settings', 'global'), {
      siteName:             data.siteName             ?? 'My Site',
      logoUrl:              data.logoUrl              ?? '',
      primaryColor:         data.primaryColor         ?? '#3B82F6',
      socialLinks:          data.socialLinks          ?? {},
      contactEmail:         data.contactEmail         ?? '',
      footerText:           data.footerText           ?? '',
      razorpayKeyId:        data.razorpayKeyId        ?? '',
      razorpayKeySecret:    data.razorpayKeySecret    ?? '',
      razorpayMerchantName: data.razorpayMerchantName ?? '',
      razorpaySupportEmail: data.razorpaySupportEmail ?? '',
      platformFeePercent:   data.platformFeePercent   ?? 10,
      platformFeeType:      data.platformFeeType      ?? 'percent',
      platformFixed:        data.platformFixed        ?? 0,
      gstPercent:           data.gstPercent           ?? 18,
      gstModeEnabled:       data.gstModeEnabled       ?? false,
      maintenanceMode:      data.maintenanceMode      ?? false,
      maintenanceMessage:   data.maintenanceMessage   ?? '',
      estimatedReturn:      data.estimatedReturn      ?? '',
      withdrawalFee:        data.withdrawalFee        ?? 11,
      updatedAt:            Timestamp.now(),
    });

    // Also save platform fee config to settings/platform
    // (read by withdrawalStore.loadProcessingFee)
    await setDoc(doc(db, 'settings', 'platform'), {
      platformFee:     data.platformFeePercent ?? 10,
      platformFeeType: data.platformFeeType    ?? 'percent',
      platformFixed:   data.platformFixed      ?? 0,
      withdrawalFee:   data.withdrawalFee      ?? 11,
      gstPercent:      data.gstPercent         ?? 18,
      gstModeEnabled:  data.gstModeEnabled     ?? false,
      updatedAt:       Timestamp.now(),
    });
    // Invalidate client-side pricing cache so new fee rates apply immediately
    invalidatePricingCache();
    return;
  }
  if (MODE === 'server') {
    const res = await fetch('/api/settings', {
      method:      'PUT',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? 'Failed to save settings.');
    }
  }
}

// ─── Color picker ─────────────────────────────────────────────────────────────

const PRESET_COLORS = [
  '#3B82F6', '#2563EB', '#7C3AED', '#DB2777',
  '#DC2626', '#EA580C', '#16A34A', '#0D9488',
  '#0891B2', '#4F46E5', '#9333EA', '#1D4ED8',
];

function ColorPicker({ value, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const safeValue = value || '#3B82F6';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={`w-8 h-8 rounded-lg border-2 transition-all
                        ${safeValue === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent hover:scale-105'}`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className="w-8 h-8 rounded-lg border-2 border-admin-border bg-admin-bg
                     text-admin-muted text-xs font-bold hover:border-admin-muted
                     transition-colors"
        >
          +
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={safeValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded-lg cursor-pointer border border-admin-border bg-admin-bg"
          />
          <input
            type="text"
            value={safeValue}
            onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
            placeholder="#3B82F6"
            className="flex-1 px-3 py-2 rounded-lg bg-admin-bg border border-admin-border
                       text-admin-text text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            maxLength={7}
          />
          <div className="w-10 h-10 rounded-lg border border-admin-border shrink-0"
               style={{ backgroundColor: safeValue }} />
        </div>
      )}
    </div>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const toast = useToast((s) => s.show);

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const DEFAULTS = {
    siteName:             'My Site',
    logoUrl:              '',
    primaryColor:         '#3B82F6',
    socialLinks:          { facebook: '', twitter: '', instagram: '' },
    contactEmail:         '',
    footerText:           '',
    razorpayKeyId:        '',
    razorpayKeySecret:    '',
    razorpayMerchantName: '',
    razorpaySupportEmail: '',
    platformFeePercent:   10,
    platformFeeType:      'percent',
    platformFixed:        0,
    gstPercent:           18,
    gstModeEnabled:       false,
    maintenanceMode:      false,
    maintenanceMessage:   'We are performing scheduled maintenance. Please check back soon.',
    estimatedReturn:      '',
    withdrawalFee:        11,
  };

  const {
    register, handleSubmit, setValue, watch, control, reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver:      zodResolver(settingsSchema),
    defaultValues: DEFAULTS,
  });

  const primaryColor      = watch('primaryColor');
  const siteName          = watch('siteName');
  const platformFeePercent = watch('platformFeePercent');
  const platformFeeType    = watch('platformFeeType');
  const platformFixed      = watch('platformFixed') ?? 0;
  const gstPercent         = watch('gstPercent');
  const gstModeEnabled     = watch('gstModeEnabled');
  const maintenanceMode    = watch('maintenanceMode');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchSettings();
      if (data) {
        reset({
          siteName:             data.siteName             ?? DEFAULTS.siteName,
          logoUrl:              data.logoUrl              ?? '',
          primaryColor:         data.primaryColor         ?? DEFAULTS.primaryColor,
          socialLinks: {
            facebook:  data.socialLinks?.facebook  ?? '',
            twitter:   data.socialLinks?.twitter   ?? '',
            instagram: data.socialLinks?.instagram ?? '',
          },
          contactEmail:         data.contactEmail         ?? '',
          footerText:           data.footerText           ?? '',
          razorpayKeyId:        data.razorpayKeyId        ?? '',
          razorpayKeySecret:    data.razorpayKeySecret    ?? '',
          razorpayMerchantName: data.razorpayMerchantName ?? '',
          razorpaySupportEmail: data.razorpaySupportEmail ?? '',
          platformFeePercent:   data.platformFeePercent   ?? 10,
          platformFeeType:      data.platformFeeType      ?? 'percent',
          platformFixed:        data.platformFixed        ?? 0,
          gstPercent:           data.gstPercent           ?? 18,
          gstModeEnabled:       data.gstModeEnabled       ?? false,
          maintenanceMode:      data.maintenanceMode      ?? false,
          maintenanceMessage:   data.maintenanceMessage   ?? DEFAULTS.maintenanceMessage,
          estimatedReturn:      data.estimatedReturn      ?? '',
          withdrawalFee:        data.withdrawalFee        ?? 11,
        });
      }
    } catch (err) {
      setError('Failed to load settings. Please refresh.');
      console.error('[SettingsPage]', err.message);
    } finally {
      setLoading(false);
    }
  }, [reset]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function onSubmit(data) {
    setSaving(true);
    try {
      await saveSettings(data);
      toast('Settings saved successfully!', 'success');
      reset(data);
    } catch (err) {
      toast(err.message ?? 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    'w-full px-4 py-3 rounded-xl bg-admin-bg border border-admin-border text-admin-text ' +
    'text-sm placeholder-admin-muted/40 focus:outline-none focus:ring-2 focus:ring-brand-500 ' +
    'focus:border-transparent transition-colors';

  const labelCls = 'block text-sm font-medium text-admin-muted mb-1.5';

  // Pricing preview calculation
  const previewBase  = 1000;
  const previewPf    = platformFeeType === 'fixed'
    ? parseFloat((platformFixed ?? 0).toFixed(2))
    : parseFloat((previewBase * (platformFeePercent ?? 10) / 100).toFixed(2));
  // GST applies ONLY on platform fee (not on worker earnings) — matches lib/pricing.js
  const previewGst   = parseFloat((previewPf * (gstPercent ?? 18) / 100).toFixed(2));
  const previewTotal = previewBase + previewPf + previewGst;

  // Withdrawal fee preview
  const withdrawalFeeWatch = watch('withdrawalFee') ?? 11;
  const previewWithdrawal  = 1000;
  const previewWdFee       = parseFloat((previewWithdrawal * withdrawalFeeWatch / 100).toFixed(2));
  const previewWdReceive   = previewWithdrawal - previewWdFee;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" label="Loading settings…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
          <p className="text-red-400 font-semibold mb-2">Failed to Load Settings</p>
          <p className="text-red-400/70 text-sm mb-4">{error}</p>
          <button onClick={loadSettings}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400
                             rounded-xl text-sm font-medium transition-colors">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-admin-text flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-admin-muted" />
            Site Settings
          </h1>
          <p className="text-admin-muted text-sm mt-0.5">
            Configure site appearance, pricing, and system settings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold
                             bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Unsaved changes
            </span>
          )}
          {maintenanceMode && (
            <span className="px-3 py-1 rounded-full text-xs font-bold
                             bg-red-500/20 text-red-400 border border-red-500/30
                             animate-pulse">
              MAINTENANCE ON
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">

        {/* ── 1. Branding ─────────────────────────────────────────────────── */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-admin-text flex items-center gap-2">
            <GlobeIcon className="w-4 h-4 text-admin-muted" />
            Branding
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Site Name *</label>
              <input {...register('siteName')} placeholder="My Site" className={inputCls} />
              {errors.siteName && (
                <p className="mt-1 text-xs text-red-400">{errors.siteName.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Contact Email</label>
              <input {...register('contactEmail')} type="email"
                     placeholder="hello@yoursite.com" className={inputCls} />
              {errors.contactEmail && (
                <p className="mt-1 text-xs text-red-400">{errors.contactEmail.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Logo URL</label>
            <input {...register('logoUrl')} placeholder="https://res.cloudinary.com/..."
                   className={inputCls} />
            <p className="mt-1 text-xs text-admin-muted/60">
              Upload to Media Library and paste the URL here.
            </p>
            {errors.logoUrl && (
              <p className="mt-1 text-xs text-red-400">{errors.logoUrl.message}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>
              Brand Color
              <span className="ml-2 font-mono text-brand-400 text-xs">
                {primaryColor || '#3B82F6'}
              </span>
            </label>
            <Controller
              name="primaryColor"
              control={control}
              render={({ field }) => (
                <ColorPicker value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.primaryColor && (
              <p className="mt-1 text-xs text-red-400">{errors.primaryColor.message}</p>
            )}
          </div>

          {/* Live preview */}
          <div className="rounded-xl overflow-hidden border border-admin-border">
            <div className="bg-admin-bg px-4 py-2 text-xs text-admin-muted font-medium
                            border-b border-admin-border">
              Live Preview — Header
            </div>
            <div className="bg-white px-4 py-3 flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center
                           text-white font-bold text-sm"
                style={{ backgroundColor: primaryColor || '#3B82F6' }}
              >
                {(siteName || 'S')[0].toUpperCase()}
              </div>
              <span className="font-bold text-gray-900 text-sm">{siteName || 'My Site'}</span>
              <div className="ml-auto">
                <span
                  className="px-3 py-1 rounded-lg text-white text-xs font-semibold"
                  style={{ backgroundColor: primaryColor || '#3B82F6' }}
                >
                  Get Started
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Social Links ──────────────────────────────────────────────── */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-admin-text">Social Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'socialLinks.facebook',  label: 'Facebook',  ph: 'https://facebook.com/...' },
              { name: 'socialLinks.twitter',   label: 'X/Twitter', ph: 'https://twitter.com/...' },
              { name: 'socialLinks.instagram', label: 'Instagram', ph: 'https://instagram.com/...' },
            ].map(({ name, label, ph }) => (
              <div key={name}>
                <label className={labelCls}>{label}</label>
                <input {...register(name)} placeholder={ph} className={inputCls} />
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. Footer ────────────────────────────────────────────────────── */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-admin-text">Footer</h2>
          <div>
            <label className={labelCls}>Footer Text</label>
            <input
              {...register('footerText')}
              placeholder={`© ${new Date().getFullYear()} My Site. All rights reserved.`}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-admin-muted/60">
              Leave blank to use the default copyright text.
            </p>
          </div>
        </div>

        {/* ── 4. Pricing ───────────────────────────────────────────────────── */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-admin-text flex items-center gap-2">
              <PaymentIcon className="w-4 h-4 text-admin-muted" />
              Pricing Configuration
            </h2>
            <p className="text-admin-muted text-xs mt-1">
              Applied to every worker quote to calculate the final customer price.
            </p>
          </div>

          {/* ── Enable GST Mode toggle (Part 6) ─────────────────────────────
               Controls whether GST/CGST/SGST/IGST terminology and breakdown
               rows are shown to customers/workers platform-wide. The rate
               below (GST %) and gstAmount are ALWAYS calculated and stored
               regardless of this setting — only display labels change. */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl
                          bg-admin-bg border border-admin-border">
            <div className="flex-1 min-w-0">
              <p className="text-admin-text text-sm font-semibold">Enable GST Mode</p>
              <p className="text-admin-muted text-xs mt-0.5 leading-relaxed">
                <strong className="text-admin-text">ON</strong> — customers and workers see a full
                GST breakdown (Base Amount, GST %, GST Amount, Final Amount) across checkout,
                bookings, invoices, earnings, and withdrawals.<br />
                <strong className="text-admin-text">OFF</strong> — GST/tax wording is hidden;
                the platform fee and GST amount are combined into a single
                &ldquo;Platform Fee&rdquo; line, and only the final payable amount is shown.
              </p>
              <p className="text-xs mt-2 font-mono text-admin-muted/60">
                The GST % rate below is always stored and used in calculations,
                even when OFF.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setValue('gstModeEnabled', !gstModeEnabled, { shouldDirty: true })}
              className="relative shrink-0 mt-0.5"
              aria-label={`GST Mode ${gstModeEnabled ? 'ON' : 'OFF'}`}
              title={`Click to turn ${gstModeEnabled ? 'off' : 'on'}`}
            >
              <span
                className="block w-12 h-6 rounded-full transition-colors duration-200"
                style={{ background: gstModeEnabled ? '#3b82f6' : 'rgba(63,63,70,0.6)' }}
              />
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: gstModeEnabled ? 'translateX(24px)' : 'translateX(0)' }}
              />
            </button>
          </div>

          {/* Formula */}
          <div className="bg-admin-bg border border-admin-border rounded-xl p-4 text-xs
                          font-mono text-admin-muted space-y-1">
            <p><span className="text-brand-400">PLATFORM_FEE</span> = BASE × PLATFORM_FEE%</p>
            <p><span className="text-blue-400">GST</span> = PLATFORM_FEE × GST% &nbsp;<span className="text-amber-400">(GST on platform fee only)</span></p>
            <p><span className="text-emerald-400">FINAL</span> = BASE + PLATFORM_FEE + GST</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Fee type toggle + inputs */}
            <div className="sm:col-span-2 space-y-4">
              <div>
                <label className={labelCls}>Platform Fee Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'percent', label: 'Percentage (%)', desc: 'e.g. 10% of agreed price' },
                    { key: 'fixed',   label: 'Fixed Amount (₹)', desc: 'e.g. ₹100 flat fee' },
                  ].map(({ key, label, desc }) => (
                    <button key={key} type="button"
                      onClick={() => setValue('platformFeeType', key, { shouldDirty: true })}
                      className={`flex flex-col items-start p-3 rounded-xl border-2 text-left
                                  transition-colors
                                  ${platformFeeType === key
                                    ? 'border-brand-500 bg-brand-500/10'
                                    : 'border-admin-border hover:border-admin-muted'}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center
                                          justify-center
                                          ${platformFeeType === key
                                            ? 'border-brand-500'
                                            : 'border-admin-muted'}`}>
                          {platformFeeType === key && (
                            <span className="w-2 h-2 rounded-full bg-brand-500" />
                          )}
                        </span>
                        <span className={`text-sm font-semibold
                          ${platformFeeType === key ? 'text-brand-400' : 'text-admin-text'}`}>
                          {label}
                        </span>
                      </div>
                      <p className="text-admin-muted text-xs pl-5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {platformFeeType === 'percent' ? (
                <div>
                  <label className={labelCls}>Platform Fee %</label>
                  <div className="relative">
                    <input
                      {...register('platformFeePercent', { valueAsNumber: true })}
                      type="number" min="0" max="50" step="0.5"
                      className={inputCls}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-admin-muted text-sm">%</span>
                  </div>
                  {errors.platformFeePercent && (
                    <p className="mt-1 text-xs text-red-400">{errors.platformFeePercent.message}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Fixed Platform Fee (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-admin-muted text-sm">₹</span>
                    <input
                      {...register('platformFixed', { valueAsNumber: true })}
                      type="number" min="0" max="10000" step="10"
                      className={`${inputCls} pl-8`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-admin-muted/60">
                    Flat fee charged regardless of the agreed price.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>GST %</label>
              <div className="relative">
                <input
                  {...register('gstPercent', { valueAsNumber: true })}
                  type="number" min="0" max="30" step="0.5"
                  className={inputCls}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-admin-muted text-sm">%</span>
              </div>
              {errors.gstPercent && (
                <p className="mt-1 text-xs text-red-400">{errors.gstPercent.message}</p>
              )}
              <p className="mt-1 text-xs text-admin-muted/60">
                {gstModeEnabled
                  ? 'Shown to customers as "GST on platform fee".'
                  : 'Stored and applied, but not shown to customers (GST Mode is OFF).'}
              </p>
            </div>
          </div>

          {/* Pricing preview */}
          <div className="bg-admin-bg border border-admin-border rounded-xl p-4">
            <p className="text-xs font-bold text-admin-muted uppercase tracking-widest mb-3">
              Preview — ₹1,000 worker quote
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Worker receives', value: '₹1,000', cls: 'text-admin-text' },
                ...getFeeRows(
                  {
                    platformFee:     previewPf,
                    platformPercent: platformFeePercent ?? 10,
                    platformFeeType,
                    platformFixed,
                    gstAmount:       previewGst,
                    gstPercent:      gstPercent ?? 18,
                  },
                  gstModeEnabled,
                ).map(({ label, value }) => ({
                  label,
                  value: `+₹${value.toLocaleString('en-IN')}`,
                  cls:   'text-admin-muted',
                })),
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-admin-muted">{label}</span>
                  <span className={cls}>{value}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-admin-text
                              pt-2 border-t border-admin-border">
                <span>Customer pays</span>
                <span className="text-brand-400">₹{previewTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── 5. Withdrawal Processing Fee ─────────────────────────────────── */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-admin-text flex items-center gap-2">
              <PaymentIcon className="w-4 h-4 text-admin-muted" />
              Withdrawal Processing Fee
            </h2>
            <p className="text-admin-muted text-xs mt-1">
              Fee charged when a worker withdraws earnings. Already includes GST — do NOT add
              GST separately on top. Applied globally to all withdrawal requests.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
            <div>
              <label className={labelCls}>Processing Fee %</label>
              <div className="relative">
                <input
                  {...register('withdrawalFee', { valueAsNumber: true })}
                  type="number" min="0" max="30" step="0.5"
                  className={inputCls}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-admin-muted text-sm">%</span>
              </div>
              <p className="mt-1 text-xs text-admin-muted/60">
                Default: 11% (includes 18% GST). Example: ₹1,000 × 11% = ₹110 fee.
              </p>
              {errors.withdrawalFee && (
                <p className="mt-1 text-xs text-red-400">{errors.withdrawalFee.message}</p>
              )}
            </div>

            {/* Live withdrawal preview */}
            <div className="bg-admin-bg border border-admin-border rounded-xl p-4">
              <p className="text-xs font-bold text-admin-muted uppercase tracking-widest mb-3">
                Preview — ₹1,000 withdrawal
              </p>
              <div className="space-y-1.5">
                {[
                  { label: 'Withdrawal amount', value: '₹1,000', cls: 'text-admin-text' },
                  {
                    label: gstModeEnabled
                      ? `Processing fee (${withdrawalFeeWatch}%, incl. GST)`
                      : `Processing fee (${withdrawalFeeWatch}%)`,
                    value: `−₹${previewWdFee.toLocaleString('en-IN')}`,
                    cls:   'text-amber-400',
                  },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-admin-muted">{label}</span>
                    <span className={cls}>{value}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold text-admin-text
                                pt-2 border-t border-admin-border">
                  <span>Worker receives in bank</span>
                  <span className="text-emerald-400">₹{previewWdReceive.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20
                          rounded-xl p-4">
            <InfoIcon className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-blue-300 text-xs leading-relaxed">
              Changes take effect immediately for all new withdrawal requests. Existing
              pending withdrawals use the fee that was set when they were created.
            </p>
          </div>
        </div>

        {/* ── 6. Razorpay ──────────────────────────────────────────────────── */}
        <div className="bg-admin-card border border-admin-border rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-admin-text flex items-center gap-2">
                <PaymentIcon className="w-4 h-4 text-admin-muted" />
                Razorpay Payment
              </h2>
              <p className="text-admin-muted text-xs mt-1">
                Option B — store credentials here. Option A is .env.local (recommended).
              </p>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0
                              ${watch('razorpayKeyId')
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-gray-500/10   text-gray-400   border-gray-500/20'}`}>
              {watch('razorpayKeyId') ? 'Configured' : 'Not configured'}
            </span>
          </div>

          <div className="bg-admin-bg border border-admin-border rounded-xl p-4">
            <p className="text-admin-muted text-xs leading-relaxed">
              <strong className="text-admin-text">Option A (Recommended):</strong>{' '}
              Add to <code className="text-brand-400 bg-admin-bg border border-admin-border
                                      px-1.5 py-0.5 rounded text-xs">.env.local</code>:{' '}
              <span className="text-admin-muted/70">
                RAZORPAY_KEY_ID=rzp_live_xxx &nbsp; RAZORPAY_KEY_SECRET=xxx &nbsp;
                NEXT_PUBLIC_PAYMENT_ENABLED=true
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Key ID</label>
              <input {...register('razorpayKeyId')} placeholder="rzp_live_xxxxxxxxxx"
                     className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                Key Secret
                <span className="ml-1.5 text-amber-400 text-xs font-normal">sensitive</span>
              </label>
              <input {...register('razorpayKeySecret')} type="password"
                     placeholder="••••••••••••••••••••" className={inputCls}
                     autoComplete="new-password" />
            </div>
            <div>
              <label className={labelCls}>Merchant Name</label>
              <input {...register('razorpayMerchantName')} placeholder="HYS Services"
                     className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Support Email</label>
              <input {...register('razorpaySupportEmail')} type="email"
                     placeholder="payments@hysservices.com" className={inputCls} />
            </div>
          </div>

          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20
                          rounded-xl p-4">
            <WarningIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-300 text-xs leading-relaxed">
              For maximum security use Option A (.env.local). The Key Secret is sensitive —
              only superadmin accounts can read it here.
            </p>
          </div>
        </div>

        {/* ── 7. Maintenance Mode ───────────────────────────────────────────── */}
        <div className={`bg-admin-card rounded-2xl p-6 space-y-5 transition-colors border-2
                         ${maintenanceMode
                           ? 'border-amber-500/40 bg-amber-500/5'
                           : 'border-admin-border'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-admin-text flex items-center gap-2">
                <WarningIcon className="w-4 h-4 text-amber-400" />
                Maintenance Mode
              </h2>
              <p className="text-admin-muted text-xs mt-1">
                When ON, all customer and worker routes are blocked. Only admin panel is accessible.
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Controller
                name="maintenanceMode"
                control={control}
                render={({ field }) => (
                  <div
                    role="switch"
                    aria-checked={field.value}
                    onClick={() => field.onChange(!field.value)}
                    className={`relative w-14 h-7 rounded-full cursor-pointer transition-colors
                                ${field.value ? 'bg-amber-500' : 'bg-admin-border'}`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow
                                  transition-transform ${field.value ? 'translate-x-8' : 'translate-x-1'}`}
                    />
                  </div>
                )}
              />
              <span className={`text-xs font-semibold
                                ${maintenanceMode ? 'text-amber-400' : 'text-admin-muted'}`}>
                {maintenanceMode ? 'ON' : 'Off'}
              </span>
            </div>
          </div>

          {maintenanceMode && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4
                            flex items-start gap-3 animate-fade-in">
              <WarningIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-sm leading-relaxed">
                <strong>Warning:</strong> Enabling this immediately redirects all customers and
                workers to the maintenance page within 30 seconds. API calls return 503.
                Save before leaving this page.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Maintenance Message</label>
            <textarea
              {...register('maintenanceMessage')}
              placeholder="We are performing scheduled maintenance. Please check back soon."
              className={`${inputCls} resize-none`}
              rows={2}
            />
          </div>

          <div>
            <label className={labelCls}>
              Estimated Return Time
              <span className="ml-2 text-admin-muted/50 font-normal">(optional)</span>
            </label>
            <input {...register('estimatedReturn')} type="datetime-local" className={inputCls} />
            <p className="mt-1 text-xs text-admin-muted/60">
              If set, a countdown timer will appear on the maintenance page.
            </p>
          </div>
        </div>

        {/* ── 8. Developer Tools ───────────────────────────────────────────── */}
        <DevToolsSection />

        {/* ── Save ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={loadSettings}
            disabled={!isDirty || saving}
            className="px-5 py-2.5 text-admin-muted hover:text-admin-text text-sm
                       font-medium transition-colors disabled:opacity-40"
          >
            Discard changes
          </button>
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm
                       font-semibold rounded-xl transition-colors disabled:opacity-40
                       disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <SpinnerIcon className="w-4 h-4" />
                Saving…
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}