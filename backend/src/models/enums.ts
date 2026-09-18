export const MEMBERSHIP_ROLES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "COMMENTER",
  "VIEWER",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 0,
  COMMENTER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const BUILDING_TYPES = [
  "FOUNDATION",
  "SINGLE",
  "MULTI",
  "ROAD",
  "BRIDGE",
] as const;
export type BuildingType = (typeof BUILDING_TYPES)[number];

export const STAGES = [
  "CONCEPT",
  "PRE_TENDER",
  "TENDER",
  "CONTRACT",
  "VALUATION",
  "FINAL_ACCOUNT",
] as const;
export type Stage = (typeof STAGES)[number];

export const ROOF_MODES = ["SIMPLE", "COMPLEX"] as const;
export type RoofMode = (typeof ROOF_MODES)[number];

export const TASK_STATUSES = ["TODO", "DOING", "REVIEW", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ANCHOR_TYPES = [
  "PROJECT",
  "BOQ_ITEM",
  "RATE_LINE",
  "MEMBER_TYPE",
  "PLACEMENT",
  "ROOF_PLANE",
  "ROOF_LINE",
] as const;
export type AnchorType = (typeof ANCHOR_TYPES)[number];

export const RESOURCE_CATEGORIES = [
  "LABOUR",
  "MATERIAL",
  "PLANT",
  "SUBCONTRACT",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const MANUAL_RATE_KINDS = ["BOQ", "BOM"] as const;
export type ManualRateKind = (typeof MANUAL_RATE_KINDS)[number];

export const EXPORT_KINDS = [
  "BOQ_PDF",
  "BOM_PDF",
  "RATE_PDF",
  "BBS_PDF",
  "DIMS_PDF",
  "FULL_XLSX",
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export const JOB_STATUSES = ["QUEUED", "RUNNING", "DONE", "FAILED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const PLAN_IDS = ["STARTER", "PROFESSIONAL", "TEAM", "ENTERPRISE"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLING_CYCLES = ["MONTHLY", "ANNUAL"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const PROVIDERS = ["STRIPE", "FLUTTERWAVE", "PAYSTACK", "INVOICE"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const SUB_STATUSES = [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "INCOMPLETE",
] as const;
export type SubStatus = (typeof SUB_STATUSES)[number];

export const INVOICE_STATUSES = [
  "DRAFT",
  "OPEN",
  "PAID",
  "VOID",
  "UNCOLLECTIBLE",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const CHECKOUT_STATUSES = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "EXPIRED",
] as const;
export type CheckoutStatus = (typeof CHECKOUT_STATUSES)[number];
