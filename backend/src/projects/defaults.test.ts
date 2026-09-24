import { describe, expect, it } from "vitest";
import { compute } from "@takeoff/engine";
import { initialStateJson } from "./defaults.js";

describe("new project seed", () => {
  it.each(["FOUNDATION", "SINGLE", "MULTI", "ROAD", "BRIDGE"] as const)(
    "starts %s with zero quantities",
    (type) => {
      const state = initialStateJson(type, {
        name: "Blank take-off",
        currency: "USD",
        numberLocale: "en-GB",
      });
      const result = compute(state as Parameters<typeof compute>[0]);
      expect(result.concrete).toBe(0);
      expect(result.steelKg).toBe(0);
      expect(result.formwork).toBe(0);
      expect(result.floorArea).toBe(0);
      expect(result.items).toEqual([]);
    },
  );
});
