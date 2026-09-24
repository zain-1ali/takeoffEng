import { Schema, type InferSchemaType } from "mongoose";
import { getModel, registerVirtualId, schemaOptions, stringId } from "./schema.js";

const userSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      googleId: { type: String, unique: true, sparse: true },
      passwordHash: { type: String, default: null, select: false },
      name: { type: String, default: null },
      avatarKey: { type: String, default: null },
      locale: { type: String, default: "en" },
      totpSecretEnc: { type: String, default: null, select: false },
      deletedAt: { type: Date, default: null },
    },
    schemaOptions,
  ),
);

export type UserDoc = InferSchemaType<typeof userSchema> & { id: string };
export const User = getModel("User", userSchema);

const sessionSchema = registerVirtualId(
  new Schema(
    {
      _id: stringId(),
      userId: { type: String, required: true, index: true },
      refreshHash: { type: String, required: true },
      userAgent: { type: String, default: null },
      ip: { type: String, default: null },
      expiresAt: { type: Date, required: true },
      revokedAt: { type: Date, default: null },
    },
    { ...schemaOptions, updatedAt: false },
  ),
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof sessionSchema> & { id: string };
export const Session = getModel("Session", sessionSchema);
