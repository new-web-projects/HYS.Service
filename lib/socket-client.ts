"use client";

import { useEffect, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";

let sharedSocket: Socket | null = null;

/**
 * One socket connection shared across the whole tab, not one per component
 * — matches how server.ts/lib/socket-server.ts expect a client to behave
 * (join/leave rooms on an existing connection, not reconnect per page).
 *
 * No URL argument to io() — connects to the same origin the page loaded
 * from, which is correct for the primary deployment model (server.ts
 * serves Next.js and Socket.IO from one process/port). See server.ts's
 * file header for the one case that's NOT true (Vercel).
 */
function getSharedSocket(): Socket {
  if (!sharedSocket) {
    sharedSocket = io({
      path: process.env.NEXT_PUBLIC_SOCKET_IO_PATH || "/api/socket",
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
  }
  return sharedSocket;
}

/**
 * Joins `conversationId`'s room for the lifetime of the calling component,
 * leaves it on unmount, and exposes live connection state so the caller
 * can show a "reconnecting…" indicator (or fall back to polling — see
 * ChatWindow, which does both rather than assuming the socket is always
 * up, since it isn't on every deployment target — see server.ts).
 */
export function useConversationSocket(conversationId: string) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSharedSocket();

    function handleConnect() {
      setConnected(true);
      socket.emit("join-conversation", conversationId);
    }
    function handleDisconnect() {
      setConnected(false);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      if (socket.connected) socket.emit("leave-conversation", conversationId);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
    };
  }, [conversationId]);

  const sendTyping = useCallback(() => {
    getSharedSocket().emit("typing", conversationId);
  }, [conversationId]);

  const sendStopTyping = useCallback(() => {
    getSharedSocket().emit("stop-typing", conversationId);
  }, [conversationId]);

  // getSharedSocket() is a stable module-level singleton lookup, not a ref
  // read — safe to call during render, unlike accessing a ref's .current
  // here would be (React flags that, correctly: a ref can change between
  // render and commit without triggering a re-render, so a component
  // reading .current directly in its return value can silently go stale).
  return { socket: getSharedSocket(), connected, sendTyping, sendStopTyping };
}