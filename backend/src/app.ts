import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { ENGINE_VERSION, ping } from "@takeoff/engine";
import { authRouter } from "./auth/routes.js";
import { env } from "./config/env.js";
import { isAllowedOrigin } from "./config/origins.js";
import { databankRouter } from "./databank/routes.js";
import { mongoStatus } from "./db/connect.js";
import { errorHandler } from "./middleware/error.js";
import { invitationsRouter, orgsRouter } from "./orgs/routes.js";
import { projectsRouter } from "./projects/routes.js";
import { meRouter } from "./users/routes.js";

export function createApp() {
  const app = express();
  const settings = env();

  if (settings.NODE_ENV === "production") app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "8mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "takeoff-api",
      engine: { version: ENGINE_VERSION, ping: ping() },
    });
  });

  app.get("/ready", (_req, res) => {
    const mongodb = mongoStatus();
    res.status(mongodb === "connected" ? 200 : 503).json({
      status: mongodb === "connected" ? "ok" : "degraded",
      mongodb,
    });
  });

  app.get("/v1", (_req, res) => {
    res.json({ name: "TakeOff Studio API", version: "0.4.0" });
  });

  app.use("/v1/auth", authRouter);
  app.use("/v1", meRouter);
  app.use("/v1/orgs", orgsRouter);
  app.use("/v1/invitations", invitationsRouter);
  app.use("/v1/databank", databankRouter);
  app.use("/v1/projects", projectsRouter);
  app.use(errorHandler);

  return app;
}
