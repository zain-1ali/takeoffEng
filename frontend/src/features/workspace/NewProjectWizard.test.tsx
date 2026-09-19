/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewProjectWizard } from "./NewProjectWizard.js";

const auth = {
  ready: true,
  user: { id: "u1", email: "qs@example.com", name: "Ada" },
  orgId: "org1",
  orgName: "Ada QS",
  plan: "STARTER",
  entitlements: {
    types: ["FOUNDATION", "SINGLE"],
    maxProjects: 1,
    bom: false,
    rateAnalysis: false,
    collaboration: false,
  },
  token: "tok",
  setSession: vi.fn(),
  logout: vi.fn(),
  refreshMe: vi.fn(),
};

vi.mock("../auth/AuthProvider.js", () => ({
  useAuth: () => auth,
}));

describe("new project wizard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("locks Professional types on Starter and continues with a single-storey job", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NewProjectWizard />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /Multi-storey/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Road/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Concrete bridge/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Single storey/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Currency")).toBeInTheDocument();
  });

  it("creates the project then patches cover fields", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/v1/projects") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "p1", name: "Kigali clinic" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/v1/projects/p1/settings")) {
        return new Response(JSON.stringify({ id: "p1" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <NewProjectWizard />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(screen.getByLabelText("Project name"), "Kigali clinic");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/projects$/),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"buildingType\":\"SINGLE\""),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/projects\/p1\/settings$/),
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("NRM2"),
      }),
    );
  });
});
