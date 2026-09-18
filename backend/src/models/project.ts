import { Schema, type InferSchemaType } from "mongoose";
import {
  ANCHOR_TYPES,
  BUILDING_TYPES,
  ROOF_MODES,
  STAGES,
  TASK_STATUSES,
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

const commentSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      projectId: { type: String, required: true },
      anchorType: { type: String, required: true, enum: ANCHOR_TYPES },
      anchorId: { type: String, required: true },
      parentId: { type: String, default: null },
      body: { type: String, required: true },
      mentions: { type: [String], default: [] },
      authorId: { type: String, required: true },
      resolvedAt: { type: Date, default: null },
      resolvedById: { type: String, default: null },
      deletedAt: { type: Date, default: null },
    },
    schemaOptions,
  ),
);
commentSchema.index({ projectId: 1, anchorType: 1, anchorId: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema> & { id: string };
export const Comment = getModel("Comment", commentSchema);

const taskSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      projectId: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String, default: null },
      status: { type: String, default: "TODO", enum: TASK_STATUSES },
      assigneeId: { type: String, default: null },
      dueDate: { type: Date, default: null },
      anchorType: { type: String, default: null, enum: ANCHOR_TYPES },
      anchorId: { type: String, default: null },
      position: { type: Number, required: true },
      createdById: { type: String, required: true },
    },
    schemaOptions,
  ),
);
taskSchema.index({ projectId: 1, status: 1, position: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema> & { id: string };
export const Task = getModel("Task", taskSchema);

const activitySchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      projectId: { type: String, required: true, index: true },
      actorId: { type: String, required: true },
      verb: { type: String, required: true },
      data: { type: Schema.Types.Mixed, default: {} },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
activitySchema.index({ projectId: 1, createdAt: -1 });

export type ActivityDoc = InferSchemaType<typeof activitySchema> & { id: string };
export const Activity = getModel("Activity", activitySchema);

const notificationSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      userId: { type: String, required: true, index: true },
      orgId: { type: String, required: true },
      kind: { type: String, required: true },
      data: { type: Schema.Types.Mixed, default: {} },
      readAt: { type: Date, default: null },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
notificationSchema.index({ userId: 1, readAt: 1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema> & { id: string };
export const Notification = getModel("Notification", notificationSchema);
