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
 * Best-effort extraction of the top stack frame's function name and file
 * reference — added during the Part 12 re-audit, which found "File" and
 * "Function" (both explicit master-prompt capture fields) were never
 * actually populated even though the schema had columns for them since
 * Part 3. Handles the two common V8 stack-frame shapes:
 *   "at functionName (file:line:col)"  → named frame
 *   "at file:line:col"                 → anonymous/arrow frame
 * Never throws — a stack trace in an unexpected shape (a non-V8 engine,
 * a hand-built Error) just yields undefined fields rather than failing
 * the whole log write.
 */
function extractTopFrame(stack?: string): { file?: string; function?: string } {
  if (!stack) return {};
  const firstFrame = stack.split("\n").find((line) => line.trim().startsWith("at "));
  if (!firstFrame) return {};

  const named = firstFrame.match(/at\s+(.+?)\s+\((.+?):\d+:\d+\)/);
  if (named) return { function: named[1], file: named[2] };

  const anonymous = firstFrame.match(/at\s+(.+?):\d+:\d+/);
  if (anonymous) return { file: anonymous[1] };

  return {};
}

/**
 * Part 12. Deliberately never throws — a logging call failing must never
 * take down the request/render that triggered it, same reasoning as
 * lib/audit-log.ts. ErrorLog has no real FK to userId by design (see the
 * model's own schema comment): a bad/missing user id must never block an
 * error from being recorded.
 */
export async function logError(input: ErrorLogInput): Promise<void> {
  const derived = extractTopFrame(input.stack);
  try {
    await prisma.errorLog.create({
      data: {
        ...input,
        file: input.file ?? derived.file,
        function: input.function ?? derived.function,
      },
    });
  } catch (err) {
    console.error("Failed to write error log", err, "original error:", input.message);
  }
}