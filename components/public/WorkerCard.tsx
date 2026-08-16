import Link from "next/link";
import { BadgeCheck, Star, MapPin } from "lucide-react";

export type WorkerCardData = {
  id: string;
  name: string;
  image: string | null;
  category: { name: string };
  startingPrice: string | number;
  experienceYears: number;
  rating: string | number;
  reviewCount: number;
  isAvailable: boolean;
  isVerified: boolean;
  city: string | null;
  distanceKm: number | null;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function WorkerCard({ worker }: { worker: WorkerCardData }) {
  const rating = Number(worker.rating);

  return (
    <Link
      href={`/worker/${worker.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {initials(worker.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{worker.name}</span>
            {worker.isVerified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-verified" aria-label="Verified" />
            )}
          </div>
          <p className="truncate text-sm text-muted">{worker.category.name}</p>
        </div>
        {!worker.isAvailable && (
          <span className="shrink-0 rounded-full bg-muted/15 px-2 py-0.5 text-xs text-muted">
            Unavailable
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {worker.reviewCount > 0 ? (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-rating text-rating" />
            {rating.toFixed(1)} ({worker.reviewCount})
          </span>
        ) : (
          <span>No reviews yet</span>
        )}
        <span>
          {worker.experienceYears} {worker.experienceYears === 1 ? "year" : "years"} experience
        </span>
        {worker.distanceKm !== null && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {worker.distanceKm < 1 ? "< 1 km" : `${worker.distanceKm.toFixed(1)} km`}
          </span>
        )}
        {worker.distanceKm === null && worker.city && <span>{worker.city}</span>}
      </div>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
        <span className="text-xs text-muted">Starting Price</span>
        <span className="text-lg font-semibold text-accent">
          ₹{Number(worker.startingPrice).toLocaleString("en-IN")}
        </span>
        <span className="text-xs text-muted">Price may increase based on the work.</span>
      </div>
    </Link>
  );
}
