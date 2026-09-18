import { problem } from "../common/problem.js";

const FORMULA = /^[0-9\s.,+\-*/x×÷()%^]{1,240}$/;

const SKIP_KEYS = new Set([
  "id", "mark", "name", "ref", "type", "level", "pid", "tid", "code",
  "cat", "desc", "cable", "conduit", "item", "spec", "unit", "pos",
  "room", "cf", "f1", "f2", "side", "base", "fin", "tile", "skm",
  "kind", "form", "cover", "struct", "ins", "shape", "on", "roof",
  "mat", "mortar", "fx", "size", "part", "mesh", "member", "currency",
  "numfmt", "btype", "roofMode", "topMode", "locale", "blind", "found",
  "frame", "civil", "bridge", "replaces", "note", "label", "value",
  "role", "org", "contact", "client", "drawing", "by", "date", "standard",
  "contract", "start", "duration", "desc", "image", "stage", "curCustom",
  "r", "resourceCode", "category", "market", "cur", "family", "notes",
]);

export function assertNumericFormulas(value: unknown, path = "stateJson"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNumericFormulas(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SKIP_KEYS.has(key)) continue;
      assertNumericFormulas(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw problem(422, "invalid_formula", "Invalid formula", "Numeric value is not finite.", { path });
    }
    return;
  }
  if (typeof value !== "string") return;
  if (value === "") return;
  if (FORMULA.test(value)) return;
  throw problem(
    422,
    "invalid_formula",
    "Invalid formula",
    "Numeric fields may be a number or a formula such as 20*15+4*2.5.",
    { path },
  );
}
