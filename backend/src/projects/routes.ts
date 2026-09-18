import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { entitlementsFor } from "../billing/plans.js";
import { asyncHandler } from "../common/async-handler.js";
import { writeAudit } from "../common/audit.js";
import { forbidden, notFound, problem, upgradeRequired } from "../common/problem.js";
import { dashboardFrom, runEngine, summaryFrom } from "../engine/run.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg, requireRole } from "../middleware/org.js";
import {
  BUILDING_TYPES,
  Organization,
  Project,
  ProjectDocument,
  ProjectVersion,
  STAGES,
  Subscription,
} from "../models/index.js";
import { requireProject } from "./access.js";
import { defaultProjectName, initialStateJson } from "./defaults.js";
import { assertNumericFormulas } from "./formulas.js";
import { registerProjectRateRoutes } from "./rates.js";
import { syncRatesFromState } from "./syncRates.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireOrg);

const createSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  buildingType: z.enum(BUILDING_TYPES),
  stage: z.enum(STAGES).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  numberLocale: z.string().trim().min(2).max(16).optional(),
  taxName: z.string().trim().min(1).max(40).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  contingencyRate: z.number().min(0).max(100).optional(),
});

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  stage: z.enum(STAGES).optional(),
  reference: z.string().trim().max(80).nullable().optional(),
  revision: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  drawings: z.string().trim().max(160).nullable().optional(),
  contract: z.string().trim().max(160).nullable().optional(),
  startDate: z.string().trim().max(40).nullable().optional(),
  duration: z.string().trim().max(40).nullable().optional(),
  measurementBasis: z.string().trim().max(80).nullable().optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  currencyCustom: z.string().trim().max(16).nullable().optional(),
  numberLocale: z.string().trim().min(2).max(16).optional(),
  taxName: z.string().trim().min(1).max(40).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  contingencyRate: z.number().min(0).max(100).optional(),
  roofMode: z.enum(["SIMPLE", "COMPLEX"]).optional(),
  databankCurrency: z.string().trim().min(3).max(8).optional(),
  fxRate: z.number().positive().optional(),
  stakeholders: z.array(z.object({
    role: z.string(),
    org: z.string(),
    contact: z.string(),
  })).optional(),
  params: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
});

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z.object({
      type: z.enum(BUILDING_TYPES).optional(),
      stage: z.enum(STAGES).optional(),
      q: z.string().trim().max(80).optional(),
      cursor: z.string().optional(),
      archived: z.enum(["1", "true"]).optional(),
    }).parse(req.query);

    const filter: Record<string, unknown> = { orgId: req.orgId };
    if (!query.archived) filter.archivedAt = null;
    else filter.archivedAt = { $ne: null };
    if (query.type) filter.buildingType = query.type;
    if (query.stage) filter.stage = query.stage;
    if (query.q) filter.name = new RegExp(escapeRegex(query.q), "i");
    if (query.cursor) {
      const sep = query.cursor.indexOf("_");
      const stamp = sep >= 0 ? query.cursor.slice(0, sep) : query.cursor;
      const id = sep >= 0 ? query.cursor.slice(sep + 1) : "";
      const date = stamp ? new Date(stamp) : undefined;
      if (date && !Number.isNaN(date.getTime()) && id) {
        filter.$or = [
          { updatedAt: { $lt: date } },
          { updatedAt: date, _id: { $lt: id } },
        ];
      }
    }

    const rows = await Project.find(filter).sort({ updatedAt: -1, _id: -1 }).limit(21).lean();
    const extra = rows.length > 20;
    const page = extra ? rows.slice(0, 20) : rows;
    const last = page.at(-1);
    res.json({
      projects: page.map((row) => ({
        id: row._id,
        name: row.name,
        buildingType: row.buildingType,
        stage: row.stage,
        currency: row.currency,
        summary: row.summary,
        updatedAt: row.updatedAt,
        archivedAt: row.archivedAt,
      })),
      nextCursor: extra && last ? `${new Date(last.updatedAt).toISOString()}_${last._id}` : null,
    });
  }),
);

