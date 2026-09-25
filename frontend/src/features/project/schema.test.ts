import { describe, expect, it } from "vitest";
import { asList, asRecord, type DocMap } from "../../lib/doc.js";
import {
  LATER,
  addType,
  copyUp,
  deleteType,
  duplicateType,
  ensureRoofX,
  kindsVisible,
  resetToExample,
  TYPE_SCHEMA,
  typeSummary,
  visibleInputSteps,
} from "./schema.js";

function sampleDoc(): DocMap {
  return {
    btype: "multi",
    ui: { sel: { pad: 0, column: 0 } },
    levels: [
      { id: "l0", name: "Ground floor", h: 4, zone: 0.2 },
      { id: "l1", name: "First floor", h: 3.3, zone: 0.2 },
    ],
    types: {
      pad: [{ id: "F1", mark: "F1", L: 1.8, W: 1.8, D: 0.5 }],
      column: [{ id: "C1", mark: "C1", b: 400, d: 400 }],
    },
    pl: {
      pad: [],
      column: [{ id: "p1", type: "C1", level: "l0", no: 4 }],
    },
  };
}

describe("kindsVisible", () => {
  it("filters building and civil steps", () => {
    expect(kindsVisible("foundation")).toEqual(["pad", "strip", "gbeam"]);
    expect(kindsVisible("single")).toContain("column");
    expect(kindsVisible("single")).not.toContain("stair");
    expect(kindsVisible("multi")).toContain("stair");
    expect(kindsVisible("road")).toEqual(["rpave", "rdrain", "rculv"]);
    expect(kindsVisible("bridge")).toEqual(["bfoot", "bpier", "bwall", "bbeam", "bslab"]);
  });

  it("keeps project and rules on every type", () => {
    const views = visibleInputSteps("foundation").map(([view]) => view);
    expect(views[0]).toBe("project");
    expect(views).toContain("rules");
    expect(views).not.toContain("levels");
    expect(visibleInputSteps("multi").map(([view]) => view)).toContain("levels");
  });

  it("includes roofing and civil accessory steps", () => {
    expect(visibleInputSteps("multi").map(([view]) => view)).toContain("roof");
    expect(visibleInputSteps("road").map(([view]) => view)).toEqual([
      "project", "rpave", "rdrain", "rculv", "rfurn", "rules",
    ]);
    expect(visibleInputSteps("bridge").map(([view]) => view)).toContain("bacc");
  });

  it("has no leftover later-phase screens after team workspace", () => {
    expect(Object.keys(LATER)).toEqual([]);
  });
});

describe("type mutations", () => {
  it("addType selects the new chip", () => {
    const { doc, index } = addType(sampleDoc(), "pad", 0);
    expect(index).toBe(1);
    expect(asRecord(asRecord(doc.ui).sel).pad).toBe(1);
    expect(asList(asRecord(doc.types).pad)).toHaveLength(2);
    expect(asList(asRecord(doc.types).pad)[1]?.mark).toBe("F2");
  });

  it("duplicateType inserts after the selection", () => {
    const { doc, index } = duplicateType(sampleDoc(), "pad", 0);
    expect(index).toBe(1);
    expect(asRecord(asRecord(doc.ui).sel).pad).toBe(1);
    expect(asList(asRecord(doc.types).pad)[1]?.mark).toBe("F1a");
  });

  it("deleteType drops matching rows and moves the selection", () => {
    const { doc, index } = deleteType(sampleDoc(), "column", 0);
    expect(index).toBe(0);
    expect(asList(asRecord(doc.types).column)).toHaveLength(0);
    expect(asList(asRecord(doc.pl).column)).toHaveLength(0);
  });

  it("copyUp replaces rows on levels above", () => {
    const next = copyUp(sampleDoc(), "column", "l0");
    expect(next).not.toBeNull();
    const rows = asList(asRecord(next!.pl).column);
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.level === "l1")).toBe(true);
    expect(rows.some((row) => row.level === "l0")).toBe(true);
  });
});

describe("roofing schema", () => {
  it("defines roof type and placement fields", () => {
    expect(TYPE_SCHEMA.roof?.length).toBe(3);
    expect(typeSummary("roof", {
      form: "Pitched – hip",
      cover: "Pre-painted IT4 iron sheets",
      pitch: 22.5,
    })).toBe("hip · Pre-painted IT4 sheets · 22.5°");
  });

  it("fills missing complex-roof tables", () => {
    const next = ensureRoofX({ types: { roof: [{ id: "r1", mark: "RF1" }] } });
    const roofx = asRecord(next.roofx);
    expect(asList(roofx.planes).length).toBeGreaterThan(0);
    expect(asList(roofx.lines).length).toBeGreaterThan(0);
  });

  it("resetToExample keeps the project name and current type", () => {
    const next = resetToExample({
      btype: "multi",
      project: { name: "Clinic annex", currency: "KES", numfmt: "en-GB" },
    });
    expect(next.btype).toBe("multi");
    expect(asRecord(next.project).name).toBe("Clinic annex");
    expect(asList(asRecord(next.types).roof).length).toBeGreaterThan(0);
    expect(next.roofMode).toBe("simple");
    expect(asRecord(next.mat).concWaste).toBe(5);
  });
});
