import { haversineDistanceKm } from "@/lib/distance";
import { applyDistanceSurcharge, distanceSurchargePercent } from "@/lib/distance-pricing";
import type { Settings } from "@/lib/generated/prisma/client";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Reference price shown at booking-creation time — the worker's current
 * startingPrice, plus a travel surcharge if both the worker's and the
 * customer's coordinates are known. This is only ever a *reference*: it's
 * what Booking.basePrice records, not what gets charged. The worker may
 * still propose a different number in chat once they see the actual job
 * details (per the "starting price, not a fixed price" business rule) —
 * that proposal, once both sides confirm it, becomes Booking.finalPrice.
 */
export function computeBookingBasePrice(
  worker: { startingPrice: number; latitude: number | null; longitude: number | null },
  customerLocation: { latitude: number; longitude: number } | null,
): { basePrice: number; distanceKm: number | null; surchargePercent: number } {
  if (!customerLocation || worker.latitude === null || worker.longitude === null) {
    return { basePrice: round2(worker.startingPrice), distanceKm: null, surchargePercent: 0 };
  }
  const distanceKm = haversineDistanceKm(
    { latitude: worker.latitude, longitude: worker.longitude },
    customerLocation,
  );
  return {
    basePrice: applyDistanceSurcharge(worker.startingPrice, distanceKm),
    distanceKm: round2(distanceKm),
    surchargePercent: distanceSurchargePercent(distanceKm),
  };
}

export type PriceBreakdown = {
  agreedPrice: number;
  platformFee: number;
  gstAmount: number;
  totalAmount: number;
};

/**
 * GST applies ONLY to the platform fee, never to the price agreed between
 * customer and worker — confirmed business rule, unchanged from V1.
 * agreedPrice here is whatever price both sides actually confirmed in
 * chat (Conversation.proposedPrice at the PRICE_CONFIRMED step) — it does
 * not have to match the Booking.basePrice reference computed above.
 */
export function computePriceBreakdown(
  agreedPrice: number,
  settings: Pick<Settings, "platformFeeType" | "platformFeePercent" | "platformFeeFixed" | "gstPercent">,
): PriceBreakdown {
  const platformFee =
    settings.platformFeeType === "fixed"
      ? round2(Number(settings.platformFeeFixed))
      : round2((agreedPrice * Number(settings.platformFeePercent)) / 100);
  const gstAmount = round2((platformFee * Number(settings.gstPercent)) / 100);
  const totalAmount = round2(agreedPrice + platformFee + gstAmount);
  return { agreedPrice: round2(agreedPrice), platformFee, gstAmount, totalAmount };
}