import { z } from "zod";

export const createBookingSchema = z.object({
  workerId: z.string().min(1),
  description: z.string().min(10).max(2000),
  address: z.string().min(5).max(300),
  scheduledAt: z.iso.datetime().optional(),
  notes: z.string().max(1000).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const respondToBookingSchema = z.object({
  action: z.enum(["accept", "reject"]),
  reason: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

// Mirrors MessageType in schema.prisma. TEXT is a plain chat message;
// the other three drive the price-negotiation state machine and are sent
// through this same endpoint rather than separate ones, matching how the
// schema already models them (Message.type + Message.priceAmount) instead
// of treating price events as something outside the message stream.
export const sendMessageSchema = z.object({
  type: z.enum(["TEXT", "PRICE_PROPOSAL", "PRICE_ACCEPTED", "PRICE_CONFIRMED"]).default("TEXT"),
  content: z.string().min(1).max(2000),
  priceAmount: z.number().positive().max(10_000_000).optional(),
});

export const createJobPostSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(5).max(150),
  description: z.string().min(20).max(2000),
  addressLine: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const expressInterestSchema = z.object({
  message: z.string().min(10).max(1000),
  price: z.number().positive().max(10_000_000),
});

export const selectWorkerSchema = z.object({
  conversationId: z.string().min(1),
  scheduledAt: z.iso.datetime().optional(),
});