import { Schema, type InferSchemaType } from "mongoose";
import {
  BILLING_CYCLES,
  CHECKOUT_STATUSES,
  EXPORT_KINDS,
  INVOICE_STATUSES,
  JOB_STATUSES,
  MANUAL_RATE_KINDS,
  PLAN_IDS,
  PROVIDERS,
  RESOURCE_CATEGORIES,
  SUB_STATUSES,
} from "./enums.js";
import { getModel, registerVirtualId, schemaOptions, stringId } from "./schema.js";

const resourceSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, index: true },
      code: { type: String, required: true },
      category: { type: String, required: true, enum: RESOURCE_CATEGORIES },
      name: { type: String, required: true },
      unit: { type: String, required: true },
      rate: { type: String, required: true },
      rateValue: { type: Number, required: true },
      currency: { type: String, required: true },
      note: { type: String, default: null },
      updatedById: { type: String, default: null },
    },
    schemaOptions,
  ),
);
resourceSchema.index({ orgId: 1, code: 1 }, { unique: true });
resourceSchema.index({ orgId: 1, category: 1 });

export type ResourceDoc = InferSchemaType<typeof resourceSchema> & { id: string };
export const Resource = getModel("Resource", resourceSchema);

const customRateSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      projectId: { type: String, required: true },
      itemCode: { type: String, required: true },
      lines: { type: Schema.Types.Mixed, required: true },
      updatedById: { type: String, required: true },
    },
    schemaOptions,
  ),
);
customRateSchema.index({ projectId: 1, itemCode: 1 }, { unique: true });

export type CustomRateDoc = InferSchemaType<typeof customRateSchema> & { id: string };
export const CustomRate = getModel("CustomRate", customRateSchema);

const manualRateSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      projectId: { type: String, required: true },
      itemCode: { type: String, required: true },
      kind: { type: String, default: "BOQ", enum: MANUAL_RATE_KINDS },
      rate: { type: String, required: true },
      rateValue: { type: Number, required: true },
      updatedById: { type: String, required: true },
    },
    schemaOptions,
  ),
);
manualRateSchema.index({ projectId: 1, itemCode: 1, kind: 1 }, { unique: true });

export type ManualRateDoc = InferSchemaType<typeof manualRateSchema> & { id: string };
export const ManualRate = getModel("ManualRate", manualRateSchema);

const rateSettingsSchema = registerVirtualId(
  new Schema(
    {
      _id: { type: String, required: true },
      toolsPct: { type: Number, default: 3 },
      overheadPct: { type: Number, default: 10 },
      profitPct: { type: Number, default: 10 },
      version: { type: Number, default: 1 },
    },
    schemaOptions,
  ),
);

export type RateSettingsDoc = InferSchemaType<typeof rateSettingsSchema> & { id: string };
export const RateSettings = getModel("RateSettings", rateSettingsSchema);

const subscriptionSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, unique: true },
      plan: { type: String, default: "STARTER", enum: PLAN_IDS },
      cycle: { type: String, default: "MONTHLY", enum: BILLING_CYCLES },
      seats: { type: Number, default: 1 },
      status: { type: String, default: "ACTIVE", enum: SUB_STATUSES },
      provider: { type: String, default: null, enum: PROVIDERS },
      providerCustomerEnc: { type: String, default: null },
      providerSubscriptionId: { type: String, default: null },
      currentPeriodStart: { type: Date, default: null },
      currentPeriodEnd: { type: Date, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false },
      pendingPlan: { type: String, default: null, enum: PLAN_IDS },
      pendingSeats: { type: Number, default: null },
      dunningStep: { type: Number, default: 0 },
    },
    schemaOptions,
  ),
);

export type SubscriptionDoc = InferSchemaType<typeof subscriptionSchema> & { id: string };
export const Subscription = getModel("Subscription", subscriptionSchema);

const checkoutSessionSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, index: true },
      provider: { type: String, required: true, enum: PROVIDERS },
      reference: { type: String, required: true, unique: true },
      plan: { type: String, required: true, enum: PLAN_IDS },
      cycle: { type: String, required: true, enum: BILLING_CYCLES },
      seats: { type: Number, required: true },
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
      phone: { type: String, default: null },
      network: { type: String, default: null },
      status: { type: String, default: "PENDING", enum: CHECKOUT_STATUSES },
      createdById: { type: String, required: true },
      completedAt: { type: Date, default: null },
    },
    schemaOptions,
  ),
);
checkoutSessionSchema.index({ orgId: 1, createdAt: -1 });

export type CheckoutSessionDoc = InferSchemaType<typeof checkoutSessionSchema> & { id: string };
export const CheckoutSession = getModel("CheckoutSession", checkoutSessionSchema);

const invoiceSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, index: true },
      provider: { type: String, required: true, enum: PROVIDERS },
      providerInvoiceId: { type: String, default: null },
      number: { type: String, required: true, unique: true },
      amount: { type: Number, required: true },
      tax: { type: Number, default: 0 },
      currency: { type: String, required: true },
      status: { type: String, default: "OPEN", enum: INVOICE_STATUSES },
      pdfKey: { type: String, default: null },
      issuedAt: { type: Date, required: true },
      dueAt: { type: Date, default: null },
      paidAt: { type: Date, default: null },
    },
    schemaOptions,
  ),
);
invoiceSchema.index({ orgId: 1, issuedAt: -1 });

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema> & { id: string };
export const Invoice = getModel("Invoice", invoiceSchema);

const paymentEventSchema = new Schema(
  {
    _id: { type: String, required: true },
    provider: { type: String, required: true, enum: PROVIDERS },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { versionKey: false },
);

export type PaymentEventDoc = InferSchemaType<typeof paymentEventSchema>;
export const PaymentEvent = getModel("PaymentEvent", paymentEventSchema);

const outboxSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      topic: { type: String, required: true },
      room: { type: String, required: true },
      payload: { type: Schema.Types.Mixed, required: true },
      publishedAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
outboxSchema.index({ publishedAt: 1, createdAt: 1 });

export type OutboxDoc = InferSchemaType<typeof outboxSchema> & { id: string };
export const Outbox = getModel("Outbox", outboxSchema);

const auditLogSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, default: null, index: true },
      actorId: { type: String, default: null },
      action: { type: String, required: true },
      target: { type: String, default: null },
      ip: { type: String, default: null },
      data: { type: Schema.Types.Mixed, default: null },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
auditLogSchema.index({ orgId: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema> & { id: string };
export const AuditLog = getModel("AuditLog", auditLogSchema);

const exportJobSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, index: true },
      projectId: { type: String, required: true, index: true },
      kind: { type: String, required: true, enum: EXPORT_KINDS },
      status: { type: String, required: true, enum: JOB_STATUSES, default: "QUEUED" },
      progress: { type: Number, default: 0 },
      fileKey: { type: String, default: null },
      fileName: { type: String, default: null },
      contentType: { type: String, default: null },
      error: { type: String, default: null },
      watermark: { type: Boolean, default: false },
      requestedById: { type: String, required: true },
      finishedAt: { type: Date, default: null },
    },
    schemaOptions,
  ),
);
exportJobSchema.index({ orgId: 1, createdAt: -1 });

export type ExportJobDoc = InferSchemaType<typeof exportJobSchema> & { id: string };
export const ExportJob = getModel("ExportJob", exportJobSchema);

const featureFlagSchema = new Schema(
  {
    _id: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    orgIds: { type: [String], default: [] },
  },
  schemaOptions,
);

export type FeatureFlagDoc = InferSchemaType<typeof featureFlagSchema>;
export const FeatureFlag = getModel("FeatureFlag", featureFlagSchema);
