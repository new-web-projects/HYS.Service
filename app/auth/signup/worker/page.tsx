"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };

export default function WorkerSignupPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryChoice, setCategoryChoice] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    experienceYears: "0",
    startingPrice: "",
    bio: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => setCategories([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/worker/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          experienceYears: Number(form.experienceYears),
          startingPrice: Number(form.startingPrice),
          categoryId: categoryChoice === "other" ? undefined : categoryChoice || undefined,
          newCategoryName: categoryChoice === "other" ? newCategoryName : undefined,
        }),
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
    <main className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Create a worker account</h1>
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
          Phone
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

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            required
            value={categoryChoice}
            onChange={(e) => setCategoryChoice(e.target.value)}
            className="rounded-md border border-muted/30 px-3 py-2"
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="other">Other — not listed</option>
          </select>
        </label>
        {categoryChoice === "other" && (
          <label className="flex flex-col gap-1 text-sm">
            Describe your category
            <input
              required
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="rounded-md border border-muted/30 px-3 py-2"
            />
            <span className="text-xs text-muted">
              Pending admin approval before it appears publicly.
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Years of experience
          <input
            type="number"
            min={0}
            required
            value={form.experienceYears}
            onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Starting price (₹)
          <input
            type="number"
            min={1}
            step="0.01"
            required
            value={form.startingPrice}
            onChange={(e) => setForm({ ...form, startingPrice: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
          <span className="text-xs text-muted">
            Your starting price — the price may increase based on the work.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Short bio (optional)
          <textarea
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="rounded-md border border-muted/30 px-3 py-2"
            rows={3}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-xs text-muted">
          Document verification can be completed after signup, once storage
          is set up (Part 11).
        </p>
      </form>
    </main>
  );
}