projectsRouter.post(
  "/",
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const entitlements = await orgEntitlements(req.orgId!);
    if (!entitlements.types.includes(body.buildingType)) {
      throw upgradeRequired("projectType", entitlements.plan, "PROFESSIONAL");
    }
    const active = await Project.countDocuments({ orgId: req.orgId, archivedAt: null });
    if (entitlements.maxProjects != null && active >= entitlements.maxProjects) {
      throw upgradeRequired("maxProjects", entitlements.plan, "PROFESSIONAL");
    }

    const org = await Organization.findById(req.orgId);
    const name = body.name ?? defaultProjectName(body.buildingType);
    const currency = body.currency ?? org?.defaultCurrency ?? "USD";
    const numberLocale = body.numberLocale ?? org?.numberLocale ?? "en-GB";
    const project = await Project.create({
      orgId: req.orgId,
      name,
      buildingType: body.buildingType,
      stage: body.stage ?? "PRE_TENDER",
      currency,
      numberLocale,
      taxName: body.taxName ?? org?.taxName ?? "VAT",
      taxRate: body.taxRate ?? org?.taxRate ?? 0,
      contingencyRate: body.contingencyRate ?? 5,
      databankCurrency: org?.databankCurrency ?? "USD",
      createdById: req.userId!,
    });
    const stateJson = initialStateJson(body.buildingType, { name, currency, numberLocale });
    const document = await ProjectDocument.create({
      _id: project.id,
      stateJson,
      version: 1,
      updatedById: req.userId ?? null,
    });
    const bundle = await runEngine(project, stateJson);
    project.summary = summaryFrom(bundle);
    await project.save();
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "project.created",
      target: project.id,
      ip: req.ip,
    });
    res.status(201).json({
      ...project.toJSON(),
      documentVersion: document.version,
    });
  }),
);

projectsRouter.get(
  "/:id",
  requireProject,
  asyncHandler(async (req, res) => {
    res.json(req.project!.toJSON());
  }),
);

projectsRouter.patch(
  "/:id",
  requireProject,
  requireRole("EDITOR"),
  asyncHandler(saveSettings),
);

projectsRouter.patch(
  "/:id/settings",
  requireProject,
  requireRole("EDITOR"),
  asyncHandler(saveSettings),
);

projectsRouter.delete(
  "/:id",
  requireProject,
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    req.project!.archivedAt = new Date();
    await req.project!.save();
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "project.archived",
      target: req.project!.id,
      ip: req.ip,
    });
    res.status(204).end();
  }),
);

projectsRouter.post(
  "/:id/duplicate",
  requireProject,
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    const entitlements = await orgEntitlements(req.orgId!);
    const active = await Project.countDocuments({ orgId: req.orgId, archivedAt: null });
    if (entitlements.maxProjects != null && active >= entitlements.maxProjects) {
      throw upgradeRequired("maxProjects", entitlements.plan, "PROFESSIONAL");
    }
    const source = await ProjectDocument.findById(req.project!.id);
    if (!source) throw notFound("Project document not found.");
    const src = req.project!;
    const copy = await Project.create({
      orgId: src.orgId,
      name: `Copy of ${src.name}`,
      buildingType: src.buildingType,
      stage: src.stage,
      reference: src.reference,
      revision: src.revision,
      description: src.description,
      location: src.location,
      drawings: src.drawings,
      contract: src.contract,
      startDate: src.startDate,
      duration: src.duration,
      measurementBasis: src.measurementBasis,
      currency: src.currency,
      currencyCustom: src.currencyCustom,
      numberLocale: src.numberLocale,
      taxName: src.taxName,
      taxRate: src.taxRate,
      contingencyRate: src.contingencyRate,
      roofMode: src.roofMode,
      databankCurrency: src.databankCurrency,
      fxRate: src.fxRate,
      stakeholders: src.stakeholders,
      params: src.params,
      summary: src.summary,
      createdById: req.userId!,
    });
    await ProjectDocument.create({
      _id: copy.id,
      stateJson: structuredClone(source.stateJson),
      version: 1,
      updatedById: req.userId ?? null,
    });
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "project.duplicated",
      target: copy.id,
      ip: req.ip,
      data: { from: src.id },
    });
    res.status(201).json(copy.toJSON());
  }),
);

