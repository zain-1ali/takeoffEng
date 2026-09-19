import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../common/async-handler.js";
import { writeAudit } from "../common/audit.js";
import { randomToken, sha256 } from "../common/crypto.js";
import { problem, unauthorized } from "../common/problem.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { MagicLinkToken, Session, User } from "../models/index.js";
import { sendMagicLinkEmail } from "../mail/mailer.js";
import { createOrganization } from "../orgs/service.js";
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  createSession,
  rotateSession,
  setRefreshCookie,
} from "./tokens.js";

export const authRouter = Router();

const emailSchema = z.string().trim().email().transform((value) => value.toLowerCase());

authRouter.post(
  "/magic-link",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: emailSchema,
        name: z.string().trim().min(1).max(80).optional(),
      })
      .parse(req.body);
    const token = randomToken();
    await MagicLinkToken.create({
      email: body.email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + env().MAGIC_LINK_TTL_SECONDS * 1000),
    });
    const verifyUrl = `${env().WEB_URL}/verify?token=${token}`;
    await sendMagicLinkEmail({ to: body.email, name: body.name, verifyUrl });
    const payload: Record<string, unknown> = { sent: true };
    if (env().NODE_ENV !== "production") {
      payload.devToken = token;
      payload.devVerifyUrl = verifyUrl;
    }
    res.status(202).json(payload);
  }),
);

authRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        token: z.string().min(16),
        name: z.string().trim().min(1).max(80).optional(),
        orgName: z.string().trim().min(1).max(80).optional(),
      })
      .parse(req.body);
    const record = await MagicLinkToken.findOne({ tokenHash: sha256(body.token) });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw problem(400, "invalid_token", "Invalid token", "This sign-in link is invalid or has expired.");
    }
    record.usedAt = new Date();
    await record.save();

    let user = await User.findOne({ email: record.email, deletedAt: null });
    const isNew = !user;
    if (!user) {
      user = await User.create({
        email: record.email,
        name: body.name ?? record.email.split("@")[0],
      });
      await createOrganization({
        name: body.orgName ?? `${user.name}'s workspace`,
        ownerId: user.id,
      });
    } else if (body.name && !user.name) {
      user.name = body.name;
      await user.save();
    }

    const session = await createSession({
      userId: user.id,
      userAgent: req.get("user-agent") ?? undefined,
      ip: req.ip,
    });
    setRefreshCookie(res, session.refreshToken);
    await writeAudit({
      actorId: user.id,
      action: isNew ? "user.signup" : "user.login",
      ip: req.ip,
      data: { email: user.email },
    });
    res.json({
      accessToken: session.accessToken,
      tokenType: "Bearer",
      expiresIn: env().ACCESS_TTL_SECONDS,
      user: publicUser(user),
    });
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

function publicUser(user: { id: string; email: string; name?: string | null; locale?: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    locale: user.locale ?? "en",
  };
}
