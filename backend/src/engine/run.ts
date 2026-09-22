import {
  analyse,
  bomRows,
  bomTotal,
  boqTotals,
  catalogue,
  compute,
  DIAMETERS,
  n,
  type BomRow,
  type ComputeResult,
  type FullProject,
  type PricingContext,
  type Resource as EngineResource,
  type ResourceCategory as EngineCategory,
} from "@takeoff/engine";
import {
  CustomRate,
  ManualRate,
  RateSettings,
  Resource,
  type ResourceCategory,
} from "../models/index.js";
import type { ProjectDoc } from "../models/project.js";
import type { BuildingType } from "../models/enums.js";
import { engineBuildingType } from "../projects/defaults.js";
import { customRatesFromState, recipeLinesFrom } from "./customRates.js";
import { seedOrgDatabank } from "../databank/seed.js";
import { projectParams } from "./params.js";

const CATEGORY: Record<ResourceCategory, EngineCategory> = {
  LABOUR: "Labour",
  MATERIAL: "Material",
  PLANT: "Plant",
  SUBCONTRACT: "Subcontract",
};

const CONCRETE_CODES = new Set([
  "CPAD", "CSTUB", "CSTRIP", "CGB", "CSOG", "CCOL", "CBEAM",
  "CSLAB", "CWALL", "CSTAIR", "CLINT", "CBFT", "CPIER", "CABW",
  "CWING", "CBALL", "CPARA", "CGIRD", "CXHEAD", "CDIAPH", "CDECK",
  "CAPPR", "CDRN", "CBED", "CHW", "CAPR", "BLD",
]);

export interface EngineBundle {
  project: FullProject;
  result: ComputeResult;
  pricing: PricingContext;
  boq: ReturnType<typeof boqTotals>;
  bom: BomRow[];
  bomAmount: number;
  params: [string, string][];
}

export function toEngineProject(
  record: ProjectDoc,
  stateJson: Record<string, unknown>,
): FullProject {
  const btype = engineBuildingType(record.buildingType as BuildingType);
  return {
    ...stateJson,
    btype,
    roofMode: record.roofMode === "COMPLEX" ? "complex" : "simple",
    project: {
      ...((stateJson.project as object) ?? {}),
      name: record.name,
      currency: record.currency,
      numfmt: record.numberLocale,
    },
  } as FullProject;
}

export async function runEngine(
  record: ProjectDoc,
  stateJson: Record<string, unknown>,
): Promise<EngineBundle> {
  const project = toEngineProject(record, stateJson);
  const result = compute(project);
  await seedOrgDatabank(String(record.orgId));
  const [resources, customRows, manuals, settings] = await Promise.all([
    Resource.find({ orgId: record.orgId }).lean(),
    CustomRate.find({ projectId: record.id }).lean(),
    ManualRate.find({ projectId: record.id }).lean(),
    RateSettings.findById(record.id).lean(),
  ]);

  const engineResources: EngineResource[] = resources.map((row) => ({
    code: row.code,
    category: CATEGORY[row.category as ResourceCategory] ?? "Material",
    name: row.name,
    unit: row.unit,
    rate: n(row.rate),
    note: row.note ?? "",
  }));

  const ra = (stateJson.ra ?? {}) as Record<string, unknown>;
  const customRates = {
    ...Object.fromEntries(
      customRows.map((row) => [row.itemCode, { lines: recipeLinesFrom(row.lines) }]),
    ),
    ...customRatesFromState(stateJson),
  };

  const manualBoq: Record<string, number> = {};
  const manualBom: Record<string, number> = {};
  for (const row of manuals) {
    const value = n(row.rate);
    if (row.kind === "BOM") manualBom[row.itemCode] = value;
    else manualBoq[row.itemCode] = value;
  }
  const stateRates = (stateJson.rates ?? {}) as Record<string, unknown>;
  const stateMrates = (stateJson.mrates ?? {}) as Record<string, unknown>;
  for (const [code, raw] of Object.entries(stateRates)) {
    if (raw == null || raw === "") {
      delete manualBoq[code];
      continue;
    }
    const value = n(raw as number);
    if (Number.isFinite(value)) manualBoq[code] = value;
  }
  for (const [code, raw] of Object.entries(stateMrates)) {
    if (raw == null || raw === "") {
      delete manualBom[code];
      continue;
    }
    const value = n(raw as number);
    if (Number.isFinite(value)) manualBom[code] = value;
  }

  const types = (project as { types?: PricingContext["recipeTypes"] }).types;
  const roofx = (project as { roofx?: { trusses?: PricingContext["roofTrusses"] } }).roofx;
  const pricing: PricingContext = {
    project: project as PricingContext["project"],
    resources: engineResources,
    recipeTypes: types,
    roofTrusses: roofx?.trusses,
    factors: (stateJson.mat as PricingContext["factors"]) ?? undefined,
    mixes: (stateJson.mix as PricingContext["mixes"]) ?? undefined,
    customRates,
    databankCurrency: String(record.databankCurrency ?? "USD"),
    projectCurrency: String(record.currency),
    fxRate: n((ra.fx ?? record.fxRate) as number) || Number(record.fxRate) || 1,
    toolsPct: ra.tools != null && ra.tools !== "" ? n(ra.tools as number) : settings?.toolsPct,
    overheadPct: ra.oh != null && ra.oh !== "" ? n(ra.oh as number) : settings?.overheadPct,
    profitPct: ra.profit != null && ra.profit !== "" ? n(ra.profit as number) : settings?.profitPct,
  };

  const entries = catalogue(project);
  const boq = boqTotals(result, entries, pricing, {
    manualRates: manualBoq,
    contingencyPct: Number(record.contingencyRate),
    taxPct: Number(record.taxRate),
  });
  const bom = bomRows({
    ...pricing,
    result,
    manualMaterialRates: manualBom,
  });

  return {
    project,
    result,
    pricing,
    boq,
    bom,
    bomAmount: bomTotal(bom),
    params: projectParams(stateJson, result, {
      currency: String(record.currency),
      measurementBasis: record.measurementBasis ? String(record.measurementBasis) : null,
      contract: record.contract ? String(record.contract) : null,
      startDate: record.startDate ? String(record.startDate) : null,
      duration: record.duration ? String(record.duration) : null,
      userParams: Array.isArray(record.params)
        ? (record.params as { label?: string; value?: string }[])
        : [],
    }),
  };
}

