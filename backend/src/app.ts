import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { ENGINE_VERSION, ping } from "@takeoff/engine";
import { authRouter } from "./auth/routes.js";
import { env } from "./config/env.js";
import { databankRouter } from "./databank/routes.js";
import { mongoStatus } from "./db/connect.js";
import { errorHandler } from "./middleware/error.js";
import { invitationsRouter, orgsRouter } from "./orgs/routes.js";
import { projectsRouter } from "./projects/routes.js";
import { meRouter } from "./users/routes.js";

export function createApp() {
  const app = express();
  const settings = env();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin:
        settings.NODE_ENV === "production"
          ? settings.CLIENT_URL
          : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "8mb" }));
  app.use(cookieParser());

  const authLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => settings.NODE_ENV === "test",
  });

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

  app.use("/v1/auth", authLimit, authRouter);
  app.use("/v1", meRouter);
  app.use("/v1/orgs", orgsRouter);
  app.use("/v1/invitations", invitationsRouter);
  app.use("/v1/databank", databankRouter);
  app.use("/v1/projects", projectsRouter);
  app.use(errorHandler);

  return app;
}
