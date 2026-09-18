/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "./DashboardScreen.js";
import { BbsScreen } from "./BbsScreen.js";
import { BoqScreen } from "./BoqScreen.js";

const { setPath, doc, result, computed } = vi.hoisted(() => {
  const setPath = vi.fn();
  const doc = {
    btype: "multi",
    project: { name: "Phase 9 test", location: "Kigali", currency: "USD", stage: "Pre-tender estimate", by: "QS" },
    report: { cont: 5, vat: 18, taxName: "VAT" },
    rates: {},
    ui: { bbsEl: "", bbsLv: "", dimLoc: "" },
    pl: {},
    levels: [{ name: "Ground floor" }],
  };
  const boq = {
    rows: [
      { sec: "Concrete work" },
      { item: "A", code: "CPAD", desc: "Concrete in pad footings", unit: "m³" as const, quantity: 10, rate: 120, amount: 1200 },
    ],
    items: [
      { item: "A", code: "CPAD", desc: "Concrete in pad footings", unit: "m³" as const, quantity: 10, rate: 120, amount: 1200, manualRate: undefined },
    ],
    bills: [{ title: "Concrete work", amount: 1200, itemCount: 1 }],
    subtotal: 1200,
    contingency: 60,
    tax: 226.8,
    total: 1486.8,
  };
  const result = {
    items: [{ loc: "Foundations", lvl: -1, el: "Foundations", code: "CPAD", times: 4, d1: 1.8, d2: 1.8, d3: 0.5, q: 6.48 }],
    bars: [{ loc: "Foundations / F1", lvl: -1, el: "Foundations", member: "F1", mark: "01", shape: "11", dia: 12, members: 4, each: 8, len: 2.1, total: 67.2, kg: 59.8 }],
    tot: { EXC1: 12, BFL: 2, DSP: 1, CPAD: 6.48 },
    concrete: 6.48,
    steelKg: 59.8,
    formwork: 8,
    floorArea: 40,
    levels: [{ name: "Ground floor" }],
    warn: [],
  };
  return {
    setPath,
    doc,
    result,
    computed: {
      result,
      boq,
      bom: [{ sec: "Concrete" }, { code: "CEM", material: "Cement", specification: "50 kg bags", unit: "bags", net: 40, waste: 5, order: 42, displayDecimals: 0, orderDecimals: 0, rate: 10, amount: 420 }],
      totals: { concrete: 6.48, steelKg: 59.8, formwork: 8, floorArea: 40, itemCount: 1, barCount: 1, subtotal: 1200, contingency: 60, tax: 226.8, total: 1486.8 },
      params: [["Project type", "Multi-storey"], ["Currency", "USD"]] as [string, string][],
      split: [{ label: "Labour", value: 400, color: "var(--ink)" }, { label: "Material", value: 800, color: "var(--steel)" }],
      status: "ready" as const,
      error: null,
    },
  };
});

vi.mock("../ProjectProvider.js", () => ({
  useProject: () => ({ doc, meta: { name: "Phase 9 test", currency: "USD", stage: "PRE_TENDER" }, setPath }),
  asFullProject: (value: unknown) => value,
}));

vi.mock("../computed.js", () => ({
  useEditorComputed: () => computed,
}));

describe("Phase 9 report screens", () => {
  it("renders dashboard KPIs and charts", () => {
    render(
      <MemoryRouter>
        <DashboardScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/Total including contingency/i)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Donut chart" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Reinforcement ratios" })).toBeInTheDocument();
  });

  it("renders the bills of quantities cover and a bill", () => {
    render(
      <MemoryRouter>
        <BoqScreen />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Bills of quantities").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByText(/Total carried to form of tender/)).toBeInTheDocument();
    expect(screen.getByText(/Bill No. 1 – Concrete work/)).toBeInTheDocument();
  });

  it("filters the bar schedule", async () => {
    const user = userEvent.setup();
    render(<BbsScreen />);
    expect(screen.getByRole("heading", { name: "Bar schedule" })).toBeInTheDocument();
    expect(screen.getByText("01")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Element"), "Foundations");
    expect(setPath).toHaveBeenCalledWith("ui.bbsEl", "Foundations");
  });
});
