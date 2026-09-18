import { Router } from "express";
import { z } from "zod";
import { entitlementsFor } from "../billing/plans.js";
import { asyncHandler } from "../common/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { optionalOrg } from "../middleware/org.js";
import { Membership, Organization, Subscription, User } from "../models/index.js";

export const meRouter = Router();

meRouter.get(
  "/me",
  requireAuth,
  optionalOrg,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(401).end();
      return;
    }
    const memberships = await Membership.find({ userId: user.id }).lean();
    const orgs = await Organization.find({
      _id: { $in: memberships.map((row) => row.orgId) },
    }).lean();
    const orgById = new Map(orgs.map((org) => [org._id, org]));
    const listed = memberships.map((row) => {
      const org = orgById.get(row.orgId);
      return {
        orgId: row.orgId,
        role: row.role,
        name: org?.name ?? "",
        slug: org?.slug ?? "",
      };
    });
    const active = listed.find((row) => row.orgId === req.orgId) ?? listed[0];
    const subscription = active
      ? await Subscription.findOne({ orgId: active.orgId }).lean()
      : null;
    const plan = subscription?.plan ?? "STARTER";
    const activeOrg = active ? orgById.get(active.orgId) : undefined;
    const org = activeOrg
      ? (({ _id, ...rest }) => ({ id: _id, ...rest }))(activeOrg)
      : null;
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        avatarKey: user.avatarKey,
      },
      memberships: listed,
      org,
      role: active?.role ?? null,
      plan,
      seats: subscription?.seats ?? 1,
      subscriptionStatus: subscription?.status ?? "ACTIVE",
      entitlements: entitlementsFor(plan),
    });
  }),
);

meRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80).optional(),
        locale: z.string().trim().min(2).max(12).optional(),
      })
      .parse(req.body);
    const user = await User.findByIdAndUpdate(req.userId, body, { new: true });
    res.json({
      id: user?.id,
      email: user?.email,
      name: user?.name,
      locale: user?.locale,
      avatarKey: user?.avatarKey,
    });
  }),
);
