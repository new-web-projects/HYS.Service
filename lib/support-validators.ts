/** File Path: lib/support-validators.ts */

import { z } from "zod";

export const ISSUE_TYPES = [
  "Booking issue",
  "Payment issue",
  "Account issue",
  "Worker verification",
  "Technical problem",
  "Other",
] as const;

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(150),
  issueType: z.enum(ISSUE_TYPES),
  message: z.string().min(10).max(4000),
  attachmentUrl: z.string().url().optional(),
});

export const sendTicketMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  attachmentUrl: z.string().url().optional(),
  isInternalNote: z.boolean().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
  assignedToId: z.string().nullable().optional(),
});