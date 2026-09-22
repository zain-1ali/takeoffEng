import { Router } from "express";
import { n } from "@takeoff/engine";
import { z } from "zod";
import { entitlementsFor } from "../billing/plans.js";
import { asyncHandler } from "../common/async-handler.js";
import { writeAudit } from "../common/audit.js";
import { conflict, notFound, problem, upgradeRequired } from "../common/problem.js";
import { requireAuth } from "../middleware/auth.js";
import { requireOrg, requireRole } from "../middleware/org.js";
import { Organization, Project, Resource, Subscription } from "../models/index.js";
import { parseCsv, toCsv } from "./csv.js";
import { parseCategory, rateFields, serializeResource } from "./map.js";
import { seedOrgDatabank } from "./seed.js";

export const databankRouter = Router();

databankRouter.use(requireAuth, requireOrg);

const resourceBody = z.object({
  code: z.string().trim().min(1).max(24).optional(),
  category: z.string().trim().min(1).max(24).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  unit: z.string().trim().min(1).max(24).optional(),
  rate: z.union([z.string(), z.number()]).optional(),
  note: z.string().trim().max(400).nullable().optional(),
});

async function planFor(orgId: string) {
  const subscription = await Subscription.findOne({ orgId }).lean();
  return entitlementsFor(subscription?.plan);
}

async function requireRateAnalysis(orgId: string): Promise<void> {
  const entitlements = await planFor(orgId);
  if (!entitlements.rateAnalysis) {
    throw upgradeRequired("rateAnalysis", entitlements.plan, "PROFESSIONAL");
  }
}

async function bumpDatabank(orgId: string): Promise<void> {
  await Organization.updateOne({ _id: orgId }, { $inc: { databankVersion: 1 } });
}

function isDuplicate(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code: number }).code === 11000);
}

async function nextCode(orgId: string, category: string): Promise<string> {
  const prefix = category === "SUBCONTRACT" ? "S" : category.charAt(0) || "M";
  const existing = new Set(
    (await Resource.find({ orgId }).select("code").lean()).map((row) => row.code),
  );
  let n = 1;
  while (existing.has(`${prefix}${String(n).padStart(2, "0")}`)) n += 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

function defaultUnit(category: string): string {
  return category === "LABOUR" || category === "PLANT" ? "h" : "No.";
}

async function orgMeta(orgId: string) {
  const org = await Organization.findById(orgId).lean();
  return {
    currency: org?.databankCurrency ?? "USD",
    priceBasis: org?.priceBasis ?? "Add your local rates – new projects stay at zero until you do",
    version: org?.databankVersion ?? 1,
  };
}

databankRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z.object({
      category: z.string().trim().optional(),
      q: z.string().trim().max(80).optional(),
    }).parse(req.query);
    const filter: Record<string, unknown> = { orgId: req.orgId };
    if (query.category && query.category.toLowerCase() !== "all") {
      filter.category = parseCategory(query.category);
    }
    if (query.q) {
      const rx = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ code: rx }, { name: rx }, { note: rx }];
    }
    await seedOrgDatabank(req.orgId!);
    const [rows, meta] = await Promise.all([
      Resource.find(filter).sort({ category: 1, code: 1 }).lean(),
      orgMeta(req.orgId!),
    ]);
    res.json({
      ...meta,
      resources: rows.map((row) => serializeResource(row)),
    });
  }),
);

databankRouter.get(
  "/export.csv",
  asyncHandler(async (req, res) => {
    const rows = await Resource.find({ orgId: req.orgId }).sort({ category: 1, code: 1 }).lean();
    const csv = toCsv([
      ["code", "category", "name", "unit", "rate", "notes"],
      ...rows.map((row) => [
        row.code,
        row.category,
        row.name,
        row.unit,
        row.rate,
        row.note ?? "",
      ]),
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="resource_databank.csv"');
    res.send(csv);
  }),
);

databankRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await requireRateAnalysis(req.orgId!);
    const body = resourceBody.parse(req.body);
    const org = await Organization.findById(req.orgId).lean();
    const category = parseCategory(body.category);
    const code = (body.code ?? await nextCode(req.orgId!, category)).toUpperCase();
    const rates = rateFields(body.rate ?? 0);
    try {
      const created = await Resource.create({
        orgId: req.orgId,
        code,
        category,
        name: body.name ?? "New resource",
        unit: body.unit ?? defaultUnit(category),
        ...rates,
        currency: org?.databankCurrency ?? "USD",
        note: body.note ?? null,
        updatedById: req.userId ?? null,
      });
      await bumpDatabank(req.orgId!);
      await writeAudit({
        orgId: req.orgId,
        actorId: req.userId,
        action: "databank.created",
        target: created.id,
        ip: req.ip,
        data: { code },
      });
      res.status(201).json(serializeResource(created.toObject()));
    } catch (error) {
      if (isDuplicate(error)) throw conflict(`Resource ${code} already exists.`);
      throw error;
    }
  }),
);

