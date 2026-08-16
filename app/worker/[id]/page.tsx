"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BadgeCheck, Star } from "lucide-react";

type Worker = {
  id: string;
  name: string;
  image: string | null;
  category: { name: string };
  bio: string | null;
  experienceYears: number;
  experienceDesc: string | null;
  startingPrice: string;
  skills: string[];
  isAvailable: boolean;
  isVerified: boolean;
  rating: string;
  reviewCount: number;
  city: string | null;
};

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function WorkerProfilePublicPage() {
  const params = useParams<{ id: string }>();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/workers/${params.id}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => data && setWorker(data.worker));
  }, [params.id]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Worker not found</h1>
        <p className="mt-2 text-sm text-muted">This profile may have been removed.</p>
      </main>
    );
  }

  if (!worker) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const rating = Number(worker.rating);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {initials(worker.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold">{worker.name}</h1>
            {worker.isVerified && <BadgeCheck className="h-5 w-5 text-verified" aria-label="Verified" />}
          </div>
          <p className="text-sm text-muted">{worker.category.name}</p>
          {!worker.isAvailable && (
            <span className="mt-1 inline-block rounded-full bg-muted/15 px-2 py-0.5 text-xs text-muted">
              Currently unavailable
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
        {worker.reviewCount > 0 ? (
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-rating text-rating" />
            {rating.toFixed(1)} ({worker.reviewCount} reviews)
          </span>
        ) : (
          <span>No reviews yet</span>
        )}
        <span>
          {worker.experienceYears} {worker.experienceYears === 1 ? "year" : "years"} experience
        </span>
        {worker.city && <span>{worker.city}</span>}
      </div>

      {worker.bio && <p className="mt-6 text-sm leading-relaxed">{worker.bio}</p>}
      {worker.experienceDesc && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{worker.experienceDesc}</p>
      )}

      {worker.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {worker.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-muted/15 px-3 py-1 text-xs">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between rounded-xl border border-border bg-surface p-5">
        <div>
          <p className="text-xs text-muted">Starting Price</p>
          <p className="text-2xl font-semibold text-accent">
            ₹{Number(worker.startingPrice).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted">Price may increase based on the work.</p>
        </div>
        <button
          type="button"
          disabled
          title="Booking arrives in Part 7"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground opacity-50"
        >
          Book worker
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Workers farther from your location may include a travel surcharge —
        shown before you pay, once booking exists (Part 7).
      </p>
      <p className="mt-1 text-xs text-muted">
        Booking, chat, and payment aren&apos;t built yet — Part 7 wires this
        button up for real instead of leaving it looking finished when it
        isn&apos;t.
      </p>
    </main>
  );
}
