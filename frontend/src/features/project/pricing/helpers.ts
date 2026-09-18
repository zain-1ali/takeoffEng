import {
  n,
  type CustomRate,
  type NumericInput,
  type Resource,
  type ResourceCategory,
} from "@takeoff/engine";
import { asRecord, type DocMap } from "../../../lib/doc.js";

export const RATE_CATEGORIES = ["Labour", "Material", "Plant", "Subcontract"] as const;

export const ENGINE_CAT: Record<string, ResourceCategory> = {
  LABOUR: "Labour",
  MATERIAL: "Material",
  PLANT: "Plant",
  SUBCONTRACT: "Subcontract",
  Labour: "Labour",
  Material: "Material",
  Plant: "Plant",
  Subcontract: "Subcontract",
};

export const MONGO_CAT: Record<ResourceCategory, string> = {
  Labour: "LABOUR",
  Material: "MATERIAL",
  Plant: "PLANT",
  Subcontract: "SUBCONTRACT",
};

export const CAT_COLOR: Record<string, string> = {
  Labour: "var(--core)",
  Material: "var(--steel)",
  Plant: "var(--hivis)",
  Subcontract: "var(--ok)",
};

export interface RaSettings {
  tools: NumericInput;
  oh: NumericInput;
  profit: NumericInput;
  cur: string;
  fx: NumericInput;
  market: string;
  custom: Record<string, { lines: RaLine[] }>;
}

export interface RaLine {
  resourceCode: string;
  quantity: NumericInput;
  note: string;
}

export function raOf(doc: DocMap | null): RaSettings {
  const ra = asRecord(doc?.ra);
  return {
    tools: (ra.tools as NumericInput) ?? 3,
    oh: (ra.oh as NumericInput) ?? 10,
    profit: (ra.profit as NumericInput) ?? 10,
    cur: String(ra.cur ?? ""),
    fx: (ra.fx as NumericInput) ?? 1,
    market: String(ra.market ?? ""),
    custom: asRecord(ra.custom) as RaSettings["custom"],
  };
}

export function parseCustomRates(value: unknown): Record<string, CustomRate> {
  const custom = asRecord(asRecord(value).custom);
  const out: Record<string, CustomRate> = {};
  for (const [code, recipe] of Object.entries(custom)) {
    const record = asRecord(recipe);
    const lines = Array.isArray(record.lines) ? record.lines : Array.isArray(recipe) ? recipe : [];
    out[code] = {
      lines: lines.map((line) => {
        const entry = asRecord(line);
        return {
          resourceCode: String(entry.resourceCode ?? entry.r ?? ""),
          quantity: n((entry.quantity ?? entry.q ?? 0) as NumericInput),
          note: String(entry.note ?? ""),
        };
      }).filter((line) => line.resourceCode),
    };
  }
  return out;
}

export function cloneLines(lines: readonly { resourceCode: string; quantity: NumericInput; note: string }[]): RaLine[] {
  return lines.map((line) => ({
    resourceCode: line.resourceCode,
    quantity: line.quantity,
    note: line.note,
  }));
}

export function toEngineResource(row: {
  code: string;
  category: string;
  name: string;
  unit: string;
  rate: string | number;
  rateValue?: number;
  note?: string | null;
}): Resource {
  const parsed = n(row.rate as NumericInput);
  return {
    code: row.code,
    category: ENGINE_CAT[row.category] ?? "Material",
    name: row.name,
    unit: row.unit,
    rate: Number.isFinite(parsed) ? parsed : Number(row.rateValue) || 0,
    note: row.note ?? "",
  };
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((value) => value.trim()));
}

export function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function nextResourceCode(codes: Iterable<string>, category: ResourceCategory): string {
  const prefix = category === "Subcontract" ? "S" : category.charAt(0);
  const used = new Set(codes);
  let index = 1;
  while (used.has(`${prefix}${String(index).padStart(2, "0")}`)) index += 1;
  return `${prefix}${String(index).padStart(2, "0")}`;
}
