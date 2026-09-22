import { allDefaultResources } from "@takeoff/engine";
import type { ResourceCategory as EngineCategory } from "@takeoff/engine";
import { Organization, Resource, type ResourceCategory } from "../models/index.js";

const CATEGORY: Record<EngineCategory, ResourceCategory> = {
  Labour: "LABOUR",
  Material: "MATERIAL",
  Plant: "PLANT",
  Subcontract: "SUBCONTRACT",
};

export async function seedOrgDatabank(
  orgId: string,
  options: { currency?: string; replace?: boolean } = {},
): Promise<number> {
  const org = await Organization.findById(orgId).lean();
  const currency = options.currency ?? org?.databankCurrency ?? "USD";
  if (options.replace) {
    await Resource.deleteMany({ orgId });
  }
  const existing = new Set(
    (await Resource.find({ orgId }).select("code").lean()).map((row) => row.code),
  );
  const docs = allDefaultResources()
    .filter((resource) => !existing.has(resource.code))
    .map((resource) => ({
      orgId,
      code: resource.code,
      category: CATEGORY[resource.category],
      name: resource.name,
      unit: resource.unit,
      rate: "0",
      rateValue: 0,
      currency,
      note: resource.note || null,
    }));
  if (docs.length) await Resource.insertMany(docs);
  await zeroStarterDatabankRates(orgId);
  if (options.replace) {
    await Organization.updateOne({ _id: orgId }, { $inc: { databankVersion: 1 } });
  }
  return docs.length;
}

/** Clear catalog starter prices that the user has not replaced with their own rates. */
export async function zeroStarterDatabankRates(orgId: string): Promise<number> {
  const priced = await Resource.find({ orgId, rateValue: { $gt: 0 } }).select("code rateValue").lean();
  if (!priced.length) return 0;
  const defaults = new Map(allDefaultResources().map((row) => [row.code, row.rate]));
  const ids = priced
    .filter((row) => defaults.get(row.code) === row.rateValue)
    .map((row) => row._id);
  if (!ids.length) return 0;
  const result = await Resource.updateMany({ _id: { $in: ids } }, { $set: { rate: "0", rateValue: 0 } });
  return result.modifiedCount;
}
