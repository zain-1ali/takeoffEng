import { catalogue, type CatalogueEntry, type ComputeResult, type FullProject, type MeasuredItem } from "@takeoff/engine";
import { asList, asRecord, type DocMap } from "../../lib/doc.js";
import { formatNumber } from "../../lib/format.js";
import { FIN_QTY_KINDS, kindsVisible } from "./schema.js";

export const EL_OF: Record<string, string> = {
  pad: "Foundations",
  strip: "Foundations",
  gbeam: "Foundations",
  column: "Columns",
  beam: "Beams",
  slab: "Slabs",
  wall: "Walls",
  stair: "Stairs",
  bfoot: "Foundations",
  bpier: "Piers",
  bwall: "Abutments & walls",
  bbeam: "Deck",
  bslab: "Deck",
  rpave: "Pavement",
  rdrain: "Drainage",
  rculv: "Culverts",
  roof: "Roofing",
};

export const CONC = new Set([
  "CPAD", "CSTUB", "CSTRIP", "CGB", "CSOG", "CCOL", "CBEAM", "CSLAB", "CWALL", "CSTAIR",
  "CBFT", "CPIER", "CABW", "CWING", "CBALL", "CPARA", "CGIRD", "CXHEAD", "CDIAPH", "CDECK",
  "CAPPR", "CDRN", "CBED", "CHW", "CAPR",
]);

const FIN_RE: Record<string, RegExp> = {
  masonry: /^(MAS|BFORCE$|DPC\d|CLINT$|FLINT$)/,
  wfin: /^(PLI|PLE|SKIM|PNTI|PNTX|WTILE_|CLAD_)/,
  ffin: /^(SCR\d|FF_|SK_|PFLOAT$)/,
  cfin: /^(CPL\d|CPNT|CSUS_)/,
};

export function usesCatalogQty(kind: string): boolean {
  return kind.startsWith("r") || FIN_QTY_KINDS.has(kind);
}

export function kindItems(result: ComputeResult | null, kind: string): MeasuredItem[] {
  if (!result) return [];
  const re = FIN_RE[kind];
  if (re) return result.items.filter((item) => re.test(item.code));
  if (kind === "rpave") {
    return result.items.filter((item) => item.el === "Pavement" || item.el === "Earthworks");
  }
  const el = EL_OF[kind];
  return el ? result.items.filter((item) => item.el === el) : [];
}

export function kindConcrete(items: MeasuredItem[]): number {
  return items.filter((item) => CONC.has(item.code)).reduce((sum, item) => sum + item.q, 0);
}

export function kindSteel(result: ComputeResult | null, kind: string): number {
  if (!result) return 0;
  const el = EL_OF[kind];
  return result.bars.filter((bar) => bar.el === el).reduce((sum, bar) => sum + bar.kg, 0);
}

export function kindFormwork(items: MeasuredItem[]): number {
  return items.filter((item) => /^F(?!STRIS|F_)/.test(item.code)).reduce((sum, item) => sum + item.q, 0);
}

export function excavation(result: ComputeResult | null): number {
  if (!result) return 0;
  return Object.entries(result.tot)
    .filter(([code]) => /^EXC/.test(code))
    .reduce((sum, [, qty]) => sum + qty, 0);
}

export function memberTypeCount(doc: DocMap): number {
  const types = asRecord(doc.types);
  return kindsVisible(String(doc.btype ?? "multi"))
    .reduce((sum, kind) => sum + asList(types[kind]).length, 0);
}

export function catalogLines(
  project: FullProject | null,
  items: MeasuredItem[],
): { label: string; value: string }[] {
  if (!project || !items.length) return [];
  const cat = Object.fromEntries(catalogue(project).map((entry: CatalogueEntry) => [entry.code, entry]));
  const qty: Record<string, number> = {};
  for (const item of items) qty[item.code] = (qty[item.code] ?? 0) + item.q;
  return Object.entries(qty)
    .filter(([code]) => cat[code] && !/^R[A-Z]+\d+$/.test(code))
    .map(([code, amount]) => {
      const entry = cat[code]!;
      const shown = entry.unit === "t" ? amount / 1000 : amount;
      const digits = entry.unit === "t" ? 3 : amount >= 100 ? 0 : 2;
      return {
        label: entry.desc.split(",")[0] ?? code,
        value: `${formatNumber(shown, digits)} ${entry.unit}`,
      };
    });
}

export function typeUseLabel(
  kind: string,
  stats: { kg?: number; uses?: number } | undefined,
): string {
  if (stats?.kg && !FIN_QTY_KINDS.has(kind)) return `${formatNumber(stats.kg, 0)} kg`;
  if (stats?.uses) return `${stats.uses} in use`;
  return "not used";
}
