"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentLocation } from "@/lib/geolocation";

export default function CustomerSignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    addressLine: "",
    city: "",
  });
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleUseLocation() {
    setError(null);
    setLocating(true);
    try {
      setCoords(await getCurrentLocation());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/customer/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(coords && coords) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      router.push("/auth/login?verify=1");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Create a customer account</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Full name
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Phone (optional)
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>

        <div className="flex flex-col gap-2 rounded-md border border-muted/20 p-3">
          <p className="text-sm font-medium">Location (optional)</p>
          <p className="text-xs text-muted">
            Skip this now and add it later from your profile — service search
            (Part 6) uses it either way.
          </p>
          <button
            type="button"
            onClick={handleUseLocation}
            disabled={locating}
            className="self-start rounded-md border border-muted/30 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {locating ? "Detecting…" : "Use my current location"}
          </button>
          {coords && (
            <p className="text-xs text-muted">
              Captured: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
            </p>
          )}
          <input
            value={form.addressLine}
            onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
            placeholder="Address"
            className="rounded-md border border-muted/30 px-3 py-2"
          />
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="City"
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </main>
  );
}
