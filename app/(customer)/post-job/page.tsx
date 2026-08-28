"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentLocation } from "@/lib/geolocation";

type Category = { id: string; name: string };

export default function PostJobPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    setSubmitting(true);
    setError(null);

    let coords: { latitude: number; longitude: number } | null = null;
    try {
      coords = await getCurrentLocation();
    } catch {
      // Optional — workers can still see the post without it.
    }

    try {
      const res = await fetch("/api/job-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          title: title.trim(),
          description: description.trim(),
          addressLine: addressLine.trim() || undefined,
          ...(coords ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't post the job. Try again.");
        setSubmitting(false);
        return;
      }
      router.push("/customer-bookings");
    } catch {
      setError("Network error — try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-8">
      <h1 className="text-2xl font-semibold">Post a job</h1>
      <p className="mt-1 text-sm text-muted">
        Get quotes from multiple workers, compare, and pick who you want — instead of
        booking one worker directly.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded-md border border-muted/30 px-3 py-2"
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Title
          <input
            required
            minLength={5}
            maxLength={150}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kitchen sink leak repair"
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            required
            minLength={20}
            maxLength={2000}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What needs doing? Include as much detail as you can — it helps workers quote accurately."
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Address (optional)
          <input
            maxLength={200}
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            className="rounded-md border border-muted/30 px-3 py-2"
          />
          <span className="text-xs text-muted">
            We&apos;ll also try to use your device location, if you allow it, so nearby workers see this first.
          </span>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Posting…" : "Post job"}
        </button>
      </form>
    </main>
  );
}