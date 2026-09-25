import {
  n,
  type Bar,
  type BomItemRow,
  type BomRow,
  type BoqItemRow,
  type BoqRow,
  type ComputeResult,
  type FullProject,
  type NumericInput,
} from "@takeoff/engine";
import { asList, asRecord, stringOf, type DocMap } from "../../../lib/doc.js";
import { formatNumber } from "../../../lib/format.js";
import { stageLabel } from "../../../lib/catalog.js";
import type { ProjectRecord } from "../../../lib/types.js";
import { BTYPE_LABEL } from "../schema.js";

export const PAL = [
  "var(--ink)", "var(--steel)", "var(--core)", "var(--hivis)", "var(--ok)",
  "#8E6AC8", "#C0567A", "#3E9EA0", "#9AA6B0", "#D98E3F", "#5B7F2E", "#B8860B",
];

export const CAT_COLOR: Record<string, string> = {
  Labour: "var(--ink)",
  Material: "var(--steel)",
  Plant: "var(--core)",
  Subcontract: "var(--hivis)",
};

export const TYPICAL_RANGE: Record<string, [number, number]> = {
  Piers: [150, 320],
  "Abutments & walls": [60, 150],
  Deck: [120, 280],
  Parapets: [60, 130],
  Culverts: [40, 120],
  Foundations: [40, 130],
  Columns: [140, 320],
  Beams: [180, 380],
  Slabs: [60, 130],
  Walls: [70, 150],
  Stairs: [50, 120],
};

export const CONC_CODES = new Set([
  "CPAD", "CSTUB", "CSTRIP", "CGB", "CSOG", "CCOL", "CBEAM", "CSLAB", "CWALL", "CSTAIR",
  "CBFT", "CPIER", "CABW", "CWING", "CBALL", "CPARA", "CGIRD", "CXHEAD", "CDIAPH", "CDECK",
  "CAPPR", "CDRN", "CBED", "CHW", "CAPR",
]);

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
  show?: string;
}

export interface ReportSettings {
  contingency: number;
  tax: number;
  taxName: string;
}

export function isBoqItem(row: BoqRow): row is BoqItemRow {
  return "code" in row;
}

export function isBomItem(row: BomRow): row is BomItemRow {
  return "code" in row;
}

export function money(value: number, digits = 2, locale = "en-GB"): string {
  if (!Number.isFinite(value)) return "–";
  return formatNumber(value, digits, locale);
}

export function moneyOrDash(value: number, digits = 2, locale = "en-GB"): string {
  if (!Number.isFinite(value) || value === 0) return "–";
  return formatNumber(value, digits, locale);
}

export function localeOf(doc: DocMap | null): string {
  return stringOf(asRecord(doc?.project).numfmt, "en-GB") || "en-GB";
}

export function currencyOf(doc: DocMap | null, meta?: ProjectRecord | null): string {
  const project = asRecord(doc?.project);
  if (stringOf(project.currency) === "OTHER") {
    return stringOf(project.curCustom, "–").toUpperCase();
  }
  return stringOf(project.currency, meta?.currency ?? "USD") || "USD";
}

export function btypeOf(doc: DocMap | null, meta?: ProjectRecord | null): string {
  return stringOf(doc?.btype, engineFromMeta(meta?.buildingType) || "multi");
}

function engineFromMeta(value?: string): string {
  return value ? value.toLowerCase() : "";
}

export function typeLabel(btype: string): string {
  return BTYPE_LABEL[btype] ?? btype;
}

export function stageOf(doc: DocMap | null, meta?: ProjectRecord | null): string {
  const raw = stringOf(asRecord(doc?.project).stage);
  if (raw) return raw;
  return stageLabel(meta?.stage ?? "PRE_TENDER");
}

export function measurementBasis(doc: DocMap | null, meta?: ProjectRecord | null): string {
  const custom = stringOf(asRecord(doc?.project).standard, meta?.measurementBasis ?? "");
  if (custom) return custom;
  const btype = btypeOf(doc, meta);
  return btype === "road" || btype === "bridge" ? "CESMM4 principles" : "NRM2";
}

export function reportSettings(doc: DocMap | null, meta?: ProjectRecord | null): ReportSettings {
  const report = asRecord(doc?.report);
  const cont = optionalNumber(report.cont);
  const vat = optionalNumber(report.vat);
  return {
    contingency: cont ?? meta?.contingencyRate ?? 5,
    tax: vat ?? meta?.taxRate ?? 18,
    taxName: stringOf(report.taxName, meta?.taxName ?? "VAT") || "VAT",
  };
}

