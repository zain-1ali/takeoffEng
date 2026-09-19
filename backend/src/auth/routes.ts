import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../common/async-handler.js";
import { writeAudit } from "../common/audit.js";
import { sha256 } from "../common/crypto.js";
import { conflict, problem, unauthorized } from "../common/problem.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { Session, User } from "../models/index.js";
import { createOrganization } from "../orgs/service.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  createSession,
  rotateSession,
  setRefreshCookie,
} from "./tokens.js";

export const authRouter = Router();

const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(8).max(80);

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: emailSchema,
        password: passwordSchema,
        name: z.string().trim().min(1).max(80),
        orgName: z.string().trim().min(1).max(80),
      })
      .parse(req.body);
    const existing = await User.findOne({ email: body.email, deletedAt: null });
    if (existing) throw conflict("An account with that email already exists.");
    const user = await User.create({
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
    });
    await createOrganization({
      name: body.orgName,
      ownerId: user.id,
    });
    const session = await issueSession(req, res, user, "user.signup");
    res.status(201).json(session);
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: emailSchema,
        password: passwordSchema,
      })
      .parse(req.body);
    const user = await User.findOne({ email: body.email, deletedAt: null }).select("+passwordHash");
    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      throw problem(401, "invalid_credentials", "Unauthorized", "Invalid email or password.");
    }
    const session = await issueSession(req, res, user, "user.login");
    res.json(session);
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token =
      (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE] ??
      z.object({ refreshToken: z.string().optional() }).parse(req.body).refreshToken;
    if (!token) throw unauthorized("Refresh token missing.");
    const session = await Session.findOne({
      refreshHash: sha256(token),
      revokedAt: null,
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw unauthorized("Refresh token is invalid or expired.");
    }
    const rotated = await rotateSession(session.id);
    setRefreshCookie(res, rotated.refreshToken);
    res.json({
      accessToken: rotated.accessToken,
      tokenType: "Bearer",
      expiresIn: env().ACCESS_TTL_SECONDS,
    });
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await Session.updateOne({ _id: req.sessionId }, { $set: { revokedAt: new Date() } });
    clearRefreshCookie(res);
    res.status(204).end();
  }),
);

async function issueSession(
  req: { get(name: string): string | undefined; ip?: string },
  res: Parameters<typeof setRefreshCookie>[0],
  user: { id: string; email: string; name?: string | null; locale?: string },
  action: "user.signup" | "user.login",
) {
  const session = await createSession({
    userId: user.id,
    userAgent: req.get("user-agent") ?? undefined,
    ip: req.ip,
  });
  setRefreshCookie(res, session.refreshToken);
  await writeAudit({
    actorId: user.id,
    action,
    ip: req.ip,
    data: { email: user.email },
  });
  return {
    accessToken: session.accessToken,
    tokenType: "Bearer",
    expiresIn: env().ACCESS_TTL_SECONDS,
    user: publicUser(user),
  };
}

function publicUser(user: { id: string; email: string; name?: string | null; locale?: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    locale: user.locale ?? "en",
  };
}
