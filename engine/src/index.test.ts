import { describe, expect, it } from "vitest";
import { ENGINE_VERSION, ping } from "./index";

describe("engine scaffold", () => {
  it("exports a version and ping", () => {
    expect(ENGINE_VERSION).toBe("0.2.0");
    expect(ping()).toBe("takeoff-engine");
  });
});
