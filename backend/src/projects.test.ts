import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { compute } from "@takeoff/engine";
import { createApp } from "./app.js";
import { resetEnv } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";
import { toEngineProject } from "./engine/run.js";
import { Project, ProjectDocument, Subscription } from "./models/index.js";

const app = createApp();

describe("Phase 4 projects, documents and reports", () => {
  let memory: MongoMemoryServer | undefined;

  beforeAll(async () => {
    resetEnv();
    try {
      await connectDb("mongodb://127.0.0.1:27017/takeoff_studio_test");
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

  it("creates a foundation project, versions the document, and matches engine totals", async () => {
    const { orgId, headers } = await signup("phase4@example.com");

    const multiType = await request(app)
      .post("/v1/projects")
      .set(headers)
      .send({ buildingType: "MULTI" });
    expect(multiType.status).toBe(201);

    const created = await request(app)
      .post("/v1/projects")
      .set(headers)
      .send({ buildingType: "FOUNDATION", name: "Pad take-off" });
    expect(created.status).toBe(201);
    expect(created.body.id).toBeTruthy();
    expect(created.body.buildingType).toBe("FOUNDATION");
    expect(created.body.summary.concrete).toBe(0);
    expect(created.body.summary.steelKg).toBe(0);
    expect(created.body.summary.total).toBe(0);
    const projectId = created.body.id as string;

    const second = await request(app)
      .post("/v1/projects")
      .set(headers)
      .send({ buildingType: "SINGLE" });
    expect(second.status).toBe(201);

    const listed = await request(app).get("/v1/projects").set(headers);
    expect(listed.status).toBe(200);
    expect(listed.body.projects).toHaveLength(3);
    expect(listed.body.projects.some((row: { name: string }) => row.name === "Pad take-off")).toBe(true);

    const document = await request(app).get(`/v1/projects/${projectId}/document`).set(headers);
    expect(document.status).toBe(200);
    expect(document.body.version).toBe(1);
    expect(String(document.headers.etag)).toContain("1");

    const missingMatch = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set(headers)
      .send({ stateJson: document.body.stateJson });
    expect(missingMatch.status).toBe(400);
    expect(missingMatch.body.type).toBe("precondition_required");

    const stale = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set(headers)
      .set("If-Match", "99")
      .send({ stateJson: document.body.stateJson });
    expect(stale.status).toBe(412);
    expect(stale.body.type).toBe("precondition_failed");

    const badFormula = structuredClone(document.body.stateJson) as {
      types: { pad: Array<{ L: unknown }> };
    };
    badFormula.types.pad[0]!.L = "not a formula";
    const rejected = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set(headers)
      .set("If-Match", "1")
      .send({ stateJson: badFormula });
    expect(rejected.status).toBe(422);
    expect(rejected.body.type).toBe("invalid_formula");
    expect(rejected.body.path).toContain("types.pad[0].L");

    const updatedState = structuredClone(document.body.stateJson) as {
      types: { pad: Array<{ L: unknown }> };
      pl: { pad: Array<Record<string, unknown>> };
    };
    updatedState.types.pad[0]!.L = "1.8*2";
    updatedState.pl.pad = [{ id: "pf-test", type: "F1", no: 1, ref: "Test pad" }];
    const saved = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set(headers)
      .set("If-Match", '"1"')
      .send({ stateJson: updatedState });
    expect(saved.status).toBe(200);
    expect(saved.body.version).toBe(2);
    expect(saved.body.summary.concrete).toBeGreaterThan(created.body.summary.concrete);

    const snapshot = await request(app)
      .post(`/v1/projects/${projectId}/versions`)
      .set(headers)
      .send({ name: "After pad width", note: "doubled F1 length" });
    expect(snapshot.status).toBe(201);
    expect(snapshot.body.number).toBe(1);

    const restoredState = structuredClone(document.body.stateJson);
    const restoredDoc = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set(headers)
      .set("If-Match", "2")
      .send({ stateJson: restoredState });
    expect(restoredDoc.status).toBe(200);
    expect(restoredDoc.body.version).toBe(3);

    const restore = await request(app)
      .post(`/v1/projects/${projectId}/versions/1/restore`)
      .set(headers);
    expect(restore.status).toBe(200);
    expect(restore.body.restoredFrom).toBe(1);
    expect(restore.body.version).toBe(4);

    const summary = await request(app).get(`/v1/projects/${projectId}/summary`).set(headers);
    const dashboard = await request(app).get(`/v1/projects/${projectId}/dashboard`).set(headers);
    const boq = await request(app).get(`/v1/projects/${projectId}/boq`).set(headers);
    const bbs = await request(app).get(`/v1/projects/${projectId}/bbs`).set(headers);
    const dims = await request(app).get(`/v1/projects/${projectId}/dims`).set(headers);
    const params = await request(app).get(`/v1/projects/${projectId}/params`).set(headers);
    const bom = await request(app).get(`/v1/projects/${projectId}/bom`).set(headers);

    expect(summary.status).toBe(200);
    expect(dashboard.status).toBe(200);
    expect(boq.status).toBe(200);
    expect(bbs.status).toBe(200);
    expect(dims.status).toBe(200);
    expect(params.status).toBe(200);
    expect(bom.status).toBe(200);
    expect(bom.body.rows.length).toBeGreaterThan(0);
    expect(Array.isArray(dashboard.body.materials)).toBe(true);
    expect(boq.body.items.length).toBeGreaterThan(0);
    expect(params.body.params[0]?.[0]).toBe("Project type");

    const record = await Project.findById(projectId);
    const stored = await ProjectDocument.findById(projectId);
    expect(record).toBeTruthy();
    expect(stored).toBeTruthy();
    const engine = compute(toEngineProject(record!, stored!.stateJson as Record<string, unknown>));
    expect(summary.body.concrete).toBeCloseTo(engine.concrete, 6);
    expect(summary.body.steelKg).toBeCloseTo(engine.steelKg, 6);
    expect(summary.body.itemCount).toBe(engine.items.length);

    await Subscription.updateOne({ orgId }, { plan: "PROFESSIONAL" });
    const bomOk = await request(app).get(`/v1/projects/${projectId}/bom`).set(headers);
    expect(bomOk.status).toBe(200);
    expect(bomOk.body.rows.length).toBeGreaterThan(0);

    const copy = await request(app).post(`/v1/projects/${projectId}/duplicate`).set(headers);
    expect(copy.status).toBe(201);
    expect(copy.body.name).toBe("Copy of Pad take-off");

    const renamed = await request(app)
      .patch(`/v1/projects/${projectId}/settings`)
      .set(headers)
      .send({ name: "Foundations – F1 doubled", stage: "TENDER" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("Foundations – F1 doubled");

    const archived = await request(app).delete(`/v1/projects/${projectId}`).set(headers);
    expect(archived.status).toBe(204);
    const activeList = await request(app).get("/v1/projects").set(headers);
    expect(activeList.body.projects.every((row: { id: string }) => row.id !== projectId)).toBe(true);
    const archivedList = await request(app).get("/v1/projects?archived=1").set(headers);
    expect(archivedList.body.projects.some((row: { id: string }) => row.id === projectId)).toBe(true);
  }, 120_000);

  async function signup(email: string) {
    const agent = request.agent(app);
    const signedUp = await agent.post("/v1/auth/signup").send({
      email,
      password: "password1",
      name: "Phase Four",
      orgName: "Phase Four QS",
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
