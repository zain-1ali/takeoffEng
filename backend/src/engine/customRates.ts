import { n, type NumericInput } from "@takeoff/engine";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function recipeLinesFrom(value: unknown): Array<{ resourceCode: string; quantity: number; note: string }> {
  return asList(value).map((entry) => {
    const line = asRecord(entry);
    return {
      resourceCode: String(line.resourceCode ?? line.r ?? ""),
      quantity: n((line.quantity ?? line.q ?? 0) as NumericInput),
      note: String(line.note ?? ""),
    };
  }).filter((line) => line.resourceCode);
}

export function customRatesFromState(stateJson: Record<string, unknown>): Record<string, { lines: ReturnType<typeof recipeLinesFrom> }> {
  const custom = asRecord(asRecord(stateJson.ra).custom);
  return Object.fromEntries(
    Object.entries(custom).map(([code, value]) => [
      code,
      { lines: recipeLinesFrom(asRecord(value).lines ?? value) },
    ]),
  );
}
