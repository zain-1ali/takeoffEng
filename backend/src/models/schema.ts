import mongoose, { Schema, type Model } from "mongoose";
import { newId } from "../common/ids.js";

export const schemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    },
  },
} as const;

export function stringId(defaultId: () => string = newId) {
  return { type: String, required: true, default: defaultId };
}

export function registerVirtualId<T>(schema: Schema<T>): Schema<T> {
  schema.virtual("id").get(function id(this: { _id: string }) {
    return this._id;
  });
  return schema;
}

export function getModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

