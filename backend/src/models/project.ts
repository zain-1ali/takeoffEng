import { Schema, type InferSchemaType } from "mongoose";
import {
  BUILDING_TYPES,
  ROOF_MODES,
  STAGES,
} from "./enums.js";
import { getModel, registerVirtualId, schemaOptions, stringId } from "./schema.js";

const projectSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      orgId: { type: String, required: true, index: true },
      name: { type: String, required: true },
      buildingType: { type: String, required: true, enum: BUILDING_TYPES },
      stage: { type: String, default: "PRE_TENDER", enum: STAGES },
      reference: { type: String, default: null },
      revision: { type: String, default: null },
      description: { type: String, default: null },
      location: { type: String, default: null },
      drawings: { type: String, default: null },
      contract: { type: String, default: null },
      startDate: { type: String, default: null },
      duration: { type: String, default: null },
      measurementBasis: { type: String, default: null },
      currency: { type: String, required: true },
      currencyCustom: { type: String, default: null },
      numberLocale: { type: String, required: true },
      taxName: { type: String, default: "VAT" },
      taxRate: { type: Number, default: 0 },
      contingencyRate: { type: Number, default: 5 },
      roofMode: { type: String, default: "SIMPLE", enum: ROOF_MODES },
      databankCurrency: { type: String, default: "USD" },
      fxRate: { type: Number, default: 1 },
      coverImageKey: { type: String, default: null },
      stakeholders: { type: Schema.Types.Mixed, default: [] },
      params: { type: Schema.Types.Mixed, default: [] },
      summary: { type: Schema.Types.Mixed, default: null },
      createdById: { type: String, required: true },
      archivedAt: { type: Date, default: null },
    },
    schemaOptions,
  ),
);
projectSchema.index({ orgId: 1, updatedAt: -1 });
projectSchema.index({ orgId: 1, buildingType: 1, stage: 1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema> & { id: string };
export const Project = getModel("Project", projectSchema);

const projectDocumentSchema = registerVirtualId(
  new Schema(
    {
      _id: { type: String, required: true },
      yState: { type: Buffer, default: Buffer.alloc(0) },
      stateJson: { type: Schema.Types.Mixed, required: true },
      version: { type: Number, default: 1 },
      updatedById: { type: String, default: null },
    },
    schemaOptions,
  ),
);

export type ProjectDocumentDoc = InferSchemaType<typeof projectDocumentSchema> & { id: string };
export const ProjectDocument = getModel("ProjectDocument", projectDocumentSchema);

const projectVersionSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      projectId: { type: String, required: true, index: true },
      number: { type: Number, required: true },
      name: { type: String, default: null },
      note: { type: String, default: null },
      auto: { type: Boolean, default: false },
      stateJson: { type: Schema.Types.Mixed, required: true },
      summary: { type: Schema.Types.Mixed, required: true },
      createdById: { type: String, required: true },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
projectVersionSchema.index({ projectId: 1, number: 1 }, { unique: true });
projectVersionSchema.index({ projectId: 1, createdAt: -1 });

export type ProjectVersionDoc = InferSchemaType<typeof projectVersionSchema> & { id: string };
export const ProjectVersion = getModel("ProjectVersion", projectVersionSchema);
