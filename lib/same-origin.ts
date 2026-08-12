/**
 * Same pattern V1 used on every mutating API route (lib/auth/middleware.js
 * there): reject a POST whose Origin doesn't match the app's own Host.
 * Complements, not replaces, Better Auth's own origin checking on its
 * catch-all route — that only covers requests handled directly by
 * `/api/auth/[...all]`, not these custom routes that call `auth.api.*` as
 * plain server-side functions instead of going through that HTTP handler.
 *
 * Browsers always send Origin on cross-site POSTs, so a same-site request
 * with no Origin at all is treated as a same-site fetch/XHR (Origin can be
 * legitimately absent there depending on the browser) rather than
 * rejected — matching V1's exact behavior.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function rejectCrossOrigin(request: Request): Response | null {
  if (isSameOrigin(request)) return null;
  return new Response(JSON.stringify({ error: "Cross-origin request rejected." }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
