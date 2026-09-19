import { afterEach, describe, expect, it } from "vitest";
import { resetEnv } from "./env.js";
import { allowedOrigins, isAllowedOrigin } from "./origins.js";

describe("cors origins", () => {
  afterEach(() => {
    delete process.env.CLIENT_URL;
    delete process.env.WEB_URL;
    delete process.env.NODE_ENV;
    resetEnv();
  });

  it("accepts comma-separated production origins", () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_URL = "https://app.netlify.app";
    process.env.WEB_URL = "https://app.netlify.app,https://www.example.com/";
    resetEnv();
    expect(allowedOrigins()).toEqual([
      "https://app.netlify.app",
      "https://app.netlify.app",
      "https://www.example.com",
    ]);
    expect(isAllowedOrigin("https://app.netlify.app")).toBe(true);
    expect(isAllowedOrigin("https://www.example.com")).toBe(true);
    expect(isAllowedOrigin("https://other.example")).toBe(false);
  });
});
