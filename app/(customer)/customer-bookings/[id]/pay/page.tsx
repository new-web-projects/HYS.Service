"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Gateway = "RAZORPAY" | "PHONEPE" | "PAYTM";

type PaymentInfo = {
  gateways: Gateway[];
  breakdown: { finalPrice: string; platformFee: string | null; gstAmount: string | null; totalAmount: number };
};

const GATEWAY_LABEL: Record<Gateway, string> = {
  RAZORPAY: "Razorpay",
  PHONEPE: "PhonePe",
  PAYTM: "Paytm",
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payingWith, setPayingWith] = useState<Gateway | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bookings/${params.id}/payment`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error ?? "Couldn't load payment details.");
          return;
        }
        setInfo(data);
      })
      .catch(() => setLoadError("Network error loading payment details."));
  }, [params.id]);

  async function payWithRazorpay() {
    setPayingWith("RAZORPAY");
    setActionError(null);
    try {
      const [createRes] = await Promise.all([
        fetch(`/api/bookings/${params.id}/payment/razorpay`, { method: "POST" }),
        loadScript("https://checkout.razorpay.com/v1/checkout.js"),
      ]);
      const order = await createRes.json();
      if (!createRes.ok) {
        setActionError(order.error ?? "Couldn't start Razorpay checkout.");
        setPayingWith(null);
        return;
      }

      const RazorpayCheckout = (window as unknown as { Razorpay: new (opts: object) => { open: () => void } })
        .Razorpay;
      const rzp = new RazorpayCheckout({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amountPaise,
        currency: order.currency,
        name: "HYS Services",
        description: "Booking payment",
        handler: async (rzpResponse: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rzpResponse),
          });
          if (verifyRes.ok) {
            router.push(`/customer-bookings/${params.id}/payment-result`);
          } else {
            setActionError("Payment verification failed. If money was deducted, it will be reconciled shortly.");
            setPayingWith(null);
          }
        },
        modal: { ondismiss: () => setPayingWith(null) },
      });
      rzp.open();
    } catch {
      setActionError("Couldn't load Razorpay checkout. Check your connection and try again.");
      setPayingWith(null);
    }
  }

  async function payWithPhonePe() {
    setPayingWith("PHONEPE");
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${params.id}/payment/phonepe`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Couldn't start PhonePe checkout.");
        setPayingWith(null);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setActionError("Network error starting PhonePe checkout.");
      setPayingWith(null);
    }
  }

  async function payWithPaytm() {
    setPayingWith("PAYTM");
    setActionError(null);
    try {
      const res = await fetch(`/api/bookings/${params.id}/payment/paytm`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Couldn't start Paytm checkout.");
        setPayingWith(null);
        return;
      }
      // Paytm's website flow needs a real form POST, not a fetch/redirect —
      // the payment page itself lives at paymentPageUrl and expects these
      // exact field names in the request body.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.paymentPageUrl;
      for (const [k, v] of Object.entries({ mid: data.mid, orderId: data.orderId, txnToken: data.txnToken })) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = String(v);
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      setActionError("Network error starting Paytm checkout.");
      setPayingWith(null);
    }
  }

  const HANDLERS: Record<Gateway, () => void> = {
    RAZORPAY: payWithRazorpay,
    PHONEPE: payWithPhonePe,
    PAYTM: payWithPaytm,
  };

  if (loadError) {
    return (
      <main className="mx-auto max-w-md px-6 py-12 text-center">
        <p className="text-sm text-red-600">{loadError}</p>
      </main>
    );
  }
  if (!info) {
    return <main className="mx-auto max-w-md px-6 py-12 text-sm text-muted">Loading…</main>;
  }

  return (
    <main className="mx-auto max-w-md px-6 py-8">
      <h1 className="text-2xl font-semibold">Payment</h1>

      <dl className="mt-6 grid grid-cols-2 gap-y-2 rounded-xl border border-border p-4 text-sm">
        <dt className="text-muted">Final price</dt>
        <dd className="text-right">₹{Number(info.breakdown.finalPrice).toLocaleString("en-IN")}</dd>
        <dt className="text-muted">Platform fee</dt>
        <dd className="text-right">₹{Number(info.breakdown.platformFee ?? 0).toLocaleString("en-IN")}</dd>
        <dt className="text-muted">GST (on platform fee)</dt>
        <dd className="text-right">₹{Number(info.breakdown.gstAmount ?? 0).toLocaleString("en-IN")}</dd>
        <dt className="font-medium">Total amount</dt>
        <dd className="text-right font-medium">₹{info.breakdown.totalAmount.toLocaleString("en-IN")}</dd>
      </dl>

      <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Once this payment completes, the booking can no longer be cancelled by either you or the worker.
      </p>

      {actionError && <p className="mt-4 text-sm text-red-600">{actionError}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {info.gateways.length === 0 ? (
          <p className="text-sm text-muted">
            No payment methods are currently available. Please try again later or contact support.
          </p>
        ) : (
          info.gateways.map((g) => (
            <button
              key={g}
              onClick={HANDLERS[g]}
              disabled={payingWith !== null}
              className="rounded-md border border-border px-4 py-3 text-sm font-medium disabled:opacity-50"
            >
              {payingWith === g ? "Redirecting…" : `Pay with ${GATEWAY_LABEL[g]}`}
            </button>
          ))
        )}
      </div>
    </main>
  );
}