projectsRouter.get(
  "/:id/document",
  requireProject,
  asyncHandler(async (req, res) => {
    const document = await ProjectDocument.findById(req.project!.id);
    if (!document) throw notFound("Project document not found.");
    res.set("ETag", `"${document.version}"`);
    res.json({
      projectId: req.project!.id,
      version: document.version,
      stateJson: document.stateJson,
      updatedById: document.updatedById,
      updatedAt: document.updatedAt,
    });
  }),
);

projectsRouter.put(
  "/:id/document",
  requireProject,
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    assertActive(req);
    const document = await ProjectDocument.findById(req.project!.id);
    if (!document) throw notFound("Project document not found.");
    const match = req.get("if-match");
    if (match == null) {
      throw problem(
        400,
        "precondition_required",
        "If-Match required",
        "Send If-Match with the current document version.",
      );
    }
    if (parseVersion(match) !== document.version) {
      throw problem(
        412,
        "precondition_failed",
        "Precondition failed",
        "The document has been updated. Reload and retry.",
        { currentVersion: document.version },
      );
    }
    const body = z.object({ stateJson: z.record(z.string(), z.unknown()) }).parse(req.body);
    assertNumericFormulas(body.stateJson);
    document.stateJson = body.stateJson;
    document.version += 1;
    document.updatedById = req.userId ?? null;
    await document.save();
    await syncRatesFromState(req.project!.id, req.userId!, body.stateJson);
    const bundle = await runEngine(req.project!, body.stateJson);
    req.project!.summary = summaryFrom(bundle);
    await req.project!.save();
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "document.saved",
      target: req.project!.id,
      ip: req.ip,
      data: { version: document.version },
    });
    res.set("ETag", `"${document.version}"`);
    res.json({
      projectId: req.project!.id,
      version: document.version,
      stateJson: document.stateJson,
      summary: req.project!.summary,
    });
  }),
);

projectsRouter.get(
  "/:id/versions",
  requireProject,
  asyncHandler(async (req, res) => {
    const versions = await ProjectVersion.find({ projectId: req.project!.id })
      .sort({ number: -1 })
      .select("number name note auto createdById createdAt")
      .lean();
    res.json({
      versions: versions.map((row) => ({
        number: row.number,
        name: row.name,
        note: row.note,
        auto: row.auto,
        createdById: row.createdById,
        createdAt: row.createdAt,
      })),
    });
  }),
);

projectsRouter.post(
  "/:id/versions",
  requireProject,
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    assertActive(req);
    const body = z.object({
      name: z.string().trim().max(80).optional(),
      note: z.string().trim().max(400).optional(),
    }).parse(req.body);
    const document = await ProjectDocument.findById(req.project!.id);
    if (!document) throw notFound("Project document not found.");
    const last = await ProjectVersion.findOne({ projectId: req.project!.id }).sort({ number: -1 });
    const number = (last?.number ?? 0) + 1;
    const version = await ProjectVersion.create({
      projectId: req.project!.id,
      number,
      name: body.name ?? `Version ${number}`,
      note: body.note ?? null,
      auto: false,
      stateJson: structuredClone(document.stateJson),
      summary: req.project!.summary ?? {},
      createdById: req.userId!,
    });
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "version.created",
      target: req.project!.id,
      ip: req.ip,
      data: { number: version.number },
    });
    res.status(201).json({
      number: version.number,
      name: version.name,
      note: version.note,
      createdAt: version.createdAt,
    });
  }),
);

projectsRouter.get(
  "/:id/versions/:n",
  requireProject,
  asyncHandler(async (req, res) => {
    const version = await ProjectVersion.findOne({
      projectId: req.project!.id,
      number: Number(req.params.n),
    });
    if (!version) throw notFound("Version not found.");
    res.json({
      number: version.number,
      name: version.name,
      note: version.note,
      auto: version.auto,
      stateJson: version.stateJson,
      summary: version.summary,
      createdById: version.createdById,
      createdAt: version.createdAt,
    });
  }),
);

