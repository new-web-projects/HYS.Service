"use client";

import { useEffect, useState } from "react";
import { getCurrentLocation } from "@/lib/geolocation";

type Category = { id: string; name: string };
type Profile = {
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  category: { id: string; name: string; isApproved: boolean };
  bio: string | null;
  experienceYears: number;
  experienceDesc: string | null;
  startingPrice: string;
  skills: string[];
  isAvailable: boolean;
  isVerified: boolean;
  documentType: string | null;
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
const DOCUMENT_OPTIONS = [
  { value: "", label: "Not selected" },
  { value: "AADHAAR", label: "Aadhaar" },
  { value: "PAN", label: "PAN" },
  { value: "WORK_ID", label: "Work ID" },
];

export default function WorkerProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryChoice, setCategoryChoice] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [form, setForm] = useState({
    phone: "",
    gender: "",
    bio: "",
    experienceYears: "0",
    experienceDesc: "",
    startingPrice: "",
    skills: [] as string[],
    addressLine: "",
    city: "",
    documentType: "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/worker/profile")
      .then((res) => res.json())
      .then((data) => {
        const p: Profile = data.profile;
        setProfile(p);
        setCategoryChoice(p.category.id);
        setForm({
          phone: p.phone ?? "",
          gender: p.gender ?? "",
          bio: p.bio ?? "",
          experienceYears: String(p.experienceYears),
          experienceDesc: p.experienceDesc ?? "",
          startingPrice: p.startingPrice,
          skills: p.skills,
          addressLine: p.addressLine ?? "",
          city: p.city ?? "",
          documentType: p.documentType ?? "",
        });
        if (p.latitude && p.longitude) setCoords({ latitude: p.latitude, longitude: p.longitude });
      });
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  function addSkill() {
    const skill = skillInput.trim();
    if (skill && !form.skills.includes(skill)) {
      setForm({ ...form, skills: [...form.skills, skill] });
    }
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setForm({ ...form, skills: form.skills.filter((s) => s !== skill) });
  }

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

  async function toggleAvailability() {
    if (!profile) return;
    const next = !profile.isAvailable;
    setProfile({ ...profile, isAvailable: next });
    await fetch("/api/worker/availability", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: next }),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/worker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(form.phone && { phone: form.phone }),
          ...(form.gender && { gender: form.gender }),
          ...(form.bio && { bio: form.bio }),
          experienceYears: Number(form.experienceYears),
          ...(form.experienceDesc && { experienceDesc: form.experienceDesc }),
          ...(form.startingPrice && { startingPrice: Number(form.startingPrice) }),
          skills: form.skills,
          ...(form.addressLine && { addressLine: form.addressLine }),
          ...(form.city && { city: form.city }),
          ...(form.documentType && { documentType: form.documentType }),
          ...(coords && coords),
          ...(categoryChoice === "other"
            ? { newCategoryName }
            : categoryChoice !== profile?.category.id
              ? { categoryId: categoryChoice }
              : {}),
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

      <div className="mt-4 flex items-center justify-between rounded-md border border-muted/20 p-3">
        <div>
          <p className="text-sm font-medium">Available for new jobs</p>
          <p className="text-xs text-muted">Turn off if you&apos;re not taking bookings right now.</p>
        </div>
        <button
          type="button"
          onClick={toggleAvailability}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            profile.isAvailable ? "bg-primary text-primary-foreground" : "bg-muted/20"
          }`}
        >
          {profile.isAvailable ? "Available" : "Unavailable"}
        </button>
      </div>

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

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={categoryChoice}
            onChange={(e) => setCategoryChoice(e.target.value)}
            className="rounded-md border border-muted/30 px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {!categories.some((c) => c.id === profile.category.id) && (
              <option value={profile.category.id}>
                {profile.category.name}
                {!profile.category.isApproved ? " (pending approval)" : ""}
              </option>
            )}
            <option value="other">Other — not listed</option>
          </select>
        </label>
        {categoryChoice === "other" && (
          <label className="flex flex-col gap-1 text-sm">
            Describe your category
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="rounded-md border border-muted/30 px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Starting price (₹)
          <input
            type="number"
            min={1}
            step="0.01"
            value={form.startingPrice}
            onChange={(e) => setForm({ ...form, startingPrice: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Years of experience
          <input
            type="number"
            min={0}
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Experience description
          <textarea
            value={form.experienceDesc}
            onChange={(e) => setForm({ ...form, experienceDesc: e.target.value })}
            rows={2}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bio
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>

        <div className="flex flex-col gap-2 text-sm">
          Skills
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="e.g. leak repair"
              className="flex-1 rounded-md border border-muted/30 px-3 py-2"
            />
            <button
              type="button"
              onClick={addSkill}
              className="rounded-md border border-muted/30 px-3 py-2 text-sm"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.skills.map((skill) => (
              <span
                key={skill}
                className="flex items-center gap-1 rounded-full bg-muted/15 px-3 py-1 text-xs"
              >
                {skill}
                <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-md border border-muted/20 p-3">
          <p className="text-sm font-medium">Location</p>
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

        <label className="flex flex-col gap-1 text-sm">
          Verification document type
          <select
            value={form.documentType}
            onChange={(e) => setForm({ ...form, documentType: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          >
            {DOCUMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">
            Uploading the document itself needs storage, which is Part 11 — this just
            records which one you&apos;ll provide.
          </span>
        </label>

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
