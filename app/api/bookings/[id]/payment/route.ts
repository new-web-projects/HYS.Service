import { NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUserApi();
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.customerId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (booking.status !== "READY_FOR_PAYMENT") {
    return NextResponse.json(
      { error: "This booking isn't ready for payment.", status: booking.status },
      { status: 409 },
    );
  }
  if (!booking.finalPrice) {
    return NextResponse.json({ error: "No confirmed price on this booking." }, { status: 409 });
  }

  const settings = await getSettings();
  const gateways = [
    settings.razorpayEnabled ? "RAZORPAY" : null,
    settings.phonepeEnabled ? "PHONEPE" : null,
    settings.paytmEnabled ? "PAYTM" : null,
  ].filter((g): g is "RAZORPAY" | "PHONEPE" | "PAYTM" => g !== null);

  const totalAmount = Number(booking.finalPrice) + Number(booking.platformFee ?? 0) + Number(booking.gstAmount ?? 0);

  return NextResponse.json({
    gateways,
    breakdown: {
      finalPrice: booking.finalPrice,
      platformFee: booking.platformFee,
      gstAmount: booking.gstAmount,
      totalAmount,
    },
  });
}