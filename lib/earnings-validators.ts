import { z } from "zod";

export const withdrawalRequestSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["UPI", "BANK"]),
  upiId: z.string().min(3).max(100).optional(),
  bankAccountName: z.string().min(2).max(150).optional(),
  bankAccountNumber: z.string().min(4).max(30).optional(),
  bankIfsc: z.string().min(4).max(15).optional(),
});