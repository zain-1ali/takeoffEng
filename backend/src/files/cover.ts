import { Router } from "express";
import express from "express";
import { asyncHandler } from "../common/async-handler.js";
import { notFound, problem } from "../common/problem.js";
import { requireRole } from "../middleware/org.js";
import { requireProject } from "../projects/access.js";
import { getObject, putObject, signedGetUrl } from "./store.js";

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const coverRouter = Router({ mergeParams: true });

coverRouter.post(
  "/",
  requireProject,
  requireRole("EDITOR"),
  express.raw({
    type: (req) => String(req.headers["content-type"] ?? "").startsWith("image/"),
    limit: "4mb",
  }),
  asyncHandler(async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!body.length) {
      throw problem(400, "validation_error", "Validation error", "Cover image is required.");
    }
    const contentType = String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
    const ext = TYPES[contentType];
    if (!ext) {
      throw problem(415, "unsupported_media", "Unsupported media type", "Use a PNG, JPEG, WebP or GIF image.");
    }
    const key = `orgs/${req.orgId}/projects/${req.project!.id}/cover.${ext}`;
    await putObject(key, body, contentType);
    req.project!.coverImageKey = key;
    await req.project!.save();
    res.json({
      coverImageKey: key,
      contentType,
    });
  }),
);

coverRouter.get(
  "/",
  requireProject,
  asyncHandler(async (req, res) => {
    const key = req.project!.coverImageKey ? String(req.project!.coverImageKey) : "";
    if (!key) throw notFound("This project has no cover image.");
    const signed = await signedGetUrl(key);
    if (signed) {
      res.redirect(signed);
      return;
    }
    const file = await getObject(key);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.type(file.contentType).send(file.body);
  }),
);
