import { describe, expect, it, vi } from "vitest";
import { api, apiUrl, ApiError } from "./api.js";

describe("api client", () => {
  it("prefixes VITE_API_URL when set", () => {
    const url = apiUrl("/v1/auth/magic-link");
    const base = String(import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
    expect(url).toBe(base ? `${base}/v1/auth/magic-link` : "/v1/auth/magic-link");
    expect(url.endsWith("/v1/auth/magic-link")).toBe(true);
  });

  it("surfaces problem details from failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Invalid email" }), { status: 400 })),
    );
    await expect(api("/v1/auth/magic-link", { body: { email: "bad" } })).rejects.toMatchObject({
      name: "ApiError",
      message: "Invalid email",
      status: 400,
    } satisfies Partial<ApiError>);
  });
});
