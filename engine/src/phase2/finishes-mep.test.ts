import { describe, expect, it } from "vitest";
import type { MeasuredItem, TypeStats } from "../types";
import {
  computeFinishes,
  computeMEP,
  createFinishesDefaults,
  createMEPDefaults,
} from "./finishes-mep";
import type {
  Phase2ComputeOptions,
  Phase2MeasureContext,
  Phase2Project,
} from "./finishes-mep-types";

const levels = [{ id: "L1", name: "Ground floor", h: 3.6, zone: 0.45 }];

function ids(): () => string {
  let value = 0;
  return () => `id-${++value}`;
}

function harness(
  project: Phase2Project,
  kinds: readonly string[],
): { options: Phase2ComputeOptions; items: MeasuredItem[]; bars: string[] } {
  const items: MeasuredItem[] = [];
  const bars: string[] = [];
  const byType: Record<string, TypeStats> = {};
  const options: Phase2ComputeOptions = {
    project,
    levels,
    levelIndex: new Map([["L1", 0]]),
    kinds,
    warn: [],
    byType,
    add: (context, code, times, d1, d2, d3) => {
      const q = times * (d1 ?? 1) * (d2 ?? 1) * (d3 ?? 1);
      if (!Number.isFinite(q) || Math.abs(q) < 1e-9) return;
      items.push({ ...context, code, times, d1, d2, d3, q });
    },
    bar: (
      _context: Phase2MeasureContext,
      shape,
      diameter,
      each,
      length,
    ) => {
      bars.push(`${shape}:${diameter}:${each}:${length}`);
    },
    nB: (width, spacing) =>
      width > 0 && Number(spacing) > 0
        ? Math.ceil(width / (Number(spacing) / 1_000) - 1e-9) + 1
        : 0,
  };
  return { options, items, bars };
}

describe("Phase 2 finishes and MEP", () => {
  it("ports masonry, face finishes, lintels and room finishes", () => {
    const defaults = createFinishesDefaults(levels, ids());
    const test = harness(
      { types: defaults.types, pl: defaults.placements },
      ["masonry"],
    );

    computeFinishes(test.options);
    const totals: Record<string, number> = {};
    for (const item of test.items) {
      totals[item.code] = (totals[item.code] ?? 0) + item.q;
    }

    expect(totals.MASHB200E).toBeCloseTo(248.1);
    expect(test.items.some(({ code }) => code === "DPC200")).toBe(true);
    expect(test.items.some(({ code }) => code === "WTILE_WF3")).toBe(true);
    expect(test.items.some(({ code }) => code === "CSUS_CF1")).toBe(true);
    expect(test.bars).toContain("Straight + anchorage:12:2:2.05");
    expect(totals.SCR40).toBe(470);
  });

  it("ports MEP quantities and preserves prototype gates", () => {
    const defaults = createMEPDefaults(levels, ids());
    const project = { types: defaults.types, pl: defaults.placements };
    const gated = harness(project, []);
    computeMEP(gated.options);
    expect(gated.items).toHaveLength(0);

    const test = harness(project, ["elec"]);
    computeMEP(test.options);
    expect(test.items.some(({ code, q }) => code === "EL_LP1" && q === 40))
      .toBe(true);
    expect(test.items.some(({ code, q }) => code === "PPRH20" && q === 18))
      .toBe(true);
    expect(test.items.some(({ code, q }) => code === "PL_UGD" && q === 120))
      .toBe(true);
  });
});
