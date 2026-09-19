import { afterEach, describe, expect, it, vi } from "vitest";
import { resetEnv } from "../config/env.js";
import { resetMailer, sendInviteEmail, sendMail } from "./mailer.js";

describe("mailer", () => {
  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    resetMailer();
    resetEnv();
    vi.unstubAllGlobals();
  });

  it("sends through nodemailer in test (json transport)", async () => {
    const result = await sendMail({
      to: "qs@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    });
    expect(result.delivered).toBe(true);
  });

  it("sends through Resend over HTTPS when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test";
    resetEnv();
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await sendMail({
      to: "qs@example.com",
      subject: "Test",
      text: "Hello",
      html: "<p>Hello</p>",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("builds an invitation message with the accept URL", async () => {
    await expect(
      sendInviteEmail({
        to: "editor@example.com",
        orgName: "Ada QS",
        role: "EDITOR",
        acceptUrl: "http://localhost:5173/invite/token",
      }),
    ).resolves.toBeUndefined();
  });
});