projectsRouter.post(
  "/:id/versions/:n/restore",
  requireProject,
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    assertActive(req);
    const version = await ProjectVersion.findOne({
      projectId: req.project!.id,
      number: Number(req.params.n),
    });
    if (!version) throw notFound("Version not found.");
    const document = await ProjectDocument.findById(req.project!.id);
    if (!document) throw notFound("Project document not found.");
    const stateJson = structuredClone(version.stateJson) as Record<string, unknown>;
    document.stateJson = stateJson;
    document.version += 1;
    document.updatedById = req.userId ?? null;
    await document.save();
    const bundle = await runEngine(req.project!, stateJson);
    req.project!.summary = summaryFrom(bundle);
    await req.project!.save();
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "version.restored",
      target: req.project!.id,
      ip: req.ip,
      data: { restoredFrom: version.number, version: document.version },
    });
    res.json({
      version: document.version,
      restoredFrom: version.number,
      summary: req.project!.summary,
    });
  }),
);

projectsRouter.get(
  "/:id/summary",
  requireProject,
  asyncHandler(async (req, res) => {
    res.json(await report(req, "summary"));
  }),
);

projectsRouter.get(
  "/:id/dashboard",
  requireProject,
  asyncHandler(async (req, res) => {
    res.json(await report(req, "dashboard"));
  }),
);

projectsRouter.get(
  "/:id/boq",
  requireProject,
  asyncHandler(async (req, res) => {
    res.json(await report(req, "boq"));
  }),
);

projectsRouter.get(
  "/:id/bom",
  requireProject,
  asyncHandler(async (req, res) => {
    const entitlements = await orgEntitlements(req.orgId!);
    if (!entitlements.bom) {
      throw upgradeRequired("bom", entitlements.plan, "PROFESSIONAL");
    }
    res.json(await report(req, "bom"));
  }),
);

projectsRouter.get(
  "/:id/bbs",
  requireProject,
  asyncHandler(async (req, res) => {
    res.json(await report(req, "bbs"));
  }),
);

projectsRouter.get(
  "/:id/dims",
  requireProject,
  asyncHandler(async (req, res) => {
    res.json(await report(req, "dims"));
  }),
);

projectsRouter.get(
  "/:id/params",
  requireProject,
  asyncHandler(async (req, res) => {
    res.json(await report(req, "params"));
  }),
);

registerProjectRateRoutes(projectsRouter);

async function saveSettings(req: Request, res: Response): Promise<void> {
  assertActive(req);
  const body = settingsSchema.parse(req.body);
  Object.assign(req.project!, body);
  const document = await ProjectDocument.findById(req.project!.id);
  if (document) {
    const bundle = await runEngine(req.project!, document.stateJson as Record<string, unknown>);
    req.project!.summary = summaryFrom(bundle);
  }
  await req.project!.save();
  await writeAudit({
    orgId: req.orgId,
    actorId: req.userId,
    action: "project.updated",
    target: req.project!.id,
    ip: req.ip,
  });
  res.json(req.project!.toJSON());
}

async function report(
  req: Request,
  kind: "summary" | "dashboard" | "boq" | "bom" | "bbs" | "dims" | "params",
) {
  const document = await ProjectDocument.findById(req.project!.id);
  if (!document) throw notFound("Project document not found.");
  const bundle = await runEngine(req.project!, document.stateJson as Record<string, unknown>);
  switch (kind) {
    case "summary":
      return summaryFrom(bundle);
    case "dashboard": {
      const entitlements = await orgEntitlements(req.orgId!);
      return dashboardFrom(bundle, {
        rateAnalysis: entitlements.rateAnalysis,
        bom: entitlements.bom,
      });
    }
    case "boq":
      return bundle.boq;
    case "bom":
      return { rows: bundle.bom, total: bundle.bomAmount };
    case "bbs":
      return { bars: bundle.result.bars, steelKg: bundle.result.steelKg };
    case "dims":
      return { items: bundle.result.items, totals: bundle.result.tot };
    case "params":
      return { params: bundle.params };
  }
}

async function orgEntitlements(orgId: string) {
  const subscription = await Subscription.findOne({ orgId }).lean();
  return entitlementsFor(subscription?.plan);
}

function assertActive(req: Request): void {
  if (req.project?.archivedAt) throw forbidden("This project is archived.");
}

function parseVersion(header: string): number {
  return Number(header.trim().replace(/^W\//, "").replaceAll('"', ""));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
