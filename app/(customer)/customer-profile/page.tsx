"use client";

import { useEffect, useState } from "react";
import { getCurrentLocation } from "@/lib/geolocation";

type Profile = {
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  addressLine: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

const GENDER_OPTIONS = [
  { value: "", label: "Prefer not to say for now" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "NON_BINARY", label: "Non-binary" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

export default function CustomerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ phone: "", gender: "", addressLine: "", city: "" });
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/customer/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.profile);
        setForm({
          phone: data.profile.phone ?? "",
          gender: data.profile.gender ?? "",
          addressLine: data.profile.addressLine ?? "",
          city: data.profile.city ?? "",
        });
        if (data.profile.latitude && data.profile.longitude) {
          setCoords({ latitude: data.profile.latitude, longitude: data.profile.longitude });
        }
      });
  }, []);

  async function handleUseLocation() {
    setStatus(null);
    setLocating(true);
    try {
      const location = await getCurrentLocation();
      setCoords(location);
      setStatus("Location captured — add your address below since it can't be read from coordinates alone.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(form.phone && { phone: form.phone }),
          ...(form.gender && { gender: form.gender }),
          ...(form.addressLine && { addressLine: form.addressLine }),
          ...(form.city && { city: form.city }),
          ...(coords && coords),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus(data.error ?? "Couldn't save. Try again.");
        return;
      }
      setStatus("Saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold">Your profile</h1>
      <dl className="mt-4 text-sm text-muted">
        <dt className="inline font-medium text-foreground">Name: </dt>
        <dd className="inline">{profile.name}</dd>
        <br />
        <dt className="inline font-medium text-foreground">Email: </dt>
        <dd className="inline">{profile.email}</dd>
      </dl>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Phone
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gender
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-2 rounded-md border border-muted/20 p-3">
          <p className="text-sm font-medium">Location</p>
          <p className="text-xs text-muted">
            Save this once and the service search (Part 6) will use it automatically instead of asking every time.
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
          <label className="flex flex-col gap-1 text-sm">
            Address
            <input
              value={form.addressLine}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              placeholder="House / street / area"
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            City
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
        </div>

        {status && <p className="text-sm text-muted">{status}</p>}
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
