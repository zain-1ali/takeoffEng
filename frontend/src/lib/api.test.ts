import { describe, expect, it, vi } from "vitest";
import { api, apiUrl, ApiError } from "./api.js";

describe("api client", () => {
  it("uses a relative API path during local development", () => {
    expect(apiUrl("/v1/auth/login")).toBe("/v1/auth/login");
  });

  it("surfaces problem details from failed responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "Invalid email" }), { status: 400 })),
    );
    await expect(api("/v1/auth/login", { body: { email: "bad" } })).rejects.toMatchObject({
      name: "ApiError",
      message: "Invalid email",
      status: 400,
    } satisfies Partial<ApiError>);
  });
});
