import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/index.js";

export async function connectDb(uri = env().MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await ensureSparseGoogleIdIndex();
  return mongoose;
}

async function ensureSparseGoogleIdIndex(): Promise<void> {
  try {
    const indexes = await User.collection.indexes();
    const google = indexes.find((index) => index.name === "googleId_1");
    if (google && !google.sparse) {
      await User.collection.dropIndex("googleId_1");
    }
    await User.syncIndexes();
  } catch {
    /* collection may not exist yet */
  }
}

export async function disconnectDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function mongoStatus(): "connected" | "connecting" | "disconnected" | "disconnecting" {
  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}
