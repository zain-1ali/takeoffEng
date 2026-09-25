import type { NextFunction, Request, Response } from "express";
import { forbidden, notFound } from "../common/problem.js";
import { Membership, Organization, ROLE_RANK, type MembershipRole } from "../models/index.js";

export function requireOrg(req: Request, _res: Response, next: NextFunction): void {
  void resolveOrg(req, true).then(next).catch(next);
}

export function optionalOrg(req: Request, _res: Response, next: NextFunction): void {
  void resolveOrg(req, false).then(next).catch(next);
}

export function requireRole(...roles: MembershipRole[]) {
  const minimum = Math.min(...roles.map((role) => ROLE_RANK[role]));
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.membership) {
      next(forbidden());
      return;
    }
    if (ROLE_RANK[req.membership.role] < minimum) {
      next(forbidden("Your role cannot perform this action."));
      return;
    }
    next();
  };
}

async function resolveOrg(req: Request, required: boolean): Promise<void> {
  const queryOrg = typeof req.query.org_id === "string"
    ? req.query.org_id
    : typeof req.query.orgId === "string"
      ? req.query.orgId
      : "";
  const header = req.header("x-org-id")?.trim() || queryOrg.trim();
  if (!header) {
    if (required) throw forbidden("X-Org-Id header is required.");
    return;
  }
  if (!req.userId) throw forbidden();
  const [org, membership] = await Promise.all([
    Organization.findById(header),
    Membership.findOne({ orgId: header, userId: req.userId }),
  ]);
  if (!org || !membership) {
    if (required) throw notFound("Organisation not found.");
    return;
  }
  req.orgId = org.id;
  req.membership = {
    id: membership.id,
    orgId: org.id,
    userId: membership.userId,
    role: membership.role,
  };
}
