import { activeLevels, compute as computeStructural } from "../compute.js";
import { n } from "../expression.js";
import { kgPerM } from "../helpers.js";
import type {
  Bar,
  ComputeResult,
  MeasuredItem,
  NumericInput,
  StructuralProject,
  TypeStats,
} from "../types.js";
import { computeCivil } from "./civil.js";
import type { CivilProject } from "./civil-types.js";
import {
  computeFinishes,
  computeMEP,
  PHASE2_KINDS,
} from "./finishes-mep.js";
import type {
  Phase2Add,
  Phase2Bar,
  Phase2MeasureContext,
  Phase2Project,
} from "./finishes-mep-types.js";
import { computeRoofing } from "./roofing.js";
import type {
  RoofAdd,
  RoofMeasureContext,
  RoofingProjectLike,
} from "./roofing-types.js";

export type FullBuildingProject = Omit<StructuralProject, "btype"> & {
  btype: Exclude<StructuralProject["btype"], "road" | "bridge">;
} &
  Phase2Project &
  RoofingProjectLike;
export type FullProject = FullBuildingProject | CivilProject;

const CONCRETE_CODES = new Set([
  "CPAD", "CSTUB", "CSTRIP", "CGB", "CSOG", "CCOL", "CBEAM",
  "CSLAB", "CWALL", "CSTAIR", "CLINT", "CBFT", "CPIER", "CABW",
  "CWING", "CBALL", "CPARA", "CGIRD", "CXHEAD", "CDIAPH", "CDECK",
  "CAPPR", "CDRN", "CBED", "CHW", "CAPR",
]);

type SupplementContext = Phase2MeasureContext | RoofMeasureContext;

function addTypeUseDefaults(
  result: ComputeResult,
  project: FullBuildingProject,
): void {
  for (const group of Object.values(project.types)) {
    if (!Array.isArray(group)) continue;
    for (const value of group) {
      if (
        typeof value === "object" &&
        value !== null &&
        "id" in value &&
        typeof value.id === "string"
      ) {
        result.byType[value.id] ??= { conc: 0, kg: 0, uses: 0 };
      }
    }
  }
}

function refreshAggregates(result: ComputeResult): void {
  const totals: Record<string, number> = {};
  for (const item of result.items) {
    totals[item.code] = (totals[item.code] ?? 0) + item.q;
  }
  result.tot = totals;
  result.concrete = Object.entries(totals)
    .filter(([code]) => CONCRETE_CODES.has(code))
    .reduce((sum, [, quantity]) => sum + quantity, 0);
  result.steelKg = result.bars.reduce((sum, bar) => sum + bar.kg, 0);
  result.formwork = Object.entries(totals)
    .filter(([code]) => /^F(?!STRIS|F_)/.test(code))
    .reduce((sum, [, quantity]) => sum + quantity, 0);
  result.warn = [...new Set(result.warn)];
}

export function computeFullProject(project: FullProject): ComputeResult {
  if (project.btype === "road" || project.btype === "bridge") {
    return computeCivil(project);
  }
  const building = project as FullBuildingProject;
  const result = computeStructural(building);
  const levels = activeLevels(building);
  const levelIndex = new Map(levels.map((level, index) => [level.id, index]));

  const stat = (
    context: SupplementContext,
    key: "conc" | "kg",
    value: number,
  ): void => {
    const placement = (result.byPlacement[context.pid] ??= { conc: 0, kg: 0 });
    placement[key] += value;
    const type = (result.byType[context.tid] ??= { conc: 0, kg: 0, uses: 0 });
    type[key] += value;
  };

  const add = (
    context: SupplementContext,
    code: string,
    times: number,
    d1: number | null,
    d2: number | null,
    d3: number | null,
  ): void => {
    if (!Number.isFinite(times) || times === 0) return;
    const quantity = times * (d1 ?? 1) * (d2 ?? 1) * (d3 ?? 1);
    if (!Number.isFinite(quantity) || Math.abs(quantity) < 1e-9) return;
    const item: MeasuredItem = {
      loc: context.loc,
      lvl: context.lvl,
      el: context.el,
      tid: context.tid,
      code,
      times,
      d1,
      d2,
      d3,
      q: quantity,
    };
    result.items.push(item);
    if (CONCRETE_CODES.has(code)) stat(context, "conc", quantity);
  };

  const bar = (
    context: Phase2MeasureContext,
    shape: string,
    diameterInput: NumericInput,
    each: number,
    length: number,
  ): void => {
    const diameter = n(diameterInput);
    const members = context.members ?? 0;
    if (!diameter || !(each > 0) || !(length > 0) || !(members > 0)) return;
    context.markIndex = (context.markIndex ?? 0) + 1;
    const kg = members * each * length * kgPerM(diameter);
    const member = context.member ?? "";
    const output: Bar = {
      loc: context.loc,
      lvl: context.lvl,
      el: context.el,
      member,
      mark: `${member}-${String(context.markIndex).padStart(2, "0")}`,
      shape,
      dia: diameter,
      members,
      each,
      len: length,
      total: members * each * length,
      kg,
    };
    result.bars.push(output);
    add(
      context,
      `R${context.grp ?? ""}${diameter}`,
      members,
      length,
      each,
      kgPerM(diameter),
    );
    stat(context, "kg", kg);
  };

  const barsAcross = (width: number, spacingMm: NumericInput): number => {
    const spacing = n(spacingMm) / 1_000;
    return spacing > 0 && width > 0
      ? Math.ceil(width / spacing - 1e-9) + 1
      : 0;
  };

  const kinds = building.btype === "single" || building.btype === "multi"
    ? [...PHASE2_KINDS, "roof"]
    : [];
  const environment = {
    project: building,
    add: add as Phase2Add,
    bar: bar as Phase2Bar,
    nB: barsAcross,
    levels,
    levelIndex,
    kinds,
    warn: result.warn,
    byType: result.byType as Record<string, TypeStats>,
  };
  computeFinishes(environment);
  computeMEP(environment);
  computeRoofing({
    project: building,
    add: add as RoofAdd,
    levels,
    kinds,
    warn: result.warn,
    byType: result.byType,
  });

  addTypeUseDefaults(result, building);
  refreshAggregates(result);
  return result;
}
