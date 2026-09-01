import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import type { Booking } from "@/lib/generated/prisma/client";

export type PaymentReadyBooking = Booking & { finalPrice: NonNullable<Booking["finalPrice"]> };

/**
 * Shared by every gateway's order-creation route: confirms the booking
 * exists, belongs to this customer, has a confirmed price, and that the
 * specific gateway being requested is actually enabled — returns a typed
 * error tuple instead of throwing, so each route can return its own
 * NextResponse without a shared try/catch swallowing gateway-specific
 * errors thrown later in that route's own gateway-module call.
 */
export async function validatePaymentRequest(
  bookingId: string,
  customerId: string,
  gateway: "razorpay" | "phonepe" | "paytm",
): Promise<{ booking: PaymentReadyBooking; error: null } | { booking: null; error: { message: string; status: number } }> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.customerId !== customerId) {
    return { booking: null, error: { message: "Not found", status: 404 } };
  }
  if (booking.status !== "READY_FOR_PAYMENT") {
    return { booking: null, error: { message: "This booking isn't ready for payment.", status: 409 } };
  }
  if (!booking.finalPrice) {
    return { booking: null, error: { message: "No confirmed price on this booking.", status: 409 } };
  }

  const settings = await getSettings();
  const enabledMap = { razorpay: settings.razorpayEnabled, phonepe: settings.phonepeEnabled, paytm: settings.paytmEnabled };
  if (!enabledMap[gateway]) {
    return { booking: null, error: { message: `${gateway} isn't currently enabled.`, status: 409 } };
  }

  return { booking: booking as PaymentReadyBooking, error: null };
}

export function totalAmountFor(booking: PaymentReadyBooking): number {
  return Number(booking.finalPrice) + Number(booking.platformFee ?? 0) + Number(booking.gstAmount ?? 0);
}