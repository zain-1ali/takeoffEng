import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Session } from "../models/index.js";
import { randomToken, sha256 } from "../common/crypto.js";

const REFRESH_COOKIE = "refresh_token";

export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ sub: userId, sid: sessionId }, env().JWT_ACCESS_SECRET, {
    expiresIn: env().ACCESS_TTL_SECONDS as jwt.SignOptions["expiresIn"],
  });
}

export async function createSession(params: {
  userId: string;
  userAgent?: string;
  ip?: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + env().REFRESH_TTL_SECONDS * 1000);
  const session = await Session.create({
    userId: params.userId,
    refreshHash: sha256(refreshToken),
    userAgent: params.userAgent ?? null,
    ip: params.ip ?? null,
    expiresAt,
  });
  return {
    accessToken: signAccessToken(params.userId, session.id),
    refreshToken,
    expiresAt,
  };
}

export async function rotateSession(sessionId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  userId: string;
}> {
  const session = await Session.findById(sessionId);
  if (!session) throw new Error("missing session");
  const refreshToken = randomToken();
  session.refreshHash = sha256(refreshToken);
  session.expiresAt = new Date(Date.now() + env().REFRESH_TTL_SECONDS * 1000);
  session.revokedAt = null;
  await session.save();
  return {
    accessToken: signAccessToken(session.userId, session.id),
    refreshToken,
    expiresAt: session.expiresAt,
    userId: session.userId,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  const options: CookieOptions = {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax",
    path: "/v1/auth",
    maxAge: env().REFRESH_TTL_SECONDS * 1000,
  };
  res.cookie(REFRESH_COOKIE, token, options);
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/v1/auth" });
}

export { REFRESH_COOKIE };
