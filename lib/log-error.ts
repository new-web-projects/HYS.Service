/** File Path: lib/log-error.ts */

import { prisma } from "@/lib/prisma";

export type ErrorLogInput = {
  message: string;
  stack?: string;
  file?: string;
  function?: string;
  component?: string;
  route?: string;
  browser?: string;
  device?: string;
  userRole?: string;
  userId?: string;
};

/**
 * Part 12. Deliberately never throws — a logging call failing must never
 * take down the request/render that triggered it, same reasoning as
 * lib/audit-log.ts. ErrorLog has no real FK to userId by design (see the
 * model's own schema comment): a bad/missing user id must never block an
 * error from being recorded.
 */
export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    await prisma.errorLog.create({ data: input });
  } catch (err) {
    console.error("Failed to write error log", err, "original error:", input.message);
  }
}