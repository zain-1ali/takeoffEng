import { Schema, type InferSchemaType } from "mongoose";
import { MEMBERSHIP_ROLES } from "./enums.js";
import { getModel, registerVirtualId, schemaOptions, stringId } from "./schema.js";

const organizationSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      name: { type: String, required: true },
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
      logoKey: { type: String, default: null },
      defaultCurrency: { type: String, default: "USD" },
      numberLocale: { type: String, default: "en-GB" },
      taxName: { type: String, default: "VAT" },
      taxRate: { type: Number, default: 0 },
      measurementStandard: { type: String, default: null },
      region: { type: String, default: "default" },
      ssoConfig: { type: Schema.Types.Mixed, default: null },
      databankCurrency: { type: String, default: "USD" },
      databankVersion: { type: Number, default: 1 },
      priceBasis: {
        type: String,
        default: "Indicative starter prices – replace with your local rates",
      },
    },
    schemaOptions,
  ),
);

export type OrganizationDoc = InferSchemaType<typeof organizationSchema> & { id: string };
export const Organization = getModel("Organization", organizationSchema);

const membershipSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, index: true },
      userId: { type: String, required: true, index: true },
      role: { type: String, required: true, enum: MEMBERSHIP_ROLES },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
membershipSchema.index({ orgId: 1, userId: 1 }, { unique: true });

export type MembershipDoc = InferSchemaType<typeof membershipSchema> & { id: string };
export const Membership = getModel("Membership", membershipSchema);

const invitationSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, index: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      role: { type: String, required: true, enum: MEMBERSHIP_ROLES },
      tokenHash: { type: String, required: true, unique: true },
      invitedById: { type: String, required: true },
      expiresAt: { type: Date, required: true },
      acceptedAt: { type: Date, default: null },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);

export type InvitationDoc = InferSchemaType<typeof invitationSchema> & { id: string };
export const Invitation = getModel("Invitation", invitationSchema);
