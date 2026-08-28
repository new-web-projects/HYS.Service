"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentLocation } from "@/lib/geolocation";

type Props = {
  workerId: string;
  workerName: string;
  startingPrice: number;
  onClose: () => void;
};

export function BookingRequestModal({ workerId, workerName, startingPrice, onClose }: Props) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (description.trim().length < 10) {
      setError("Describe the job in a bit more detail (at least 10 characters).");
      return;
    }
    if (address.trim().length < 5) {
      setError("Enter the address where the work is needed.");
      return;
    }

    setSubmitting(true);
    let coords: { latitude: number; longitude: number } | null = null;
    try {
      coords = await getCurrentLocation();
    } catch {
      // Location is optional here — booking still works without it, just
      // without a distance-based reference price.
    }

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId,
          description: description.trim(),
          address: address.trim(),
          notes: notes.trim() || undefined,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
          ...(coords ?? {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't send the booking request. Try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-xl bg-background p-6 shadow-lg sm:rounded-xl">
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <h2 className="text-lg font-semibold">Request sent</h2>
            <p className="text-sm text-muted">
              {workerName} will be notified. You&apos;ll get a notification the moment they
              respond — once they accept, you can chat to agree on a final price.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => router.push("/customer-bookings")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                View my bookings
              </button>
              <button onClick={onClose} className="rounded-md border border-muted/30 px-4 py-2 text-sm">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Book {workerName}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-muted hover:bg-muted/10"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-muted">
              Starting price ₹{startingPrice} — this may increase once {workerName.split(" ")[0]} sees
              the full job details. You&apos;ll agree on a final price together in chat before any
              payment.
            </p>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <label className="flex flex-col gap-1 text-sm">
              What needs to be done?
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-md border border-muted/30 px-3 py-2"
                placeholder="Describe the job — the more detail, the better the price estimate."
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Address
              <input
                required
                minLength={5}
                maxLength={300}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="rounded-md border border-muted/30 px-3 py-2"
                placeholder="Where does the work need to happen?"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Preferred date/time (optional)
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-md border border-muted/30 px-3 py-2"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Notes (optional)
              <textarea
                maxLength={1000}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-md border border-muted/30 px-3 py-2"
                placeholder="Anything else worth mentioning up front."
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="rounded-md border border-muted/30 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "Sending…" : "Send booking request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}