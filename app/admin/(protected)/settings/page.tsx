/** File Path: app/admin/(protected)/settings/page.tsx */

"use client";

import { useEffect, useState } from "react";

type Settings = {
  siteName: string;
  siteLogoUrl: string | null;
  platformFeeType: "percent" | "fixed";
  platformFeePercent: string;
  platformFeeFixed: string;
  gstPercent: string;
  withdrawalFeePercent: string;
  razorpayEnabled: boolean;
  phonepeEnabled: boolean;
  paytmEnabled: boolean;
  paymentMode: "TEST" | "LIVE";
  storageProvider: "CLOUDINARY" | "S3";
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  errorRevealEnabled: boolean;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => setSettings(data.settings));
  }, []);

  async function save(patch: Partial<Record<keyof Settings, unknown>>) {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that.");
        return;
      }
      setSettings(data.settings);
      setMessage("Saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Platform settings</h1>
      {forbidden && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Only a Super Admin can change these — you can still view them.
        </p>
      )}
      {message && <p className="mt-3 text-sm text-accent">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="font-medium">Site branding</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <label className="flex flex-col gap-1">
            Site name
            <input
              defaultValue={settings.siteName}
              onBlur={(e) => save({ siteName: e.target.value })}
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            Logo URL
            <input
              defaultValue={settings.siteLogoUrl ?? ""}
              onBlur={(e) => save({ siteLogoUrl: e.target.value || null })}
              placeholder="https://…"
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="font-medium">Fees &amp; GST</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <label className="flex flex-col gap-1">
            Platform fee type
            <select
              defaultValue={settings.platformFeeType}
              onChange={(e) => save({ platformFeeType: e.target.value })}
              className="rounded-md border border-muted/30 px-3 py-2"
            >
              <option value="percent">Percent</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Platform fee value
            <input
              key={settings.platformFeeType}
              type="number"
              step="0.01"
              defaultValue={settings.platformFeeType === "percent" ? settings.platformFeePercent : settings.platformFeeFixed}
              onBlur={(e) =>
                save(
                  settings.platformFeeType === "percent"
                    ? { platformFeePercent: Number(e.target.value) }
                    : { platformFeeFixed: Number(e.target.value) },
                )
              }
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            GST % (on platform fee only)
            <input
              type="number"
              step="0.01"
              defaultValue={settings.gstPercent}
              onBlur={(e) => save({ gstPercent: Number(e.target.value) })}
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            Withdrawal processing fee % (GST-inclusive)
            <input
              type="number"
              step="0.01"
              defaultValue={settings.withdrawalFeePercent}
              onBlur={(e) => save({ withdrawalFeePercent: Number(e.target.value) })}
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="font-medium">Payment gateways</h2>
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {(
            [
              ["razorpayEnabled", "Razorpay"],
              ["phonepeEnabled", "PhonePe"],
              ["paytmEnabled", "Paytm"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between">
              {label}
              <input
                type="checkbox"
                defaultChecked={settings[key]}
                onChange={(e) => save({ [key]: e.target.checked })}
                className="h-4 w-4"
              />
            </label>
          ))}
          <label className="flex flex-col gap-1">
            Mode
            <select
              defaultValue={settings.paymentMode}
              onChange={(e) => save({ paymentMode: e.target.value })}
              className="rounded-md border border-muted/30 px-3 py-2"
            >
              <option value="TEST">Test / sandbox</option>
              <option value="LIVE">Live / production</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="font-medium">Storage</h2>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          Active provider for new uploads
          <select
            defaultValue={settings.storageProvider}
            onChange={(e) => save({ storageProvider: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          >
            <option value="CLOUDINARY">Cloudinary</option>
            <option value="S3">Amazon S3</option>
          </select>
        </label>
        <p className="mt-2 text-xs text-muted">
          Upload implementation itself is Part 11 — this selector is ready for it.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="font-medium">Maintenance mode</h2>
        <label className="mt-3 flex items-center justify-between text-sm">
          Site in maintenance mode
          <input
            type="checkbox"
            defaultChecked={settings.maintenanceMode}
            onChange={(e) => save({ maintenanceMode: e.target.checked })}
            className="h-4 w-4"
          />
        </label>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          Message shown to visitors
          <textarea
            defaultValue={settings.maintenanceMessage ?? ""}
            onBlur={(e) => save({ maintenanceMessage: e.target.value || null })}
            rows={2}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Admins can always sign in and reach this page, even while maintenance mode is on.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border p-5">
        <h2 className="font-medium">Error reveal system</h2>
        <label className="mt-3 flex items-center justify-between text-sm">
          Show detailed error information
          <input
            type="checkbox"
            defaultChecked={settings.errorRevealEnabled}
            onChange={(e) => save({ errorRevealEnabled: e.target.checked })}
            className="h-4 w-4"
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Off by default — stack traces and internal error detail should only ever be visible with this
          deliberately switched on (Part 12 builds the capture and display itself).
        </p>
      </section>

      {saving && <p className="mt-3 text-xs text-muted">Saving…</p>}
    </div>
  );
}