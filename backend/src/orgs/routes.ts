import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../common/async-handler.js";
import { writeAudit } from "../common/audit.js";
import { randomToken, sha256 } from "../common/crypto.js";
import { conflict, forbidden, notFound, problem } from "../common/problem.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import {
  Invitation,
  MEMBERSHIP_ROLES,
  Membership,
  Organization,
  ROLE_RANK,
  User,
  type MembershipRole,
} from "../models/index.js";
import { sendInviteEmail } from "../mail/mailer.js";
import { createOrganization } from "./service.js";

export const orgsRouter = Router();
export const invitationsRouter = Router();

orgsRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        defaultCurrency: z.string().trim().min(3).max(8).optional(),
        numberLocale: z.string().trim().min(2).max(16).optional(),
      })
      .parse(req.body);
    const { org } = await createOrganization({
      name: body.name,
      ownerId: req.userId!,
      defaultCurrency: body.defaultCurrency,
      numberLocale: body.numberLocale,
    });
    await writeAudit({
      orgId: org.id,
      actorId: req.userId,
      action: "org.created",
      ip: req.ip,
    });
    res.status(201).json(org.toJSON());
  }),
);

orgsRouter.get(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const membership = await Membership.findOne({
      orgId: req.params.id,
      userId: req.userId,
    });
    if (!membership) throw notFound("Organisation not found.");
    const org = await Organization.findById(req.params.id);
    if (!org) throw notFound("Organisation not found.");
    res.json(org.toJSON());
  }),
);

orgsRouter.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertRole(req.userId!, req.params.id!, "ADMIN");
    const body = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        defaultCurrency: z.string().trim().min(3).max(8).optional(),
        numberLocale: z.string().trim().min(2).max(16).optional(),
        taxName: z.string().trim().min(1).max(40).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        measurementStandard: z.string().trim().max(80).nullable().optional(),
        databankCurrency: z.string().trim().min(3).max(8).optional(),
        priceBasis: z.string().trim().max(200).optional(),
      })
      .parse(req.body);
    const org = await Organization.findByIdAndUpdate(req.params.id, body, { new: true });
    if (!org) throw notFound("Organisation not found.");
    await writeAudit({
      orgId: org.id,
      actorId: req.userId,
      action: "org.updated",
      ip: req.ip,
    });
    res.json(org.toJSON());
  }),
);

orgsRouter.get(
  "/:id/members",
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertMember(req.userId!, req.params.id!);
    const members = await Membership.find({ orgId: req.params.id }).lean();
    res.json({
      members: members.map((row) => ({
        id: row._id,
        orgId: row.orgId,
        userId: row.userId,
        role: row.role,
        createdAt: row.createdAt,
      })),
    });
  }),
);

orgsRouter.patch(
  "/:id/members/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertRole(req.userId!, req.params.id!, "ADMIN");
    const body = z.object({ role: z.enum(MEMBERSHIP_ROLES) }).parse(req.body);
    if (body.role === "OWNER") throw forbidden("Transfer ownership is not available yet.");
    const member = await Membership.findOne({
      orgId: req.params.id,
      userId: req.params.userId,
    });
    if (!member) throw notFound("Member not found.");
    if (member.role === "OWNER") throw forbidden("The owner role cannot be changed.");
    member.role = body.role;
    await member.save();
    res.json({
      orgId: member.orgId,
      userId: member.userId,
      role: member.role,
    });
  }),
);

orgsRouter.delete(
  "/:id/members/:userId",
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertRole(req.userId!, req.params.id!, "ADMIN");
    if (req.params.userId === req.userId) {
      throw forbidden("You cannot remove yourself.");
    }
    const member = await Membership.findOne({
      orgId: req.params.id,
      userId: req.params.userId,
    });
    if (!member) throw notFound("Member not found.");
    if (member.role === "OWNER") throw forbidden("The owner cannot be removed.");
    await member.deleteOne();
    res.status(204).end();
  }),
);

orgsRouter.post(
  "/:id/invitations",
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertRole(req.userId!, req.params.id!, "ADMIN");
    const body = z
      .object({
        email: z.string().trim().email().transform((value) => value.toLowerCase()),
        role: z.enum(MEMBERSHIP_ROLES).default("EDITOR"),
      })
      .parse(req.body);
    if (body.role === "OWNER") throw forbidden("Cannot invite an owner.");
    const invitedUser = await User.findOne({ email: body.email });
    if (invitedUser) {
      const existing = await Membership.findOne({
        orgId: req.params.id,
        userId: invitedUser.id,
      });
      if (existing) throw conflict("That user is already a member.");
    }
    const token = randomToken();
    const invitation = await Invitation.create({
      orgId: req.params.id,
      email: body.email,
      role: body.role,
      tokenHash: sha256(token),
      invitedById: req.userId,
      expiresAt: new Date(Date.now() + env().INVITE_TTL_SECONDS * 1000),
    });
    const acceptUrl = `${env().WEB_URL}/invite/${token}`;
    const org = await Organization.findById(req.params.id);
    await sendInviteEmail({
      to: body.email,
      orgName: org?.name ?? "a workspace",
      role: body.role,
      acceptUrl,
    });
    res.status(201).json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      ...(env().NODE_ENV !== "production"
        ? { devToken: token, devAcceptUrl: acceptUrl }
        : {}),
    });
  }),
);

orgsRouter.delete(
  "/:id/invitations/:inviteId",
  requireAuth,
  asyncHandler(async (req, res) => {
    await assertRole(req.userId!, req.params.id!, "ADMIN");
    const invitation = await Invitation.findOne({
      _id: req.params.inviteId,
      orgId: req.params.id,
    });
    if (!invitation) throw notFound("Invitation not found.");
    await invitation.deleteOne();
    res.status(204).end();
  }),
);

invitationsRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const invitation = await findInvite(req.params.token!);
    const org = await Organization.findById(invitation.orgId);
    res.json({
      orgId: invitation.orgId,
      orgName: org?.name ?? "",
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    });
  }),
);

invitationsRouter.post(
  "/:token/accept",
  requireAuth,
  asyncHandler(async (req, res) => {
    const invitation = await findInvite(req.params.token!);
    const user = await User.findById(req.userId);
    if (!user || user.email !== invitation.email) {
      throw forbidden("Sign in with the invited email address to accept.");
    }
    const already = await Membership.findOne({
      orgId: invitation.orgId,
      userId: user.id,
    });
    if (!already) {
      await Membership.create({
        orgId: invitation.orgId,
        userId: user.id,
        role: invitation.role,
      });
    }
    invitation.acceptedAt = new Date();
    await invitation.save();
    res.json({ orgId: invitation.orgId, role: invitation.role });
  }),
);

async function findInvite(token: string) {
  const invitation = await Invitation.findOne({ tokenHash: sha256(token) });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) {
    throw problem(400, "invalid_token", "Invalid invitation", "This invitation is invalid or has expired.");
  }
  return invitation;
}

async function assertMember(userId: string, orgId: string) {
  const membership = await Membership.findOne({ orgId, userId });
  if (!membership) throw notFound("Organisation not found.");
  return membership;
}

async function assertRole(userId: string, orgId: string, role: MembershipRole) {
  const membership = await assertMember(userId, orgId);
  if (ROLE_RANK[membership.role as MembershipRole] < ROLE_RANK[role]) {
    throw forbidden("Your role cannot perform this action.");
  }
  return membership;
}

