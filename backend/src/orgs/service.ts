import { seedOrgDatabank } from "../databank/seed.js";
import { Membership, Organization, Subscription } from "../models/index.js";
import { slugify } from "../common/slug.js";
import type { PlanId } from "../models/enums.js";

export async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 2;
  while (await Organization.exists({ slug })) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export async function createOrganization(params: {
  name: string;
  ownerId: string;
  plan?: PlanId;
  seats?: number;
  defaultCurrency?: string;
  numberLocale?: string;
}): Promise<{ org: InstanceType<typeof Organization>; membership: InstanceType<typeof Membership> }> {
  const org = await Organization.create({
    name: params.name,
    slug: await uniqueSlug(params.name),
    defaultCurrency: params.defaultCurrency ?? "USD",
    numberLocale: params.numberLocale ?? "en-GB",
    databankCurrency: params.defaultCurrency ?? "USD",
  });
  const membership = await Membership.create({
    orgId: org.id,
    userId: params.ownerId,
    role: "OWNER",
  });
  await Subscription.create({
    orgId: org.id,
    plan: params.plan ?? "STARTER",
    seats: params.seats ?? 1,
    status: "ACTIVE",
  });
  await seedOrgDatabank(org.id, { currency: org.databankCurrency });
  return { org, membership };
}