databankRouter.post(
  "/import",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await requireRateAnalysis(req.orgId!);
    const body = z.object({
      csv: z.string().max(2_000_000).optional(),
      rows: z.array(z.array(z.union([z.string(), z.number()]))).max(5000).optional(),
    }).parse(req.body);
    const table = body.rows?.map((row) => row.map((cell) => String(cell)))
      ?? (body.csv ? parseCsv(body.csv) : []);
    if (!table.length) {
      throw problem(400, "validation_error", "Validation error", "CSV is empty.");
    }
    const header = table[0]!.map((cell) => cell.trim().toLowerCase());
    const hasHead = header.includes("code");
    const indexOf = (key: string, fallback: number) => (hasHead ? header.indexOf(key) : fallback);
    const org = await Organization.findById(req.orgId).lean();
    const currency = org?.databankCurrency ?? "USD";
    let added = 0;
    let updated = 0;
    const start = hasHead ? 1 : 0;
    for (const row of table.slice(start)) {
      const code = String(row[indexOf("code", 0)] ?? "").trim();
      if (!code) continue;
      const category = parseCategory(String(row[indexOf("category", 1)] ?? "Material"));
      const name = String(row[indexOf("name", 2)] ?? code).trim() || code;
      const unit = String(row[indexOf("unit", 3)] ?? defaultUnit(category)).trim() || defaultUnit(category);
      const rates = rateFields(row[indexOf("rate", 4)] ?? 0);
      const notesIndex = indexOf("notes", 5);
      const note = (notesIndex >= 0 ? String(row[notesIndex] ?? "") : "").trim() || null;
      const existing = await Resource.findOne({ orgId: req.orgId, code });
      if (existing) {
        existing.category = category;
        existing.name = name;
        existing.unit = unit;
        existing.rate = rates.rate;
        existing.rateValue = rates.rateValue;
        existing.note = note;
        existing.updatedById = req.userId ?? null;
        await existing.save();
        updated += 1;
      } else {
        await Resource.create({
          orgId: req.orgId,
          code,
          category,
          name,
          unit,
          ...rates,
          currency,
          note,
          updatedById: req.userId ?? null,
        });
        added += 1;
      }
    }
    await bumpDatabank(req.orgId!);
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "databank.imported",
      ip: req.ip,
      data: { added, updated },
    });
    res.json({ added, updated });
  }),
);

databankRouter.post(
  "/adjust",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await requireRateAnalysis(req.orgId!);
    const body = z.object({
      category: z.string().trim().optional(),
      percent: z.number().min(-90).max(1000),
    }).parse(req.body);
    const filter: Record<string, unknown> = { orgId: req.orgId };
    if (body.category && body.category.toLowerCase() !== "all") {
      filter.category = parseCategory(body.category);
    }
    const rows = await Resource.find(filter);
    const factor = 1 + body.percent / 100;
    for (const row of rows) {
      const next = Math.round(n(row.rate) * factor * 100) / 100;
      row.rate = String(next);
      row.rateValue = next;
      row.updatedById = req.userId ?? null;
      await row.save();
    }
    await bumpDatabank(req.orgId!);
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "databank.adjusted",
      ip: req.ip,
      data: { percent: body.percent, count: rows.length, category: body.category ?? "All" },
    });
    res.json({ count: rows.length, percent: body.percent });
  }),
);

databankRouter.post(
  "/convert",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await requireRateAnalysis(req.orgId!);
    const body = z.object({
      toCurrency: z.string().trim().min(3).max(8),
      fxRate: z.number().positive(),
    }).parse(req.body);
    const currency = body.toCurrency.toUpperCase();
    const rows = await Resource.find({ orgId: req.orgId });
    for (const row of rows) {
      const next = Math.round(n(row.rate) * body.fxRate * 100) / 100;
      row.rate = String(next);
      row.rateValue = next;
      row.currency = currency;
      row.updatedById = req.userId ?? null;
      await row.save();
    }
    await Organization.updateOne(
      { _id: req.orgId },
      { $set: { databankCurrency: currency }, $inc: { databankVersion: 1 } },
    );
    await Project.updateMany(
      { orgId: req.orgId },
      { $set: { databankCurrency: currency, fxRate: 1 } },
    );
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "databank.converted",
      ip: req.ip,
      data: { toCurrency: currency, fxRate: body.fxRate, count: rows.length },
    });
    res.json({ count: rows.length, currency, fxRate: 1 });
  }),
);

databankRouter.post(
  "/reset-defaults",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await requireRateAnalysis(req.orgId!);
    const count = await seedOrgDatabank(req.orgId!, { replace: true });
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "databank.reset",
      ip: req.ip,
      data: { count },
    });
    res.json({ reset: true, count });
  }),
);

databankRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await requireRateAnalysis(req.orgId!);
    const body = resourceBody.parse(req.body);
    const row = await Resource.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!row) throw notFound("Resource not found.");
    if (body.code) row.code = body.code.trim();
    if (body.category) row.category = parseCategory(body.category);
    if (body.name) row.name = body.name;
    if (body.unit) row.unit = body.unit;
    if (body.rate != null) {
      const rates = rateFields(body.rate);
      row.rate = rates.rate;
      row.rateValue = rates.rateValue;
    }
    if (body.note !== undefined) row.note = body.note;
    row.updatedById = req.userId ?? null;
    try {
      await row.save();
    } catch (error) {
      if (isDuplicate(error)) throw conflict(`Resource ${row.code} already exists.`);
      throw error;
    }
    await bumpDatabank(req.orgId!);
    res.json(serializeResource(row.toObject()));
  }),
);

databankRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(async (req, res) => {
    await requireRateAnalysis(req.orgId!);
    const row = await Resource.findOneAndDelete({ _id: req.params.id, orgId: req.orgId });
    if (!row) throw notFound("Resource not found.");
    await bumpDatabank(req.orgId!);
    await writeAudit({
      orgId: req.orgId,
      actorId: req.userId,
      action: "databank.deleted",
      target: row.id,
      ip: req.ip,
      data: { code: row.code },
    });
    res.status(204).end();
  }),
);
