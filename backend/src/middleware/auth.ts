import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { unauthorized } from "../common/problem.js";
import { env } from "../config/env.js";
import { Session, User } from "../models/index.js";

interface AccessPayload {
  sub: string;
  sid: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  void authenticate(req).then(next).catch(next);
}

async function authenticate(req: Request): Promise<void> {
  const token = bearer(req) ?? cookieValue(req, "access_token");
  if (!token) throw unauthorized();
  let payload: AccessPayload;
  try {
    payload = jwt.verify(token, env().JWT_ACCESS_SECRET) as AccessPayload;
  } catch {
    throw unauthorized("Access token is invalid or expired.");
  }
  const [user, session] = await Promise.all([
    User.findOne({ _id: payload.sub, deletedAt: null }),
    Session.findById(payload.sid),
  ]);
  if (!user || !session || session.userId !== user.id || session.revokedAt) {
    throw unauthorized("Session is no longer valid.");
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw unauthorized("Session has expired.");
  }
  req.userId = user.id;
  req.sessionId = session.id;
}

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const query = req.query.access_token;
  if (typeof query === "string" && query) return query;
  return undefined;
}

function cookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[name];
}
