import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./passwords.js";

describe("passwords", () => {
  it("hashes and verifies a password", async () => {
    const stored = await hashPassword("password1");
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    await expect(verifyPassword("password1", stored)).resolves.toBe(true);
    await expect(verifyPassword("password2", stored)).resolves.toBe(false);
  });
});
