"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { WorkerCard, type WorkerCardData } from "@/components/public/WorkerCard";
import { ServiceFilters, EMPTY_FILTERS, type Filters } from "@/components/public/ServiceFilters";
import { getCurrentLocation } from "@/lib/geolocation";

type Category = { id: string; name: string };

export default function ServicesPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [workers, setWorkers] = useState<WorkerCardData[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  // Try the signed-in customer's saved location first — "shouldn't need to
  // enter location repeatedly" per the spec — falling back to an explicit
  // prompt only if there isn't one on file or the request isn't signed in.
  useEffect(() => {
    fetch("/api/customer/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile?.latitude && data?.profile?.longitude) {
          setCoords({ latitude: data.profile.latitude, longitude: data.profile.longitude });
          setLocationNote("Using the location saved on your profile.");
        }
      })
      .catch(() => {});
  }, []);

  // Fetch logic is defined directly inside the effect (not as an external
  // useCallback invoked from it) — next lint's set-state-in-effect rule
  // flagged that shape even with an AbortController, since its static
  // analysis can't see through a function reference to know setState only
  // fires after the async boundary. Also fixes a real race: an in-flight
  // search is aborted if filters/coords change again before it resolves,
  // so a slower older request can't overwrite a newer one's results.
  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.maxDistanceKm) params.set("maxDistanceKm", filters.maxDistanceKm);
      if (filters.minRating) params.set("minRating", filters.minRating);
      if (filters.maxStartingPrice) params.set("maxStartingPrice", filters.maxStartingPrice);
      if (filters.minExperienceYears) params.set("minExperienceYears", filters.minExperienceYears);
      if (filters.verifiedOnly) params.set("verifiedOnly", "true");
      if (filters.availableOnly) params.set("availableOnly", "true");
      if (coords) {
        params.set("latitude", String(coords.latitude));
        params.set("longitude", String(coords.longitude));
      }

      try {
        const res = await fetch(`/api/workers/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setWorkers(data.workers ?? []);
        setLoading(false);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          setLoading(false);
        }
        // an aborted request just leaves loading true until the request
        // that superseded it finishes and sets it false itself
      }
    }

    run();
    return () => controller.abort();
  }, [filters, coords]);

  async function handleUseLocation() {
    setLocating(true);
    setLocationNote(null);
    try {
      const location = await getCurrentLocation();
      setCoords(location);
    } catch (err) {
      setLocationNote(err instanceof Error ? err.message : "Couldn't get your location.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Find a service professional</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          {coords ? (
            <span>{locationNote ?? "Showing workers near your current location."}</span>
          ) : (
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={locating}
              className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
            >
              {locating ? "Detecting…" : "Use my location to sort by distance"}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFiltersOpen(true)}
        className="mt-4 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
      </button>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <ServiceFilters filters={filters} onChange={setFilters} categories={categories} hasLocation={Boolean(coords)} />
        </aside>

        {filtersOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-foreground/40" onClick={() => setFiltersOpen(false)} />
            <div className="relative ml-auto flex h-full w-80 max-w-[85vw] flex-col gap-4 overflow-y-auto bg-surface p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Filters</h2>
                <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ServiceFilters filters={filters} onChange={setFilters} categories={categories} hasLocation={Boolean(coords)} />
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Show results
              </button>
            </div>
          </div>
        )}

        <section>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : workers.length === 0 ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <p className="font-medium">No workers match those filters</p>
              <p className="mt-1 text-sm text-muted">Try widening your distance or clearing a filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {workers.map((worker) => (
                <WorkerCard key={worker.id} worker={worker} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
