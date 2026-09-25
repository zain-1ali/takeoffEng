import PQueue from "p-queue";
import { entitlementsFor } from "../billing/plans.js";
import { problem } from "../common/problem.js";
import { logActivity } from "../collab/board.js";
import { emitProject } from "../collab/realtime.js";
import { runEngine } from "../engine/run.js";
import { putObject } from "../files/store.js";
import { ExportJob, Project, ProjectDocument, Subscription, type ExportJobDoc } from "../models/index.js";
import type { ExportKind } from "../models/enums.js";
import { buildReportPdf } from "./pdf.js";
import { buildWorkbook } from "./workbook.js";

const queue = new PQueue({ concurrency: 1 });
const HOUR_MS = 60 * 60 * 1000;
const MAX_EXPORTS_PER_HOUR = 10;

export interface PublicJob {
  id: string;
  projectId: string;
  kind: string;
  status: string;
  progress: number;
  fileName: string | null;
  error: string | null;
  watermark: boolean;
  createdAt: Date | undefined;
  finishedAt: Date | null;
}

export async function enqueueExport(options: {
  orgId: string;
  projectId: string;
  kind: ExportKind;
  userId: string;
}): Promise<ExportJobDoc> {
  const hourAgo = new Date(Date.now() - HOUR_MS);
  const recent = await ExportJob.countDocuments({ orgId: options.orgId, createdAt: { $gt: hourAgo } });
  if (recent >= MAX_EXPORTS_PER_HOUR) {
    throw problem(
      429,
      "rate_limited",
      "Too many exports",
      "This organisation can start 10 exports per hour.",
    );
  }
  const subscription = await Subscription.findOne({ orgId: options.orgId }).lean();
  const watermark = entitlementsFor(subscription?.plan).exportsWatermark;
  const job = await ExportJob.create({
    orgId: options.orgId,
    projectId: options.projectId,
    kind: options.kind,
    status: "QUEUED",
    progress: 0,
    watermark,
    requestedById: options.userId,
  });
  emitProject(options.projectId, "export.progress", jobJson(job));
  void queue.add(() => processJob(job.id));
  return job;
}

export function jobJson(job: ExportJobDoc | { id: string } & Record<string, unknown>): PublicJob {
  return {
    id: String(job.id),
    projectId: String(job.projectId ?? ""),
    kind: String(job.kind ?? ""),
    status: String(job.status ?? ""),
    progress: Number(job.progress ?? 0),
    fileName: job.fileName != null && job.fileName !== "" ? String(job.fileName) : null,
    error: job.error != null && job.error !== "" ? String(job.error) : null,
    watermark: Boolean(job.watermark),
    createdAt: job.createdAt instanceof Date ? job.createdAt : undefined,
    finishedAt: job.finishedAt instanceof Date ? job.finishedAt : null,
  };
}

export async function waitForExportIdle(): Promise<void> {
  await queue.onIdle();
}

async function processJob(jobId: string): Promise<void> {
  const job = await ExportJob.findById(jobId);
  if (!job || job.status === "DONE") return;
  job.status = "RUNNING";
  job.progress = 10;
  await job.save();
  emitProject(job.projectId, "export.progress", jobJson(job));
  try {
    const [record, document] = await Promise.all([
      Project.findById(job.projectId),
      ProjectDocument.findById(job.projectId),
    ]);
    if (!record || !document) throw new Error("Project document not found.");
    job.progress = 40;
    await job.save();
    const bundle = await runEngine(record, document.stateJson as Record<string, unknown>);
    job.progress = 70;
    await job.save();
    const watermark = Boolean(job.watermark);
    const slug = safeName(record.name);
    let body: Buffer;
    let fileName: string;
    let contentType: string;
    if (job.kind === "FULL_XLSX") {
      body = await buildWorkbook(bundle, record, { watermark });
      fileName = `${slug}_takeoff.xlsx`;
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else {
      body = buildReportPdf(job.kind as ExportKind, bundle, record, { watermark });
      fileName = `${slug}_${job.kind.toLowerCase()}.pdf`;
      contentType = "application/pdf";
    }
    const fileKey = `orgs/${job.orgId}/projects/${job.projectId}/exports/${job.id}/${fileName}`;
    await putObject(fileKey, body, contentType);
    job.fileKey = fileKey;
    job.fileName = fileName;
    job.contentType = contentType;
    job.status = "DONE";
    job.progress = 100;
    job.finishedAt = new Date();
    await job.save();
    emitProject(job.projectId, "export.ready", jobJson(job));
    await logActivity(job.projectId, job.requestedById, "exported", `exported ${fileName}`, {
      kind: job.kind,
      jobId: job.id,
    });
  } catch (err) {
    job.status = "FAILED";
    job.error = err instanceof Error ? err.message : "Export failed.";
    job.finishedAt = new Date();
    await job.save();
    emitProject(job.projectId, "export.failed", jobJson(job));
  }
}

function safeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "takeoff";
}
