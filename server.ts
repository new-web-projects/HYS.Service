/**
 * Custom server (Part 7): Next.js's own request handling, plus Socket.IO
 * attached to the same HTTP server for real-time chat. `npm run dev` /
 * `npm start` both run this instead of `next dev` / `next start` now —
 * see package.json. `npm run dev:next-only` is kept for anyone who needs
 * to isolate a Next-only issue from a Socket.IO one.
 *
 * Verified directly against the installed Next.js 16.3.0 package's own
 * bundled custom-server guide (node_modules/next/dist/docs/01-app/
 * 02-guides/custom-server.md) rather than assumed — this project's
 * AGENTS.md explicitly warns Next 16 breaks patterns from older training
 * data, and the guide confirmed the next({dev}) / getRequestHandler() /
 * app.prepare() shape is unchanged, so this follows it directly.
 *
 * VERCEL NOTE: Vercel's serverless functions cannot hold a persistent
 * WebSocket connection — there's no long-running Node process for
 * Socket.IO to attach to the way there is here. This server.ts is the
 * right entrypoint for VPS and GitHub Codespaces (both run a real,
 * persistent Node process) but is NOT what runs on Vercel; a Vercel
 * deployment of this app builds and serves Next.js normally (Vercel's
 * own build detects `next build` regardless of these dev/start scripts)
 * and simply won't have a Socket.IO connection available. The chat page
 * (app/chat/[conversationId]) accounts for this: it polls
 * GET /api/conversations/[id]/messages on an interval as a baseline in
 * addition to listening for socket events, so messages still arrive
 * (with polling-interval latency instead of instantly) on a pure-Vercel
 * deployment with no socket connection at all. True real-time on Vercel
 * needs the realtime layer split out as its own small persistent service
 * (e.g. this same server.ts, deployed separately on a VPS/Railway/Fly.io)
 * with NEXT_PUBLIC_SOCKET_URL pointed at it — not implemented here since
 * it's a separate deployment, not application code, but noted rather
 * than silently left for someone to discover the hard way.
 */
import pkg from "@next/env";
const { loadEnvConfig } = pkg;

const dev = process.env.NODE_ENV !== "production";
// Must happen before anything that reads process.env at module scope
// (lib/env.ts validates eagerly on import) gets imported. Static `import`
// statements are hoisted above this file's own code by the ES module
// spec — they'd run, and the env validation they trigger, before
// loadEnvConfig() populated process.env, invisibly. Every import below
// that transitively touches lib/env.ts is therefore a dynamic import()
// inside start(), which — unlike static import — genuinely executes only
// where it's written. Verified against the real @next/env package.
loadEnvConfig(process.cwd(), dev);

async function start() {
  const { createServer } = await import("node:http");
  const { default: next } = await import("next");
  const { initSocketServer } = await import("@/lib/socket-server");

  const port = parseInt(process.env.PORT || "3000", 10);
  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  initSocketServer(httpServer);

  httpServer.listen(port, () => {
    const socketPath = process.env.NEXT_PUBLIC_SOCKET_IO_PATH || "/api/socket";
    console.log(
      `> HYS Services ready on http://localhost:${port} (${dev ? "development" : "production"}) — Socket.IO at ${socketPath}`,
    );
  });

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      httpServer.close(() => process.exit(0));
    });
  }
}

start().catch((err: unknown) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});