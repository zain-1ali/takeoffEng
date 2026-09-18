/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacePage } from "./WorkspacePage.js";

vi.mock("../auth/AuthProvider.js", () => ({
  useAuth: () => ({
    ready: true,
    user: { id: "u1", email: "qs@example.com", name: "Ada" },
    orgId: "org1",
    orgName: "Ada QS",
    plan: "STARTER",
    entitlements: { types: ["FOUNDATION", "SINGLE"], maxProjects: 1, bom: false, rateAnalysis: false, collaboration: false },
    token: "tok",
    setSession: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
  }),
}));

describe("workspace grid", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ projects: [], nextCursor: null }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("shows an empty workspace and a new project action", async () => {
    render(
      <MemoryRouter>
        <WorkspacePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New project" }).length).toBeGreaterThan(0);
  });
});
