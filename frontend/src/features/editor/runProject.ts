import {
  allDefaultResources,
  analyse,
  bomRows,
  boqTotals,
  catalogue,
  compute,
  n,
  type BomRow,
  type BoqTotals,
  type ComputeResult,
  type FullProject,
  type NumericInput,
  type PricingContext,
  type Resource,
} from "@takeoff/engine";
import { projectParams } from "../../lib/params.js";
import { parseCustomRates } from "../project/pricing/helpers.js";

export interface ComputedTotals {
  concrete: number;
  steelKg: number;
  formwork: number;
  floorArea: number;
  itemCount: number;
  barCount: number;
  subtotal: number;
  contingency: number;
  tax: number;
  total: number;
}

export interface SplitDatum {
  label: string;
  value: number;
  color?: string;
}

export interface ComputedBundle {
  result: ComputeResult;
  boq: BoqTotals;
  bom: BomRow[];
  totals: ComputedTotals;
  params: [string, string][];
  split: SplitDatum[];
}

type ProjectExtras = FullProject & {
  mat?: PricingContext["factors"];
  mix?: PricingContext["mixes"];
  report?: { cont?: unknown; vat?: unknown };
  rates?: unknown;
  mrates?: unknown;
  ra?: unknown;
  resources?: Resource[];
  databankCurrency?: string;
  projectCurrency?: string;
  fxRate?: number;
};

const CAT_COLOR: Record<string, string> = {
  Labour: "var(--ink)",
  Material: "var(--steel)",
  Plant: "var(--core)",
  Subcontract: "var(--hivis)",
};

function optionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const num = n(value as NumericInput);
  return Number.isFinite(num) ? num : undefined;
}

function numberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const num = optionalNumber(raw);
    if (num != null) out[key] = num;
  }
  return out;
}

function raNumber(ra: Record<string, unknown>, key: string): number | undefined {
  return optionalNumber(ra[key]);
}

export function pricingFrom(project: FullProject): PricingContext {
  const extras = project as ProjectExtras;
  const ra = extras.ra && typeof extras.ra === "object" && !Array.isArray(extras.ra)
    ? extras.ra as Record<string, unknown>
    : {};
  const resources = Array.isArray(extras.resources) ? extras.resources : allDefaultResources();
  return {
    project: project as PricingContext["project"],
    resources,
    recipeTypes: "types" in project ? project.types : undefined,
    roofTrusses: "roofx" in project ? project.roofx?.trusses : undefined,
    factors: extras.mat,
    mixes: extras.mix,
    customRates: parseCustomRates(extras.ra),
    databankCurrency: extras.databankCurrency ?? (typeof ra.cur === "string" ? ra.cur : undefined),
    projectCurrency: extras.projectCurrency ?? extras.project?.currency,
    fxRate: extras.fxRate ?? raNumber(ra, "fx"),
    toolsPct: raNumber(ra, "tools"),
    overheadPct: raNumber(ra, "oh"),
    profitPct: raNumber(ra, "profit"),
  };
}

function resourceSplit(boq: BoqTotals, pricing: PricingContext): SplitDatum[] {
  const totals = { Labour: 0, Material: 0, Plant: 0, Subcontract: 0 };
  for (const item of boq.items) {
    if (item.manualRate != null) continue;
    const analysis = analyse(item.code, pricing);
    if (!analysis.rate) continue;
    const scale = item.amount / analysis.rate;
    totals.Labour += (analysis.categories.Labour + analysis.tools) * scale;
    totals.Material += analysis.categories.Material * scale;
    totals.Plant += analysis.categories.Plant * scale;
    totals.Subcontract += analysis.categories.Subcontract * scale;
  }
  return (Object.keys(totals) as (keyof typeof totals)[]).map((label) => ({
    label,
    value: totals[label],
    color: CAT_COLOR[label],
  }));
}

export function runProject(project: FullProject): ComputedBundle {
  const result = compute(project);
  const entries = catalogue(project);
  const extras = project as ProjectExtras;
  const pricing = pricingFrom(project);
  const boq = boqTotals(result, entries, pricing, {
    manualRates: numberMap(extras.rates),
    contingencyPct: optionalNumber(extras.report?.cont),
    taxPct: optionalNumber(extras.report?.vat),
  });
  const bom = bomRows({
    ...pricing,
    result,
    manualMaterialRates: numberMap(extras.mrates),
  });
  const meta = "project" in project ? project.project : undefined;
  return {
    result,
    boq,
    bom,
    totals: {
      concrete: result.concrete,
      steelKg: result.steelKg,
      formwork: result.formwork,
      floorArea: result.floorArea,
      itemCount: result.items.length,
      barCount: result.bars.length,
      subtotal: boq.subtotal,
      contingency: boq.contingency,
      tax: boq.tax,
      total: boq.total,
    },
    params: projectParams(project as unknown as Record<string, unknown>, result, {
      currency: meta && "currency" in meta ? String(meta.currency) : "USD",
    }),
    split: resourceSplit(boq, pricing),
  };
}

export function roundSummary(totals: ComputedTotals) {
  const round = (value: number) => Math.round(value * 1_000) / 1_000;
  return {
    items: totals.itemCount,
    bars: totals.barCount,
    concrete: round(totals.concrete),
    steelKg: round(totals.steelKg),
    formwork: round(totals.formwork),
    floorArea: round(totals.floorArea),
    boqTotal: round(totals.total),
  };
}
