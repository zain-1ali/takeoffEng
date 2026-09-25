import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { isAllowedOrigin } from "../config/origins.js";
import { env } from "../config/env.js";
import { Membership, Project, Session, User } from "../models/index.js";

export interface Presence {
  userId: string;
  name: string;
  orgId: string;
  projectId: string;
  view: string;
  item: string;
  at: number;
}

interface AccessPayload {
  sub: string;
  sid: string;
}

const HEARTBEAT_MS = 35_000;
const peers = new Map<string, Presence>();
const emitHooks = new Set<(event: string, payload: unknown, projectId: string) => void>();
let io: Server | null = null;

export function onProjectEmit(hook: (event: string, payload: unknown, projectId: string) => void): () => void {
  emitHooks.add(hook);
  return () => {
    emitHooks.delete(hook);
  };
}

export function attachRealtime(server: HttpServer): Server {
  io = new Server(server, {
    path: "/rt",
    cors: {
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    },
  });
  io.use((socket, next) => {
    void authorize(socket).then(() => next()).catch((err) => next(err instanceof Error ? err : new Error("Unauthorized")));
  });
  io.on("connection", (socket) => {
    void joinRooms(socket);
    socket.on("presence.update", (payload: unknown) => {
      updatePresence(socket, payload);
    });
    socket.on("disconnect", () => {
      peers.delete(socket.id);
      broadcastPresence(socket.data.orgId as string, socket.data.projectId as string);
    });
  });
  setInterval(() => sweepPresence(), 10_000).unref();
  return io;
}

export function emitProject(projectId: string, event: string, payload: unknown): void {
  io?.to(`project:${projectId}`).emit(event, payload);
  for (const hook of emitHooks) hook(event, payload, projectId);
}

export function emitUser(userId: string, event: string, payload: unknown): void {
  io?.to(`user:${userId}`).emit(event, payload);
}

function updatePresence(socket: Socket, payload: unknown): void {
  const body = (payload ?? {}) as { projectId?: string; view?: string; item?: string };
  const current = peers.get(socket.id);
  if (!current) return;
  const next: Presence = {
    ...current,
    projectId: String(body.projectId ?? current.projectId ?? ""),
    view: String(body.view ?? current.view ?? ""),
    item: String(body.item ?? ""),
    at: Date.now(),
  };
  const previousProject = current.projectId;
  peers.set(socket.id, next);
  if (next.projectId && next.projectId !== previousProject) {
    if (previousProject) void socket.leave(`project:${previousProject}`);
    void socket.join(`project:${next.projectId}`);
    broadcastPresence(current.orgId, previousProject);
  }
  broadcastPresence(current.orgId, next.projectId);
}

function broadcastPresence(orgId: string, projectId?: string): void {
  if (!io || !orgId) return;
  const orgPeers = [...peers.values()].filter((peer) => peer.orgId === orgId && Date.now() - peer.at < HEARTBEAT_MS);
  io.to(`org:${orgId}`).emit("presence.state", { peers: uniq(orgPeers) });
  if (projectId) {
    io.to(`project:${projectId}`).emit("presence.state", {
      peers: uniq(orgPeers.filter((peer) => peer.projectId === projectId || !peer.projectId)),
    });
  }
}

function sweepPresence(): void {
  const cutoff = Date.now() - HEARTBEAT_MS;
  const dirty = new Set<string>();
  for (const [id, peer] of peers) {
    if (peer.at < cutoff) {
      peers.delete(id);
      dirty.add(`${peer.orgId}|${peer.projectId}`);
    }
  }
  for (const key of dirty) {
    const [orgId, projectId] = key.split("|");
    broadcastPresence(orgId!, projectId);
  }
}

function uniq(list: Presence[]): Presence[] {
  const seen = new Set<string>();
  const out: Presence[] = [];
  for (const peer of list) {
    if (seen.has(peer.userId)) continue;
    seen.add(peer.userId);
    out.push(peer);
  }
  return out;
}

async function authorize(socket: Socket): Promise<void> {
  const token = String(socket.handshake.auth?.token ?? bearer(socket.handshake) ?? "");
  const orgId = String(socket.handshake.auth?.orgId ?? socket.handshake.query.orgId ?? "");
  if (!token || !orgId) throw new Error("Unauthorized");
  let payload: AccessPayload;
  try {
    payload = jwt.verify(token, env().JWT_ACCESS_SECRET) as AccessPayload;
  } catch {
    throw new Error("Unauthorized");
  }
  const [user, session, membership] = await Promise.all([
    User.findOne({ _id: payload.sub, deletedAt: null }),
    Session.findById(payload.sid),
    Membership.findOne({ orgId, userId: payload.sub }),
  ]);
  if (!user || !session || session.userId !== user.id || session.revokedAt || !membership) {
    throw new Error("Unauthorized");
  }
  socket.data.userId = user.id;
  socket.data.orgId = orgId;
  socket.data.role = membership.role;
  socket.data.name = user.name?.trim() || user.email.split("@")[0] || "Member";
  socket.data.projectId = String(socket.handshake.auth?.projectId ?? "");
}

async function joinRooms(socket: Socket): Promise<void> {
  const userId = socket.data.userId as string;
  const orgId = socket.data.orgId as string;
  const projectId = String(socket.data.projectId ?? "");
  await socket.join(`user:${userId}`);
  await socket.join(`org:${orgId}`);
  if (projectId) {
    const project = await Project.findOne({ _id: projectId, orgId });
    if (project) {
      await socket.join(`project:${projectId}`);
    } else {
      socket.data.projectId = "";
    }
  }
  peers.set(socket.id, {
    userId,
    name: socket.data.name as string,
    orgId,
    projectId: socket.data.projectId as string,
    view: "",
    item: "",
    at: Date.now(),
  });
  broadcastPresence(orgId, socket.data.projectId as string);
}

function bearer(handshake: { headers?: { authorization?: string }; auth?: { token?: string } }): string | undefined {
  const header = handshake.headers?.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);
  return undefined;
}
