import { n, type NumericInput } from "@takeoff/engine";
import { CustomRate, ManualRate, RateSettings } from "../models/index.js";
import { customRatesFromState, recipeLinesFrom } from "../engine/customRates.js";

export { customRatesFromState, recipeLinesFrom };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberMap(value: unknown): Record<string, { rate: string; rateValue: number }> {
  const source = asRecord(value);
  const out: Record<string, { rate: string; rateValue: number }> = {};
  for (const [code, raw] of Object.entries(source)) {
    if (raw == null || raw === "") continue;
    const rate = String(raw);
    const rateValue = n(rate as NumericInput);
    if (Number.isFinite(rateValue)) out[code] = { rate, rateValue };
  }
  return out;
}

export async function syncRatesFromState(
  projectId: string,
  userId: string,
  stateJson: Record<string, unknown>,
): Promise<void> {
  const ra = asRecord(stateJson.ra);
  if (Object.keys(ra).length) {
    const toolsPct = ra.tools == null || ra.tools === "" ? undefined : n(ra.tools as NumericInput);
    const overheadPct = ra.oh == null || ra.oh === "" ? undefined : n(ra.oh as NumericInput);
    const profitPct = ra.profit == null || ra.profit === "" ? undefined : n(ra.profit as NumericInput);
    if (toolsPct != null || overheadPct != null || profitPct != null) {
      await RateSettings.findByIdAndUpdate(
        projectId,
        {
          $set: {
            ...(toolsPct != null ? { toolsPct } : {}),
            ...(overheadPct != null ? { overheadPct } : {}),
            ...(profitPct != null ? { profitPct } : {}),
          },
          $inc: { version: 1 },
          $setOnInsert: { _id: projectId },
        },
        { upsert: true },
      );
    }
    if ("custom" in ra) {
      const custom = customRatesFromState(stateJson);
      const codes = Object.keys(custom);
      await CustomRate.deleteMany({ projectId, itemCode: { $nin: codes } });
      for (const [itemCode, recipe] of Object.entries(custom)) {
        await CustomRate.findOneAndUpdate(
          { projectId, itemCode },
          { $set: { lines: recipe.lines, updatedById: userId } },
          { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
        );
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(stateJson, "rates")) {
    await syncManuals(projectId, userId, "BOQ", numberMap(stateJson.rates));
  }
  if (Object.prototype.hasOwnProperty.call(stateJson, "mrates")) {
    await syncManuals(projectId, userId, "BOM", numberMap(stateJson.mrates));
  }
}

async function syncManuals(
  projectId: string,
  userId: string,
  kind: "BOQ" | "BOM",
  rates: Record<string, { rate: string; rateValue: number }>,
): Promise<void> {
  const codes = Object.keys(rates);
  await ManualRate.deleteMany({ projectId, kind, itemCode: { $nin: codes } });
  for (const [itemCode, row] of Object.entries(rates)) {
    await ManualRate.findOneAndUpdate(
      { projectId, itemCode, kind },
      { $set: { rate: row.rate, rateValue: row.rateValue, updatedById: userId } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  }
}
