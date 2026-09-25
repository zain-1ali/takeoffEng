import { io, type Socket } from "socket.io-client";

export function socketOrigin(): string {
  if (import.meta.env.DEV) return window.location.origin;
  return String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "") || window.location.origin;
}

export function connectRealtime(auth: { token: string; orgId: string; projectId?: string }): Socket {
  return io(socketOrigin(), {
    path: "/rt",
    auth,
    transports: ["websocket", "polling"],
    withCredentials: true,
  });
}
