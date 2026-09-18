import { Router } from "express";
import { n, type NumericInput } from "@takeoff/engine";
import { z } from "zod";
import { entitlementsFor } from "../billing/plans.js";
import { asyncHandler } from "../common/async-handler.js";
import { notFound, upgradeRequired } from "../common/problem.js";
import { requireRole } from "../middleware/org.js";
import { CustomRate, ManualRate, RateSettings, Subscription } from "../models/index.js";
import { requireProject } from "./access.js";
import { recipeLinesFrom } from "./syncRates.js";

async function requireRateAnalysis(orgId: string): Promise<void> {
  const subscription = await Subscription.findOne({ orgId }).lean();
  const entitlements = entitlementsFor(subscription?.plan);
  if (!entitlements.rateAnalysis) {
    throw upgradeRequired("rateAnalysis", entitlements.plan, "PROFESSIONAL");
  }
}

const settingsBody = z.object({
  toolsPct: z.number().min(0).max(100).optional(),
  overheadPct: z.number().min(0).max(100).optional(),
  profitPct: z.number().min(0).max(100).optional(),
});

function settingsJson(row: { toolsPct?: number; overheadPct?: number; profitPct?: number; version?: number } | null) {
  return {
    toolsPct: row?.toolsPct ?? 3,
    overheadPct: row?.overheadPct ?? 10,
    profitPct: row?.profitPct ?? 10,
    version: row?.version ?? 1,
  };
}

export function registerProjectRateRoutes(router: Router): void {
  router.get(
    "/:id/rate-settings",
    requireProject,
    asyncHandler(async (req, res) => {
      const row = await RateSettings.findById(req.project!.id).lean();
      res.json(settingsJson(row));
    }),
  );

  router.patch(
    "/:id/rate-settings",
    requireProject,
    requireRole("EDITOR"),
    asyncHandler(async (req, res) => {
      await requireRateAnalysis(req.orgId!);
      const body = settingsBody.parse(req.body);
      const row = await RateSettings.findByIdAndUpdate(
        req.project!.id,
        {
          $set: body,
          $inc: { version: 1 },
          $setOnInsert: { _id: req.project!.id },
        },
        { upsert: true, returnDocument: "after" },
      );
      res.json(settingsJson(row));
    }),
  );

  router.get(
    "/:id/rates",
    requireProject,
    asyncHandler(async (req, res) => {
      const [custom, manuals, settings] = await Promise.all([
        CustomRate.find({ projectId: req.project!.id }).lean(),
        ManualRate.find({ projectId: req.project!.id }).lean(),
        RateSettings.findById(req.project!.id).lean(),
      ]);
      res.json({
        settings: settingsJson(settings),
        custom: Object.fromEntries(custom.map((row) => [row.itemCode, { lines: row.lines }])),
        manuals: manuals.map((row) => ({
          itemCode: row.itemCode,
          kind: row.kind,
          rate: row.rate,
          rateValue: row.rateValue,
        })),
      });
    }),
  );

  router.put(
    "/:id/rates/:code/manual",
    requireProject,
    requireRole("EDITOR"),
    asyncHandler(async (req, res) => {
      await requireRateAnalysis(req.orgId!);
      const query = z.object({ kind: z.enum(["BOQ", "BOM"]).optional() }).parse(req.query);
      const body = z.object({ rate: z.union([z.string(), z.number()]) }).parse(req.body);
      const kind = query.kind ?? "BOQ";
      const rate = String(body.rate);
      const rateValue = n(rate as NumericInput);
      const row = await ManualRate.findOneAndUpdate(
        { projectId: req.project!.id, itemCode: req.params.code, kind },
        { $set: { rate, rateValue, updatedById: req.userId! } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      res.json({ itemCode: row!.itemCode, kind: row!.kind, rate: row!.rate, rateValue: row!.rateValue });
    }),
  );

  router.delete(
    "/:id/rates/:code/manual",
    requireProject,
    requireRole("EDITOR"),
    asyncHandler(async (req, res) => {
      await requireRateAnalysis(req.orgId!);
      const query = z.object({ kind: z.enum(["BOQ", "BOM"]).optional() }).parse(req.query);
      await ManualRate.deleteOne({
        projectId: req.project!.id,
        itemCode: req.params.code,
        kind: query.kind ?? "BOQ",
      });
      res.status(204).end();
    }),
  );

  router.put(
    "/:id/rates/:code",
    requireProject,
    requireRole("EDITOR"),
    asyncHandler(async (req, res) => {
      await requireRateAnalysis(req.orgId!);
      const body = z.object({
        lines: z.array(z.record(z.string(), z.unknown())),
      }).parse(req.body);
      const lines = recipeLinesFrom(body.lines);
      const row = await CustomRate.findOneAndUpdate(
        { projectId: req.project!.id, itemCode: req.params.code },
        { $set: { lines, updatedById: req.userId! } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      res.json({ itemCode: row!.itemCode, lines: row!.lines });
    }),
  );

  router.delete(
    "/:id/rates/:code",
    requireProject,
    requireRole("EDITOR"),
    asyncHandler(async (req, res) => {
      await requireRateAnalysis(req.orgId!);
      const deleted = await CustomRate.findOneAndDelete({
        projectId: req.project!.id,
        itemCode: req.params.code,
      });
      if (!deleted) throw notFound("Custom rate not found.");
      res.status(204).end();
    }),
  );
}
