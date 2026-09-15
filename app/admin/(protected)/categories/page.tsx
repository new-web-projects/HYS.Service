"use client";

import { useCallback, useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  isApproved: boolean;
  submittedBy: { name: string } | null;
  _count: { workerProfiles: number };
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/categories");
    if (res.ok) setCategories((await res.json()).categories);
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create that category.");
        return;
      }
      setNewName("");
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleApproval(category: Category) {
    await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isApproved: !category.isApproved }),
    });
    await load();
  }

  const pending = categories.filter((c) => !c.isApproved);
  const approved = categories.filter((c) => c.isApproved);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">Categories</h1>

      <form onSubmit={handleCreate} className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          New category
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Electrician"
            className="rounded-md border border-muted/30 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {creating ? "Adding…" : "Add category"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : (
        <>
          {pending.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-sm font-medium text-muted">Awaiting approval ({pending.length})</h2>
              <ul className="flex flex-col gap-2">
                {pending.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.submittedBy && <p className="text-xs text-muted">Submitted by {c.submittedBy.name}</p>}
                    </div>
                    <button
                      onClick={() => toggleApproval(c)}
                      className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Approve
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-muted">Approved ({approved.length})</h2>
            <ul className="flex flex-col gap-2">
              {approved.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted">{c._count.workerProfiles} workers</p>
                  </div>
                  <button onClick={() => toggleApproval(c)} className="text-xs text-muted underline">
                    Unapprove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}