import type { BuildingType, PlanId } from "../models/enums.js";

export interface PlanEntitlements {
  plan: PlanId;
  maxProjects: number | null;
  types: readonly BuildingType[];
  rateAnalysis: boolean;
  bom: boolean;
  collaboration: boolean;
  exportsWatermark: boolean;
  sharedDatabank: boolean;
  versionsDays: number | null;
  sso: boolean;
  auditExport: boolean;
  minSeats: number;
}

const ALL_TYPES: readonly BuildingType[] = [
  "FOUNDATION",
  "SINGLE",
  "MULTI",
  "ROAD",
  "BRIDGE",
];

export const PLANS: Record<PlanId, PlanEntitlements> = {
  STARTER: {
    plan: "STARTER",
    maxProjects: 1,
    types: ["FOUNDATION", "SINGLE"],
    rateAnalysis: false,
    bom: false,
    collaboration: false,
    exportsWatermark: true,
    sharedDatabank: false,
    versionsDays: 30,
    sso: false,
    auditExport: false,
    minSeats: 1,
  },
  PROFESSIONAL: {
    plan: "PROFESSIONAL",
    maxProjects: null,
    types: ALL_TYPES,
    rateAnalysis: true,
    bom: true,
    collaboration: false,
    exportsWatermark: false,
    sharedDatabank: false,
    versionsDays: 90,
    sso: false,
    auditExport: false,
    minSeats: 1,
  },
  TEAM: {
    plan: "TEAM",
    maxProjects: null,
    types: ALL_TYPES,
    rateAnalysis: true,
    bom: true,
    collaboration: true,
    exportsWatermark: false,
    sharedDatabank: true,
    versionsDays: 180,
    sso: false,
    auditExport: false,
    minSeats: 3,
  },
  ENTERPRISE: {
    plan: "ENTERPRISE",
    maxProjects: null,
    types: ALL_TYPES,
    rateAnalysis: true,
    bom: true,
    collaboration: true,
    exportsWatermark: false,
    sharedDatabank: true,
    versionsDays: null,
    sso: true,
    auditExport: true,
    minSeats: 10,
  },
};

export function entitlementsFor(plan: PlanId | string | undefined): PlanEntitlements {
  return PLANS[(plan as PlanId) in PLANS ? (plan as PlanId) : "STARTER"];
}
