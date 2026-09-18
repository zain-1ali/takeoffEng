import { n, type ResourceCategory as EngineCategory } from "@takeoff/engine";
import { RESOURCE_CATEGORIES, type ResourceCategory } from "../models/enums.js";

export const ENGINE_CATEGORY: Record<ResourceCategory, EngineCategory> = {
  LABOUR: "Labour",
  MATERIAL: "Material",
  PLANT: "Plant",
  SUBCONTRACT: "Subcontract",
};

const MONGO_CATEGORY: Record<string, ResourceCategory> = {
  LABOUR: "LABOUR",
  MATERIAL: "MATERIAL",
  PLANT: "PLANT",
  SUBCONTRACT: "SUBCONTRACT",
  Labour: "LABOUR",
  Material: "MATERIAL",
  Plant: "PLANT",
  Subcontract: "SUBCONTRACT",
};

export function parseCategory(value: string | undefined, fallback: ResourceCategory = "MATERIAL"): ResourceCategory {
  const key = (value ?? "").trim();
  if (!key) return fallback;
  const upper = key.toUpperCase().replace(/\s+/g, "");
  if (upper === "LABOUR" || upper === "LABOR") return "LABOUR";
  if (upper === "MATERIAL") return "MATERIAL";
  if (upper === "PLANT") return "PLANT";
  if (upper === "SUBCONTRACT") return "SUBCONTRACT";
  return MONGO_CATEGORY[key] ?? fallback;
}

export function isResourceCategory(value: string): value is ResourceCategory {
  return (RESOURCE_CATEGORIES as readonly string[]).includes(value);
}

export function serializeResource(row: {
  _id?: string;
  id?: string;
  code: string;
  category: string;
  name: string;
  unit: string;
  rate: string;
  rateValue: number;
  currency: string;
  note?: string | null;
}) {
  return {
    id: String(row.id ?? row._id ?? ""),
    code: row.code,
    category: row.category,
    name: row.name,
    unit: row.unit,
    rate: row.rate,
    rateValue: row.rateValue,
    currency: row.currency,
    note: row.note ?? "",
  };
}

export function rateFields(raw: string | number): { rate: string; rateValue: number } {
  const rate = String(raw ?? "").trim();
  const rateValue = n(rate === "" ? 0 : rate);
  return {
    rate: rate || String(rateValue),
    rateValue: Number.isFinite(rateValue) ? rateValue : 0,
  };
}
