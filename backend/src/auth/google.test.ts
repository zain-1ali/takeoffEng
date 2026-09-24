import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnv } from "../config/env.js";
import { defaultOrgName, googleProfileFromIdToken } from "./google.js";

describe("google auth helpers", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "gid.apps.googleusercontent.com";
    resetEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GOOGLE_CLIENT_ID;
    resetEnv();
  });

  it("builds a workspace name from the Google profile", () => {
    expect(defaultOrgName("Ada Owner", "ada@example.com")).toBe("Ada Owner's workspace");
  });

  it("accepts a verified Google ID token for this client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            aud: "gid.apps.googleusercontent.com",
            sub: "sub_1",
            email: "Ada@example.com",
            email_verified: "true",
            name: "Ada",
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(googleProfileFromIdToken("tok")).resolves.toEqual({
      sub: "sub_1",
      email: "ada@example.com",
      name: "Ada",
    });
  });

  it("rejects a token issued for a different client", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            iss: "https://accounts.google.com",
            aud: "other-client",
            sub: "sub_1",
            email: "ada@example.com",
            email_verified: true,
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(googleProfileFromIdToken("tok")).rejects.toMatchObject({ status: 401 });
  });
});
