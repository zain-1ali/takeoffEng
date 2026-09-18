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
      rate: String(resource.rate),
      rateValue: resource.rate,
      currency,
      note: resource.note || null,
    }));
  if (docs.length) await Resource.insertMany(docs);
  if (options.replace) {
    await Organization.updateOne({ _id: orgId }, { $inc: { databankVersion: 1 } });
  }
  return docs.length;
}
