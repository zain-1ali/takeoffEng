import { afterEach, describe, expect, it } from "vitest";
import { resetEnv } from "../config/env.js";
import { resetMailer, sendInviteEmail, sendMagicLinkEmail, sendMail } from "./mailer.js";

describe("mailer", () => {
  afterEach(() => {
    resetMailer();
    resetEnv();
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

  it("builds a magic-link message with the verify URL", async () => {
    await expect(
      sendMagicLinkEmail({
        to: "qs@example.com",
        name: "Ada",
        verifyUrl: "http://localhost:5173/verify?token=abc",
      }),
    ).resolves.toBeUndefined();
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
