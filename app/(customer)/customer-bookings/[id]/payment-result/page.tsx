"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Status = "PENDING_RESPONSE" | "DISCUSSING" | "PRICE_PENDING" | "READY_FOR_PAYMENT" | "PAID" | "COMPLETED" | "CANCELLED";

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 20; // ~1 minute of active polling before giving up and asking the customer to check back

export default function PaymentResultPage() {
  const params = useParams<{ id: string }>();
  const [status, setStatus] = useState<Status | null>(null);
  const [otp, setOtp] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pollingRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled || !pollingRef.current) return;
      try {
        const res = await fetch(`/api/bookings/${params.id}/payment/status`);
        const data = await res.json();
        if (cancelled) return;
        setStatus(data.status);
        if (data.otp) setOtp(data.otp);
        if (data.status === "PAID" || data.status === "COMPLETED" || data.status === "CANCELLED") {
          pollingRef.current = false;
          return;
        }
      } catch {
        // transient — just try again on the next tick
      }
      setPollCount((c) => c + 1);
    }

    poll();
    const interval = setInterval(() => {
      if (pollingRef.current) poll();
      else clearInterval(interval);
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      pollingRef.current = false;
      clearInterval(interval);
    };
  }, [params.id]);

  const stillWaiting = status === "READY_FOR_PAYMENT" && pollCount < MAX_POLLS;
  const timedOut = status === "READY_FOR_PAYMENT" && pollCount >= MAX_POLLS;

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-16 text-center">
      {status === null && <p className="text-sm text-muted">Checking payment status…</p>}

      {stillWaiting && (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted/30 border-t-primary" />
          <p className="text-sm text-muted">Confirming your payment — this usually takes a few seconds.</p>
        </>
      )}

      {timedOut && (
        <>
          <p className="text-sm">
            Still confirming. If money was deducted, this will resolve automatically — no need to pay again.
          </p>
          <Link href="/customer-bookings" className="text-sm underline">
            Check my bookings
          </Link>
        </>
      )}

      {(status === "PAID" || status === "COMPLETED") && (
        <>
          <h1 className="text-2xl font-semibold text-accent">Payment successful</h1>
          {otp && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
              <p className="text-xs text-muted">Job-completion OTP</p>
              <p className="mt-1 text-3xl font-semibold tracking-widest">{otp}</p>
              <p className="mt-2 text-xs text-muted">
                Share this with the worker only once the job is fully done — it releases their payment.
              </p>
            </div>
          )}
          <p className="text-sm text-muted">You can also find this OTP later from your booking details.</p>
          <Link
            href="/customer-bookings"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            View my bookings
          </Link>
        </>
      )}

      {status === "CANCELLED" && (
        <>
          <p className="text-sm text-red-600">This booking was cancelled before payment completed.</p>
          <Link href="/customer-bookings" className="text-sm underline">
            View my bookings
          </Link>
        </>
      )}
    </main>
  );
}