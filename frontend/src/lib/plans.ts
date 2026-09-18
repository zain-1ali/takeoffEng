export type PlanId = "STARTER" | "PROFESSIONAL" | "TEAM" | "ENTERPRISE";

export interface MarketingPlan {
  id: PlanId;
  name: string;
  price: number | null;
  annual: number | null;
  unit: string;
  seatsMin: number;
  cta: string;
  popular?: boolean;
  blurb: string;
  features: string[];
}

export const MARKETING_PLANS: readonly MarketingPlan[] = [
  {
    id: "STARTER",
    name: "Starter",
    price: 0,
    annual: 0,
    unit: "free forever",
    seatsMin: 1,
    cta: "Start free",
    blurb: "Try the full take-off engine on small jobs.",
    features: [
      "1 active project",
      "Foundations and single-storey buildings",
      "Bills of quantities and bar schedule",
      "Cover page and dashboard",
      "Exports with a watermark",
    ],
  },
  {
    id: "PROFESSIONAL",
    name: "Professional",
    price: 29,
    annual: 23,
    unit: "per user / month",
    seatsMin: 1,
    cta: "Choose Professional",
    popular: true,
    blurb: "For quantity surveyors pricing real work every week.",
    features: [
      "Unlimited projects",
      "Buildings, roads and concrete bridges",
      "Rate analysis with your own resource databank",
      "Bill of materials and rate analysis reports",
      "Any currency, clean Excel and PDF exports",
    ],
  },
  {
    id: "TEAM",
    name: "Team",
    price: 49,
    annual: 39,
    unit: "per user / month",
    seatsMin: 3,
    cta: "Choose Team",
    blurb: "Measure, check and price together.",
    features: [
      "Everything in Professional",
      "Shared workspace and live presence",
      "Comments on bill items and tasks",
      "Roles: owner, editor, commenter, viewer",
      "Shared databank and version history",
    ],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: null,
    annual: null,
    unit: "tailored",
    seatsMin: 10,
    cta: "Talk to us",
    blurb: "For consultancies, contractors and public agencies.",
    features: [
      "Everything in Team",
      "Single sign-on and audit log",
      "Private hosting region",
      "Custom measurement standards and templates",
      "Onboarding and priority support",
    ],
  },
];

export const FX_APPROX: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  RWF: 1450,
  KES: 129,
  UGX: 3700,
  TZS: 2700,
  NGN: 1550,
  ZAR: 18.3,
  GHS: 15.5,
  INR: 84,
  AED: 3.67,
  CAD: 1.37,
  AUD: 1.52,
};

export function convertUsd(usd: number, currency: string): number {
  return usd * (FX_APPROX[currency] ?? 1);
}

export function formatPlanPrice(usd: number, currency: string): string {
  const value = convertUsd(usd, currency);
  const rounded = Math.round(value);
  return `${currency} ${rounded.toLocaleString("en-GB")}`;
}