export function optionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const num = n(value as NumericInput);
  return Number.isFinite(num) ? num : undefined;
}

export function numberMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(asRecord(value))) {
    const num = optionalNumber(raw);
    if (num != null) out[key] = num;
  }
  return out;
}

export function sumTot(tot: Record<string, number> | undefined, pattern: RegExp): number {
  if (!tot) return 0;
  return Object.entries(tot).reduce((sum, [code, qty]) => (pattern.test(code) ? sum + qty : sum), 0);
}

export function excavationQty(result: ComputeResult): number {
  return sumTot(result.tot, /^EXC|^RCUT$/);
}

export function excavationBalance(result: ComputeResult): number {
  const balance = sumTot(result.tot, /^EXC/) - (result.tot.BFL ?? 0) - (result.tot.DSP ?? 0);
  return Math.abs(balance) < 0.0005 ? 0 : balance;
}

export function unitCost(
  project: FullProject | DocMap,
  result: ComputeResult,
  total: number,
): [number, string] | null {
  const btype = stringOf((project as { btype?: unknown }).btype);
  const placements = asRecord((project as { pl?: unknown }).pl);
  if (btype === "road") {
    const length = asList(placements.rpave).reduce((sum, row) => {
      const item = asRecord(row);
      return sum + Math.abs(n(item.to as NumericInput) - n(item.from as NumericInput));
    }, 0) / 1000;
    return length ? [total / length, "per km"] : null;
  }
  if (btype === "bridge") {
    const deck = asList(placements.bslab).find((row) => asRecord(row).part === "Deck slab");
    const item = asRecord(deck);
    const area = n(item.L as NumericInput) * n(item.W as NumericInput);
    return area ? [total / area, "per m² of deck"] : null;
  }
  return result.floorArea ? [total / result.floorArea, "per m² of floor and slab"] : null;
}

export function groupBoq(rows: readonly BoqRow[]): { title: string; rows: BoqItemRow[] }[] {
  const bills: { title: string; rows: BoqItemRow[] }[] = [];
  for (const row of rows) {
    if (!isBoqItem(row)) bills.push({ title: row.sec, rows: [] });
    else bills.at(-1)?.rows.push(row);
  }
  return bills;
}

export function groupBom(rows: readonly BomRow[]): { title: string; rows: BomItemRow[] }[] {
  const sections: { title: string; rows: BomItemRow[] }[] = [];
  for (const row of rows) {
    if (!isBomItem(row)) sections.push({ title: row.sec, rows: [] });
    else sections.at(-1)?.rows.push(row);
  }
  return sections;
}

export function barLevelName(bar: Bar, levels: readonly { name?: string }[]): string {
  if (bar.lvl === -1) return "Foundations";
  return levels[bar.lvl]?.name ?? `Level ${bar.lvl + 1}`;
}

export function filterBars(
  bars: readonly Bar[],
  levels: readonly { name?: string }[],
  element: string,
  levelName: string,
): Bar[] {
  return bars.filter((bar) => {
    if (element && bar.el !== element) return false;
    if (levelName && barLevelName(bar, levels) !== levelName) return false;
    return true;
  });
}

export function coverFields(doc: DocMap | null, meta?: ProjectRecord | null) {
  const project = asRecord(doc?.project);
  const stakeholders = asList(project.stakeholders).map((row) => asRecord(row));
  return {
    name: stringOf(project.name, meta?.name ?? "Untitled project"),
    location: stringOf(project.location, meta?.location ?? ""),
    desc: stringOf(project.desc, meta?.description ?? ""),
    ref: stringOf(project.ref, meta?.reference ?? "PRJ-001"),
    rev: stringOf(project.rev, meta?.revision ?? "A"),
    date: stringOf(project.date),
    by: stringOf(project.by),
    client: stringOf(project.client),
    drawing: stringOf(project.drawing, meta?.drawings ?? ""),
    image: stringOf(project.image),
    coverImageKey: meta?.coverImageKey ?? null,
    contract: stringOf(project.contract),
    currency: currencyOf(doc, meta),
    stage: stageOf(doc, meta),
    btype: btypeOf(doc, meta),
    typeLabel: typeLabel(btypeOf(doc, meta)),
    basis: measurementBasis(doc, meta),
    stakeholders: stakeholders.filter((row) => stringOf(row.org) || stringOf(row.contact)),
  };
}
