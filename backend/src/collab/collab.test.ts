import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../app.js";
import { resetEnv } from "../config/env.js";
import { connectDb, disconnectDb } from "../db/connect.js";
import { Membership } from "../models/index.js";
import { onProjectEmit } from "./realtime.js";

const app = createApp();

describe("Phase 11 collaboration", () => {
  let memory: MongoMemoryServer | undefined;
  let owner: Awaited<ReturnType<typeof signup>>;
  let projectId: string;

  beforeAll(async () => {
    resetEnv();
    try {
      await connectDb("mongodb://127.0.0.1:27017/takeoff_studio_collab_test");
      await mongoose.connection.db?.admin().command({ ping: 1 });
    } catch {
      await disconnectDb();
      memory = await MongoMemoryServer.create();
      await connectDb(memory.getUri());
    }
    await mongoose.connection.dropDatabase();
    owner = await signup("owner11@example.com");
    const created = await request(app)
      .post("/v1/projects")
      .set(owner.headers)
      .send({ buildingType: "FOUNDATION", name: "Collab pad" });
    projectId = created.body.id as string;
  }, 180_000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await disconnectDb();
    await memory?.stop();
  });

  it("lets a commenter post a bill comment and rejects a viewer PUT", async () => {
    const commenter = await signup("commenter11@example.com");
    const viewer = await signup("viewer11@example.com");
    await Membership.create({ orgId: owner.orgId, userId: commenter.userId, role: "COMMENTER" });
    await Membership.create({ orgId: owner.orgId, userId: viewer.userId, role: "VIEWER" });

    const posted = await request(app)
      .post(`/v1/projects/${projectId}/comments`)
      .set({ Authorization: `Bearer ${commenter.token}`, "X-Org-Id": owner.orgId })
      .send({ anchorType: "BOQ_ITEM", anchorId: "CPAD", body: "Check this pad quantity." });
    expect(posted.status).toBe(201);
    expect(posted.body.anchorId).toBe("CPAD");

    const board = await request(app).get(`/v1/projects/${projectId}/board`).set(owner.headers);
    expect(board.status).toBe(200);
    expect(board.body.comments).toHaveLength(1);

    const document = await request(app).get(`/v1/projects/${projectId}/document`).set(owner.headers);
    const viewerPut = await request(app)
      .put(`/v1/projects/${projectId}/document`)
      .set({
        Authorization: `Bearer ${viewer.token}`,
        "X-Org-Id": owner.orgId,
        "If-Match": `"${document.body.version}"`,
      })
      .send({ stateJson: document.body.stateJson });
    expect(viewerPut.status).toBe(403);
  });

  it("emits a new bill comment so other clients can show it immediately", async () => {
    const received = new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("comment event timed out")), 1000);
      const stop = onProjectEmit((event, payload) => {
        if (event !== "comment.created") return;
        clearTimeout(timer);
        stop();
        resolve(payload as Record<string, unknown>);
      });
    });
    const posted = await request(app)
      .post(`/v1/projects/${projectId}/comments`)
      .set(owner.headers)
      .send({ anchorType: "BOQ_ITEM", anchorId: "CCOL", body: "Live comment" });
    expect(posted.status).toBe(201);
    const event = await received;
    expect(event.body).toBe("Live comment");
    expect(event.anchorId).toBe("CCOL");
  });
});

async function signup(email: string) {
  const agent = request.agent(app);
  const signedUp = await agent.post("/v1/auth/signup").send({
    email,
    password: "password1",
    name: email.split("@")[0],
    orgName: `${email.split("@")[0]} QS`,
  });
  const token = signedUp.body.accessToken as string;
  const me = await agent.get("/v1/me").set("Authorization", `Bearer ${token}`);
  return {
    token,
    userId: me.body.user.id as string,
    orgId: me.body.org.id as string,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Org-Id": me.body.org.id as string,
    },
  };
}
