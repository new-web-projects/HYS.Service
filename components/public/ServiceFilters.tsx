"use client";

export type Filters = {
  q: string;
  categoryId: string;
  maxDistanceKm: string;
  minRating: string;
  maxStartingPrice: string;
  minExperienceYears: string;
  verifiedOnly: boolean;
  availableOnly: boolean;
};

export const EMPTY_FILTERS: Filters = {
  q: "",
  categoryId: "",
  maxDistanceKm: "",
  minRating: "",
  maxStartingPrice: "",
  minExperienceYears: "",
  verifiedOnly: false,
  availableOnly: false,
};

type Category = { id: string; name: string };

export function ServiceFilters({
  filters,
  onChange,
  categories,
  hasLocation,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  categories: Category[];
  hasLocation: boolean;
}) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder="Search by name or skill"
        className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
      />

      <label className="flex flex-col gap-1 text-sm">
        Category
        <select
          value={filters.categoryId}
          onChange={(e) => set("categoryId", e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Max distance {!hasLocation && <span className="text-xs text-muted">(set your location on your profile)</span>}
        <select
          value={filters.maxDistanceKm}
          onChange={(e) => set("maxDistanceKm", e.target.value)}
          disabled={!hasLocation}
          className="rounded-md border border-border bg-surface px-3 py-2 disabled:opacity-50"
        >
          <option value="">Any distance</option>
          <option value="5">Within 5 km</option>
          <option value="15">Within 15 km</option>
          <option value="30">Within 30 km</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Minimum rating
        <select
          value={filters.minRating}
          onChange={(e) => set("minRating", e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2"
        >
          <option value="">Any rating</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="4.5">4.5+ stars</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Max starting price (₹)
        <input
          type="number"
          min={0}
          value={filters.maxStartingPrice}
          onChange={(e) => set("maxStartingPrice", e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Minimum experience (years)
        <input
          type="number"
          min={0}
          value={filters.minExperienceYears}
          onChange={(e) => set("minExperienceYears", e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.verifiedOnly}
          onChange={(e) => set("verifiedOnly", e.target.checked)}
        />
        Verified workers only
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filters.availableOnly}
          onChange={(e) => set("availableOnly", e.target.checked)}
        />
        Available now only
      </label>

      {filters !== EMPTY_FILTERS && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="self-start text-sm text-muted underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
