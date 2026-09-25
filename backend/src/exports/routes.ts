import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../common/async-handler.js";
import { notFound } from "../common/problem.js";
import { getObject, signedGetUrl } from "../files/store.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg } from "../middleware/org.js";
import { EXPORT_KINDS, ExportJob } from "../models/index.js";
import { requireProject } from "../projects/access.js";
import { enqueueExport, jobJson } from "./jobs.js";

export const projectExportsRouter = Router({ mergeParams: true });
export const exportsRouter = Router();

const createSchema = z.object({
  kind: z.enum(EXPORT_KINDS).default("FULL_XLSX"),
});

projectExportsRouter.post(
  "/",
  requireProject,
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body ?? {});
    const job = await enqueueExport({
      orgId: req.orgId!,
      projectId: req.project!.id,
      kind: body.kind,
      userId: req.userId!,
    });
    res.status(202).json(jobJson(job));
  }),
);

exportsRouter.use(requireAuth, requireOrg);

exportsRouter.get(
  "/:jobId",
  asyncHandler(async (req, res) => {
    const job = await ExportJob.findOne({ _id: req.params.jobId, orgId: req.orgId });
    if (!job) throw notFound("Export job not found.");
    res.json(jobJson(job));
  }),
);

exportsRouter.get(
  "/:jobId/file",
  asyncHandler(async (req, res) => {
    const job = await ExportJob.findOne({ _id: req.params.jobId, orgId: req.orgId });
    if (!job) throw notFound("Export job not found.");
    if (job.status !== "DONE" || !job.fileKey) {
      throw notFound("Export file is not ready.");
    }
    const signed = await signedGetUrl(job.fileKey);
    if (signed) {
      res.redirect(signed);
      return;
    }
    const file = await getObject(job.fileKey);
    res.setHeader("Content-Type", job.contentType || file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${job.fileName || "export"}"`);
    res.send(file.body);
  }),
);
