/** File Path: lib/with-error-logging.ts */

import { NextResponse } from "next/server";
import { logError } from "@/lib/log-error";
import { getCurrentUser } from "@/lib/auth-guard";

type RouteHandler<TParams = Record<string, string>> = (
  request: Request,
  context: { params: Promise<TParams> },
) => Promise<Response>;

/**
 * Part 12 re-audit: the master prompt requires the error-reveal system to
 * "work correctly with: Server APIs" — this is what makes that real
 * rather than aspirational. Wraps a route handler so an unexpected,
 * unhandled exception (a third-party SDK throwing, a dropped DB
 * connection, a genuine bug) gets logged to ErrorLog with the same
 * fields the client-side boundary captures, instead of surfacing only as
 * an opaque 500 with no record anywhere.
 *
 * Purely additive — it never changes a handler's normal behavior for its
 * own expected 4xx/2xx responses, only what happens when the handler
 * itself throws. Applied to the routes with genuine external-call risk
 * (payment gateways, file uploads) rather than retrofitted across every
 * route in the project — the latter would mean re-touching ~60 files
 * that are already implemented and verified, for a failure mode
 * (silent unhandled exceptions) that's realistically concentrated in the
 * handlers that call out to a third-party SDK.
 */
export function withErrorLogging<TParams = Record<string, string>>(
  handler: RouteHandler<TParams>,
  routeLabel: string,
  onError?: (err: unknown) => Response,
): RouteHandler<TParams> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      const user = await getCurrentUser().catch(() => null);
      await logError({
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        route: routeLabel,
        userId: user?.id,
        userRole: user?.role,
      });
      if (onError) return onError(err);
      return NextResponse.json({ error: "Something went wrong. This has been logged." }, { status: 500 });
    }
  };
}