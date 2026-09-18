import { describe, expect, it } from "vitest";
import { civilCatalogue } from "./civil-catalogue";
import {
  computeCivil,
  createBridgeDefaults,
  createRoadDefaults,
} from "./civil";

describe("Phase 2 civil engine", () => {
  it("matches the prototype 2.0 km road formulas", () => {
    const project = createRoadDefaults();
    const result = computeCivil(project);

    expect(project.pl.rpave.map(({ id }) => id)).toEqual([
      "road-section-1",
      "road-section-2",
      "road-section-3",
    ]);
    expect(result.tot.CLR).toBe(40_000);
    expect(result.tot.TOPR).toBe(3_936);
    expect(result.tot.RCUT).toBe(8_832);
    expect(result.tot.RFILL).toBe(11_712);
    expect(result.tot.RCUTFILL).toBe(8_832);
    expect(result.tot.RBORROW).toBe(2_880);
    expect(result.tot.RSPOIL).toBeUndefined();
    expect(result.tot.ACW50).toBe(14_000);
    expect(result.tot.RMARK).toBe(6_000);
    expect(result.tot.PIPE900).toBe(72);
    expect(result.tot.PIPE600).toBe(50);
    expect(result.tot.CDRN).toBeCloseTo(310.66252584);
    expect(result.tot.RCULV12).toBeCloseTo(1_139.92601726);
    expect(result.warn).toEqual([]);
  });

  it("matches the prototype three-span bridge formulas", () => {
    const project = createBridgeDefaults();
    const result = computeCivil(project);

    expect(project.pl.bbeam.slice(0, 3).map(({ id, span }) => [id, span]))
      .toEqual([
        ["bridge-beam-placement-1", 15],
        ["bridge-beam-placement-2", 20],
        ["bridge-beam-placement-3", 15],
      ]);
    expect(result.tot.CBFT).toBeCloseTo(189.2);
    expect(result.tot.CPIER).toBeCloseTo(19.44);
    expect(result.tot.CGIRD).toBeCloseTo(120);
    expect(result.tot.CDECK).toBeCloseTo(115.5);
    expect(result.tot.CAPPR).toBeCloseTo(37.8);
    expect(result.tot.FDECK).toBe(525);
    expect(result.tot.BRG).toBe(30);
    expect(result.concrete).toBeCloseTo(630.104);
    expect(result.steelKg).toBeCloseTo(67_973.80389642);
    expect(result.formwork).toBeCloseTo(2_213.14);
    expect(result.warn).toEqual([]);
  });

  it("preserves prototype gating and catalogue quirks", () => {
    const road = createRoadDefaults();
    const pavementOnly = computeCivil(road, { kinds: ["rpave"] });
    expect(pavementOnly.tot.EXCD).toBeUndefined();
    expect(pavementOnly.tot.KERB).toBe(1_600);

    const bridge = createBridgeDefaults();
    const accessoriesOnly = computeCivil(bridge, { kinds: [] });
    expect(accessoriesOnly.tot.CBFT).toBeUndefined();
    expect(accessoriesOnly.tot.BRG).toBe(30);

    const roadCatalogue = civilCatalogue(road);
    expect(roadCatalogue.find(({ code }) => code === "BLD")?.sec)
      .toBe("Road – drainage and culverts");
    expect(roadCatalogue.find(({ code }) => code === "ACW50")?.unit)
      .toBe("m²");

    const bridgeCatalogue = civilCatalogue(bridge);
    expect(bridgeCatalogue.find(({ code }) => code === "BLD")?.sec)
      .toBe("Bridge – foundations");
    expect(bridgeCatalogue.find(({ code }) => code === "SURF")?.desc)
      .toContain("50 mm");
  });
});
