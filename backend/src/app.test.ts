import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "./app.js";
import { resetEnv } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";

const app = createApp();

describe("Phase 3 auth, orgs and databank", () => {
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

  it("reports engine health and mongo readiness", async () => {
    const health = await request(app).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.engine.ping).toBe("takeoff-engine");
    const ready = await request(app).get("/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.mongodb).toBe("connected");
  });

  it("signs up with a magic link, seeds the databank, and issues tokens", async () => {
    const agent = request.agent(app);
    const link = await agent.post("/v1/auth/magic-link").send({
      email: "owner@example.com",
      name: "Ada Owner",
    });
    expect(link.status).toBe(202);
    expect(link.body.devToken).toMatch(/^[a-f0-9]+$/);

    const verified = await agent.post("/v1/auth/verify").send({
      token: link.body.devToken,
      name: "Ada Owner",
      orgName: "Ada QS",
    });
    expect(verified.status).toBe(200);
    const access = verified.body.accessToken as string;

    const me = await agent
      .get("/v1/me")
      .set("Authorization", `Bearer ${access}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("owner@example.com");
    expect(me.body.role).toBe("OWNER");
    expect(me.body.plan).toBe("STARTER");
    expect(me.body.entitlements.rateAnalysis).toBe(false);
    const orgId = me.body.org.id as string;

    const databank = await agent
      .get("/v1/databank")
      .set("Authorization", `Bearer ${access}`)
      .set("X-Org-Id", orgId);
    expect(databank.status).toBe(200);
    expect(databank.body.resources).toHaveLength(200);
    expect(databank.body.resources.some((row: { code: string }) => row.code === "L01")).toBe(true);
    expect(databank.body.resources.some((row: { code: string }) => row.code === "R33")).toBe(true);
  });

  it("invites a member and rejects unauthenticated and cross-org access", async () => {
    const ownerAgent = request.agent(app);
    const ownerLink = await ownerAgent.post("/v1/auth/magic-link").send({
      email: "lead@example.com",
    });
    const ownerAuth = await ownerAgent.post("/v1/auth/verify").send({
      token: ownerLink.body.devToken,
      orgName: "Lead Studio",
    });
    const ownerToken = ownerAuth.body.accessToken as string;
    const ownerMe = await ownerAgent
      .get("/v1/me")
      .set("Authorization", `Bearer ${ownerToken}`);
    const orgId = ownerMe.body.org.id as string;

    const denied = await request(app).get("/v1/me");
    expect(denied.status).toBe(401);

    const invite = await ownerAgent
      .post(`/v1/orgs/${orgId}/invitations`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ email: "editor@example.com", role: "EDITOR" });
    expect(invite.status).toBe(201);
    expect(invite.body.devToken).toBeTruthy();

    const preview = await request(app).get(`/v1/invitations/${invite.body.devToken}`);
    expect(preview.status).toBe(200);
    expect(preview.body.email).toBe("editor@example.com");
    expect(preview.body.orgName).toBe("Lead Studio");

    const editorAgent = request.agent(app);
    const editorLink = await editorAgent.post("/v1/auth/magic-link").send({
      email: "editor@example.com",
    });
    const editorAuth = await editorAgent.post("/v1/auth/verify").send({
      token: editorLink.body.devToken,
    });
    const editorToken = editorAuth.body.accessToken as string;

    const accepted = await editorAgent
      .post(`/v1/invitations/${invite.body.devToken}/accept`)
      .set("Authorization", `Bearer ${editorToken}`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.role).toBe("EDITOR");

    const members = await ownerAgent
      .get(`/v1/orgs/${orgId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(members.body.members).toHaveLength(2);

    const otherLink = await request(app).post("/v1/auth/magic-link").send({
      email: "other@example.com",
    });
    const otherAuth = await request(app).post("/v1/auth/verify").send({
      token: otherLink.body.devToken,
    });
    const cross = await request(app)
      .get("/v1/databank")
      .set("Authorization", `Bearer ${otherAuth.body.accessToken}`)
      .set("X-Org-Id", orgId);
    expect(cross.status).toBe(404);
  });

  it("rotates the refresh token cookie", async () => {
    const agent = request.agent(app);
    const link = await agent.post("/v1/auth/magic-link").send({
      email: "refresh@example.com",
    });
    await agent.post("/v1/auth/verify").send({ token: link.body.devToken });
    const refreshed = await agent.post("/v1/auth/refresh");
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
  });
});
