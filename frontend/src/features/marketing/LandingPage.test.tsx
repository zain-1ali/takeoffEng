/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage.js";
import { PricingSection } from "./PricingSection.js";

vi.mock("../editor/useComputed.js", () => ({
  useComputed: () => ({
    result: null,
    boq: { bills: [], items: [] },
    bom: null,
    totals: { total: 248000, concrete: 86, steelKg: 12400 },
    params: [],
    status: "ready",
    error: null,
  }),
}));

vi.mock("../auth/AuthProvider.js", () => ({
  useAuth: () => ({
    ready: true,
    user: null,
    orgId: null,
    orgName: null,
    plan: "STARTER",
    entitlements: null,
    token: null,
    setSession: vi.fn(),
    logout: vi.fn(),
    refreshMe: vi.fn(),
  }),
}));

describe("marketing", () => {
  it("renders the landing headline and project types", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", {
        name: /From drawings to a priced, charted bill of quantities/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roads" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/legal/privacy");
  });

  it("toggles annual pricing", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <PricingSection />
      </MemoryRouter>,
    );
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
  });
});
