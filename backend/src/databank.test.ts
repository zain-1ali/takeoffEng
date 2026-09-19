import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "./app.js";
import { resetEnv } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { Subscription } from "./models/index.js";

const app = createApp();

describe("Phase 10 databank and rates", () => {
  let memory: MongoMemoryServer | undefined;

  beforeAll(async () => {
    resetEnv();
    try {
      await connectDb("mongodb://127.0.0.1:27017/takeoff_studio_test_p10");
      await mongoose.connection.db?.admin().command({ ping: 1 });
    } catch {
      await disconnectDb();
      memory = await MongoMemoryServer.create();
      await connectDb(memory.getUri());
    }
    await mongoose.connection.dropDatabase();
  }, 180_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    }
    await disconnectDb();
    await memory?.stop();
  });

  it("supports databank CRUD, CSV, adjust and convert", async () => {
    const { headers } = await signup("databank@example.com");

    const created = await request(app)
      .post("/v1/databank")
      .set(headers)
      .send({ name: "Site electrician", category: "Labour", unit: "h", rate: "12*1.1", note: "gang" });
    expect(created.status).toBe(201);
    expect(created.body.category).toBe("LABOUR");
    expect(created.body.rateValue).toBeCloseTo(13.2);

    const patched = await request(app)
      .patch(`/v1/databank/${created.body.id}`)
      .set(headers)
      .send({ rate: 20, name: "Electrician" });
    expect(patched.status).toBe(200);
    expect(patched.body.rateValue).toBe(20);
    expect(patched.body.name).toBe("Electrician");

    const listed = await request(app).get("/v1/databank?q=Electrician").set(headers);
    expect(listed.status).toBe(200);
    expect(listed.body.currency).toBe("USD");
    expect(listed.body.resources.some((row: { name: string }) => row.name === "Electrician")).toBe(true);

    const csv = await request(app).get("/v1/databank/export.csv").set(headers);
    expect(csv.status).toBe(200);
    expect(String(csv.headers["content-type"])).toMatch(/csv/);
    expect(csv.text).toContain("code,category,name,unit,rate,notes");

    const imported = await request(app)
      .post("/v1/databank/import")
      .set(headers)
      .send({ csv: "code,category,name,unit,rate,notes\nX01,Material,Imported widget,No.,7.5,test" });
    expect(imported.status).toBe(200);
    expect(imported.body.added).toBe(1);

    const adjusted = await request(app)
      .post("/v1/databank/adjust")
      .set(headers)
      .send({ category: "MATERIAL", percent: 10 });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.count).toBeGreaterThan(0);

    const widget = await request(app).get("/v1/databank?q=Imported").set(headers);
    const row = widget.body.resources.find((item: { code: string }) => item.code === "X01");
    expect(row.rateValue).toBeCloseTo(8.25);

    const converted = await request(app)
      .post("/v1/databank/convert")
      .set(headers)
      .send({ toCurrency: "KES", fxRate: 2 });
    expect(converted.status).toBe(200);
    expect(converted.body.currency).toBe("KES");

    const afterFx = await request(app).get("/v1/databank?q=Imported").set(headers);
    const convertedRow = afterFx.body.resources.find((item: { code: string }) => item.code === "X01");
    expect(afterFx.body.currency).toBe("KES");
    expect(convertedRow.rateValue).toBeCloseTo(16.5);

    const removed = await request(app).delete(`/v1/databank/${created.body.id}`).set(headers);
    expect(removed.status).toBe(204);
  }, 120_000);

  it("stores custom rates from the document and exposes rate settings", async () => {
    const { orgId, headers } = await signup("rates@example.com");
    await Subscription.updateOne({ orgId }, { plan: "PROFESSIONAL" });

    const created = await request(app)
      .post("/v1/projects")
      .set(headers)
      .send({ buildingType: "FOUNDATION", name: "Rate pad" });
    expect(created.status).toBe(201);
    const projectId = created.body.id as string;

    const document = await request(app).get(`/v1/projects/${projectId}/document`).set(headers);
    const stateJson = {
      ...document.body.stateJson,
      ra: {
        tools: 5,
        oh: 12,
        profit: 8,
        custom: { CPAD: { lines: [{ resourceCode: "L01", quantity: "2*0.5", note: "edited" }] } },
      },
      rates: { CPAD: 99 },
    };
    const saved = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set(headers)
      .set("If-Match", `"${document.body.version}"`)
      .send({ stateJson });
    expect(saved.status).toBe(200);

    const settings = await request(app).get(`/v1/projects/${projectId}/rate-settings`).set(headers);
    expect(settings.body.toolsPct).toBe(5);
    expect(settings.body.overheadPct).toBe(12);
    expect(settings.body.profitPct).toBe(8);

    const rates = await request(app).get(`/v1/projects/${projectId}/rates`).set(headers);
    expect(rates.body.custom.CPAD.lines[0].resourceCode).toBe("L01");
    expect(rates.body.manuals.some((row: { itemCode: string; rateValue: number }) => (
      row.itemCode === "CPAD" && row.rateValue === 99
    ))).toBe(true);
  }, 120_000);

  async function signup(email: string) {
    const agent = request.agent(app);
    const signedUp = await agent.post("/v1/auth/signup").send({
      email,
      password: "password1",
      name: "Phase Ten",
      orgName: `${email} QS`,
    });
    const token = signedUp.body.accessToken as string;
    const me = await agent.get("/v1/me").set("Authorization", `Bearer ${token}`);
    const orgId = me.body.org.id as string;
    return {
      orgId,
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Org-Id": orgId,
      },
    };
  }
});
