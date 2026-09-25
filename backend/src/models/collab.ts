import { Schema, type InferSchemaType } from "mongoose";
import { ANCHOR_TYPES, TASK_STATUSES } from "./enums.js";
import { getModel, registerVirtualId, schemaOptions, stringId } from "./schema.js";

const commentSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      projectId: { type: String, required: true, index: true },
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
      projectId: { type: String, required: true, index: true },
      title: { type: String, required: true },
      description: { type: String, default: null },
      status: { type: String, required: true, enum: TASK_STATUSES, default: "TODO" },
      assigneeId: { type: String, default: null },
      dueDate: { type: String, default: null },
      anchorType: { type: String, default: null },
      anchorId: { type: String, default: null },
      position: { type: Number, default: 0 },
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
      text: { type: String, required: true },
      data: { type: Schema.Types.Mixed, default: null },
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
      projectId: { type: String, default: null },
      kind: { type: String, required: true },
      text: { type: String, required: true },
      data: { type: Schema.Types.Mixed, default: null },
      readAt: { type: Date, default: null },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema> & { id: string };
export const Notification = getModel("Notification", notificationSchema);
