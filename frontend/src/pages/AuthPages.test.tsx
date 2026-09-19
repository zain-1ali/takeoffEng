/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage, SignupPage } from "./AuthPages.js";

const auth = {
  ready: true,
  user: null as { id: string; email: string; name: string } | null,
  orgId: null as string | null,
  orgName: null as string | null,
  plan: "STARTER",
  entitlements: null,
  token: null as string | null,
  setSession: vi.fn(),
  logout: vi.fn(),
  refreshMe: vi.fn(),
};

vi.mock("../features/auth/AuthProvider.js", () => ({
  useAuth: () => auth,
}));

describe("auth screens", () => {
  beforeEach(() => {
    auth.user = null;
    auth.token = null;
    auth.setSession.mockResolvedValue(undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ accessToken: "tok_1" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
  });

  it("signs in with email and password", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Email"), "qs@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(auth.setSession).toHaveBeenCalledWith("tok_1");
    expect(fetch).toHaveBeenCalledWith(
      "/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "qs@example.com", password: "password1" }),
      }),
    );
  });

  it("creates a workspace with email and password", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText("Your name"), "Ada");
    await user.type(screen.getByLabelText("Organisation"), "Ada QS");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "password1");
    await user.click(screen.getByRole("button", { name: "Create workspace" }));
    expect(auth.setSession).toHaveBeenCalledWith("tok_1");
    expect(fetch).toHaveBeenCalledWith(
      "/v1/auth/signup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "ada@example.com",
          password: "password1",
          name: "Ada",
          orgName: "Ada QS",
        }),
      }),
    );
  });
});
