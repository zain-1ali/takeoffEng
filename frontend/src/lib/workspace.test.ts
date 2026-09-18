import { describe, expect, it } from "vitest";
import { isAllowedType, STARTER_TYPES } from "./catalog.js";
import { relativeTime } from "./format.js";

describe("workspace helpers", () => {
  it("gates Starter types", () => {
    expect(isAllowedType("SINGLE", STARTER_TYPES)).toBe(true);
    expect(isAllowedType("BRIDGE", STARTER_TYPES)).toBe(false);
    expect(isAllowedType("ROAD", ["FOUNDATION", "SINGLE", "MULTI", "ROAD", "BRIDGE"])).toBe(true);
  });

  it("formats a relative timestamp", () => {
    const now = Date.parse("2026-09-18T12:00:00Z");
    expect(relativeTime("2026-09-18T11:50:00Z", now)).toBe("10 min ago");
    expect(relativeTime("2026-09-18T11:59:30Z", now)).toBe("just now");
  });
});
