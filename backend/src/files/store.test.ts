import { afterEach, describe, expect, it } from "vitest";
import { resetEnv } from "../config/env.js";
import { objectStore } from "./store.js";

describe("object store config", () => {
  afterEach(() => {
    delete process.env.RAILWAY_BUCKET;
    delete process.env.RAILWAY_ENDPOINT;
    delete process.env.RAILWAY_ACCESS_KEY_ID;
    delete process.env.RAILWAY_SECRET_ACCESS_KEY;
    delete process.env.RAILWAY_REGION;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    resetEnv();
  });

  it("uses Railway bucket variables when they are set", () => {
    process.env.RAILWAY_BUCKET = "takeoff-files";
    process.env.RAILWAY_ENDPOINT = "https://storage.railway.app";
    process.env.RAILWAY_ACCESS_KEY_ID = "key-id";
    process.env.RAILWAY_SECRET_ACCESS_KEY = "secret";
    resetEnv();
    expect(objectStore()).toMatchObject({
      bucket: "takeoff-files",
      endpoint: "https://storage.railway.app",
      accessKeyId: "key-id",
    });
  });

  it("stays on local disk when no bucket credentials exist", () => {
    resetEnv();
    expect(objectStore()).toBeNull();
  });
});
