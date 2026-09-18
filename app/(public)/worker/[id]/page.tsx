"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { BadgeCheck, Star } from "lucide-react";

type WorkerProfile = {
  id: string;
  name: string;
  image: string | null;
  category: { name: string };
  bio: string | null;
  startingPrice: string;
  experienceYears: number;
  experienceDesc: string | null;
  rating: string;
  reviewCount: number;
  isAvailable: boolean;
  isVerified: boolean;
  city: string | null;
  skills: string[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function PublicWorkerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/workers/${id}`)
      .then((res) => {
        if (!res.ok) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => data && setWorker(data.worker));
  }, [id]);

  if (notFound) return <main className="mx-auto max-w-2xl px-6 py-10 text-sm text-muted">Worker not found.</main>;
  if (!worker) return <main className="mx-auto max-w-2xl px-6 py-10 text-sm text-muted">Loading…</main>;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {worker.image ? (
            <Image src={worker.image} alt="" width={64} height={64} className="h-full w-full object-cover" />
          ) : (
            initials(worker.name)
          )}
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

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {worker.reviewCount > 0 ? (
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-rating text-rating" />
            {Number(worker.rating).toFixed(1)} ({worker.reviewCount} reviews)
          </span>
        ) : (
          <span>No reviews yet</span>
        )}
        <span>{worker.experienceYears} years experience</span>
        {worker.city && <span>{worker.city}</span>}
      </div>

      {worker.bio && <p className="mt-4 text-sm">{worker.bio}</p>}
      {worker.experienceDesc && <p className="mt-2 text-sm text-muted">{worker.experienceDesc}</p>}

      {worker.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {worker.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-muted/15 px-3 py-1 text-xs">
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-border p-4">
        <p className="text-xs text-muted">Starting Price</p>
        <p className="text-2xl font-semibold text-accent">₹{Number(worker.startingPrice).toLocaleString("en-IN")}</p>
        <p className="text-xs text-muted">Price may increase based on the work.</p>
        <p className="mt-1 text-xs text-muted">A travel surcharge may apply for workers further from your location.</p>
        <button
          disabled={!worker.isAvailable}
          onClick={() => router.push(`/customer-dashboard?book=${worker.id}`)}
          className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Book Worker
        </button>
      </div>
    </main>
  );
}