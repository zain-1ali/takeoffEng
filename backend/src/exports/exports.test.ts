import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import ExcelJS from "exceljs";
import { createCompleteBuildingExample } from "@takeoff/engine";
import { createApp } from "../app.js";
import { resetEnv } from "../config/env.js";
import { connectDb, disconnectDb } from "../db/connect.js";
import { waitForExportIdle } from "./jobs.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const SHEETS = [
  "Project",
  "Inputs",
  "Roofing",
  "Bar Schedule",
  "Dim Sheet",
  "BOQ",
  "Summary",
  "Bill of Materials",
  "Steel by Diameter",
  "Resources",
  "Rate Analysis",
];

const app = createApp();

describe("Phase 12 exports and cover image", () => {
  let memory: MongoMemoryServer | undefined;
  let tmp = "";

  beforeAll(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "takeoff-files-"));
    process.env.FILE_ROOT = tmp;
    delete process.env.RAILWAY_BUCKET;
    delete process.env.RAILWAY_ACCESS_KEY_ID;
    delete process.env.RAILWAY_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    resetEnv();
    try {
      await connectDb("mongodb://127.0.0.1:27017/takeoff_studio_export_test");
      await mongoose.connection.db?.admin().command({ ping: 1 });
    } catch {
      await disconnectDb();
      memory = await MongoMemoryServer.create();
      await connectDb(memory.getUri());
    }
    await mongoose.connection.dropDatabase();
  }, 180_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDb();
    await memory?.stop();
    if (tmp) await rm(tmp, { recursive: true, force: true });
  });

  it("builds a full workbook for the multi-storey example and stores a cover image", async () => {
    const { token, orgId, headers } = await signup("phase12@example.com");

    const created = await request(app)
      .post("/v1/projects")
      .set(headers)
      .send({ buildingType: "MULTI", name: "Multi-storey example" });
    expect(created.status).toBe(201);
    const projectId = created.body.id as string;

    const document = await request(app).get(`/v1/projects/${projectId}/document`).set(headers);
    expect(document.status).toBe(200);
    const example = JSON.parse(JSON.stringify(createCompleteBuildingExample())) as Record<string, unknown>;
    const saved = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set(headers)
      .set("If-Match", `"${document.body.version}"`)
      .send({ stateJson: example });
    expect(saved.status).toBe(200);

    const queued = await request(app)
      .post(`/v1/projects/${projectId}/exports`)
      .set(headers)
      .send({ kind: "FULL_XLSX" });
    expect(queued.status).toBe(202);
    expect(queued.body.status).toBe("QUEUED");
    await waitForExportIdle();

    const job = await request(app).get(`/v1/exports/${queued.body.id}`).set(headers);
    expect(job.status).toBe(200);
    expect(job.body.status).toBe("DONE");
    expect(job.body.fileName).toMatch(/\.xlsx$/);

    const file = await request(app)
      .get(`/v1/exports/${queued.body.id}/file`)
      .set(headers)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toMatch(/spreadsheetml/);
    expect(Buffer.isBuffer(file.body)).toBe(true);
    expect((file.body as Buffer).length).toBeGreaterThan(1000);

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file.body as Buffer);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(SHEETS);

    const uploaded = await request(app)
      .post(`/v1/projects/${projectId}/cover`)
      .set(headers)
      .set("Content-Type", "image/png")
      .send(PNG);
    expect(uploaded.status).toBe(200);
    expect(uploaded.body.coverImageKey).toMatch(/cover\.png$/);

    const image = await request(app).get(`/v1/projects/${projectId}/cover`).set(headers);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toMatch(/png/);
    expect(Buffer.from(image.body).length).toBeGreaterThan(20);

    const viaQuery = await request(app).get(
      `/v1/projects/${projectId}/cover?access_token=${token}&org_id=${orgId}`,
    );
    expect(viaQuery.status).toBe(200);
    expect(viaQuery.headers["content-type"]).toMatch(/png/);
  }, 180_000);

  async function signup(email: string) {
    const agent = request.agent(app);
    const signedUp = await agent.post("/v1/auth/signup").send({
      email,
      password: "password1",
      name: "Phase Twelve",
      orgName: "Phase Twelve QS",
    });
    const token = signedUp.body.accessToken as string;
    const me = await agent.get("/v1/me").set("Authorization", `Bearer ${token}`);
    const orgId = me.body.org.id as string;
    return {
      token,
      orgId,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Org-Id": orgId,
      },
    };
  }
});
