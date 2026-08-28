import type { Server as HTTPServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "@/lib/redis";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Same globalThis-cache reasoning as lib/prisma.ts / lib/redis.ts: this
 * module can be imported both by server.ts (which calls initSocketServer
 * once, at process start) and by API routes (which only ever call getIO()
 * to emit an event) — caching on globalThis means both see the same
 * instance without route handlers needing to pass it around explicitly.
 */
const globalForIO = globalThis as unknown as { io: SocketIOServer | undefined };

/** Used by API routes after a DB write, to push the change to connected clients. */
export function getIO(): SocketIOServer | undefined {
  return globalForIO.io;
}

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (globalForIO.io) return globalForIO.io;

  const io = new SocketIOServer(httpServer, {
    path: env.NEXT_PUBLIC_SOCKET_IO_PATH,
    cors: { origin: env.NEXT_PUBLIC_APP_URL, credentials: true },
  });

  // Redis pub/sub adapter: without this, a message only reaches clients
  // connected to the *same* server process. Any deployment running more
  // than one instance (PM2 cluster mode on a VPS, or several Codespaces/
  // VPS processes behind a load balancer) needs it for a message sent to
  // an instance-A client to also reach an instance-B client in the same
  // room. A single ioredis connection can't run regular commands and stay
  // subscribed at once, hence two duplicated connections (pub/sub is
  // exactly what lib/redis.ts's own comment flagged this Part would need).
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Every connection must present a valid Better Auth session cookie,
  // resolved exactly the way requireUser()/requireUserApi() do for HTTP
  // requests (lib/auth-guard.ts) — no separate auth scheme for sockets.
  io.use(async (socket, next) => {
    try {
      const cookie = socket.handshake.headers.cookie ?? "";
      const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
      if (!session?.user) {
        next(new Error("Unauthorized"));
        return;
      }
      socket.data.userId = session.user.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    // Personal room for notifications that aren't tied to one conversation
    // (booking accepted/rejected, selected for a job post, etc).
    socket.join(`user:${userId}`);

    socket.on("join-conversation", async (conversationId: string, ack?: (ok: boolean) => void) => {
      if (typeof conversationId !== "string") {
        ack?.(false);
        return;
      }
      const convo = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { customerId: true, workerId: true },
      });
      // Same authorization a REST GET on this conversation would apply —
      // only the two participants may join the room and see live events.
      if (!convo || (convo.customerId !== userId && convo.workerId !== userId)) {
        ack?.(false);
        return;
      }
      socket.join(`conversation:${conversationId}`);
      ack?.(true);
    });

    socket.on("leave-conversation", (conversationId: string) => {
      if (typeof conversationId === "string") socket.leave(`conversation:${conversationId}`);
    });

    // Ephemeral, not persisted — presence only, never written to Postgres.
    socket.on("typing", (conversationId: string) => {
      if (typeof conversationId === "string") {
        socket.to(`conversation:${conversationId}`).emit("typing", { userId });
      }
    });

    socket.on("stop-typing", (conversationId: string) => {
      if (typeof conversationId === "string") {
        socket.to(`conversation:${conversationId}`).emit("stop-typing", { userId });
      }
    });
  });

  globalForIO.io = io;
  return io;
}