export function summaryFrom(bundle: EngineBundle) {
  return {
    concrete: bundle.result.concrete,
    steelKg: bundle.result.steelKg,
    formwork: bundle.result.formwork,
    floorArea: bundle.result.floorArea,
    warn: bundle.result.warn,
    itemCount: bundle.result.items.length,
    barCount: bundle.result.bars.length,
    subtotal: bundle.boq.subtotal,
    contingency: bundle.boq.contingency,
    tax: bundle.boq.tax,
    total: bundle.boq.total,
    bills: bundle.boq.bills,
    params: bundle.params,
  };
}

export function dashboardFrom(
  bundle: EngineBundle,
  options: { rateAnalysis?: boolean; bom?: boolean } = {},
) {
  const { result, boq, bom } = bundle;
  const concreteByElement: Record<string, number> = {};
  const formworkByElement: Record<string, number> = {};
  for (const item of result.items) {
    if (CONCRETE_CODES.has(item.code)) {
      concreteByElement[item.el] = (concreteByElement[item.el] ?? 0) + item.q;
    }
    if (/^F(?!STRIS|F_)/.test(item.code)) {
      formworkByElement[item.el] = (formworkByElement[item.el] ?? 0) + item.q;
    }
  }
  const excavation = Object.entries(result.tot)
    .filter(([code]) => /^EXC|^RCUT$/.test(code))
    .reduce((sum, [, quantity]) => sum + quantity, 0);
  const resourceSplit = { Labour: 0, Material: 0, Plant: 0, Subcontract: 0 };
  if (options.rateAnalysis !== false) {
    for (const row of boq.items) {
      if (row.manualRate != null || !row.rate) continue;
      const analysis = analyse(row.code, bundle.pricing);
      const share = analysis.rate ? row.amount / analysis.rate : 0;
      resourceSplit.Labour += analysis.categories.Labour * share + analysis.tools * share;
      resourceSplit.Material += analysis.categories.Material * share;
      resourceSplit.Plant += analysis.categories.Plant * share;
      resourceSplit.Subcontract += analysis.categories.Subcontract * share;
    }
  }
  const steelByDiameter = DIAMETERS.map((diameter) => ({
    diameter,
    kg: result.bars.filter((bar) => bar.dia === diameter).reduce((sum, bar) => sum + bar.kg, 0),
  })).filter((row) => row.kg > 0);

  const materials = options.bom === false
    ? []
    : bom
      .filter((row): row is Extract<BomRow, { code: string }> => "code" in row)
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 8)
      .map((row) => ({ code: row.code, material: row.material, amount: row.amount }));

  return {
    summary: summaryFrom(bundle),
    excavation,
    costByBill: boq.bills.map((bill) => ({ title: bill.title, amount: bill.amount, itemCount: bill.itemCount })),
    resourceSplit,
    topItems: [...boq.items].sort((left, right) => right.amount - left.amount).slice(0, 10),
    waterfall: [
      { label: "Measured work", amount: boq.subtotal },
      { label: "Contingency", amount: boq.contingency },
      { label: "Tax", amount: boq.tax },
      { label: "Total", amount: boq.total },
    ],
    concreteByElement,
    formworkByElement,
    steelByDiameter,
    materials,
    concreteByLevel: result.levels.map((level, index) => ({
      name: level.name,
      concrete: result.items
        .filter((item) => item.lvl === index && CONCRETE_CODES.has(item.code))
        .reduce((sum, item) => sum + item.q, 0),
    })),
  };
}
