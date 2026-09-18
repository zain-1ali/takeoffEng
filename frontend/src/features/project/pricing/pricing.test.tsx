/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RatesScreen } from "./RatesScreen.js";
import { ResourcesScreen } from "./ResourcesScreen.js";

const { setPath, replaceDoc, patch, create } = vi.hoisted(() => ({
  setPath: vi.fn(),
  replaceDoc: vi.fn(),
  patch: vi.fn(),
  create: vi.fn(),
}));

const doc = {
  project: { currency: "USD", numfmt: "en-GB" },
  rates: {},
  ra: { tools: 3, oh: 10, profit: 10, custom: {}, market: "Starter prices" },
  ui: { raQ: "", raSel: "CPAD", resQ: "", resCat: "All" },
  report: { taxName: "VAT" },
};

const boq = {
  rows: [
    { sec: "Concrete work" },
    { item: "A", code: "CPAD", desc: "Concrete in pad footings", unit: "m³" as const, quantity: 10, rate: 120, amount: 1200, manualRate: undefined },
  ],
  items: [
    { item: "A", code: "CPAD", desc: "Concrete in pad footings", unit: "m³" as const, quantity: 10, rate: 120, amount: 1200, manualRate: undefined },
  ],
  bills: [{ title: "Concrete work", amount: 1200, itemCount: 1 }],
  subtotal: 1200,
  contingency: 60,
  tax: 0,
  total: 1260,
};

vi.mock("../../auth/AuthProvider.js", () => ({
  useAuth: () => ({
    entitlements: { rateAnalysis: true, bom: true, types: ["FOUNDATION"], maxProjects: null, collaboration: false },
    plan: "PROFESSIONAL",
  }),
}));

vi.mock("../ProjectProvider.js", () => ({
  useProject: () => ({ doc, meta: { name: "Phase 10", currency: "USD" }, setPath, replaceDoc }),
}));

vi.mock("../computed.js", () => ({
  useEditorComputed: () => ({
    boq,
    split: [{ label: "Labour", value: 400 }, { label: "Material", value: 800 }],
    status: "ready",
    error: null,
    result: null,
    bom: null,
    totals: null,
    params: [],
  }),
  usePricedProject: () => ({ btype: "foundation", grades: { blind: "C15", found: "C25", frame: "C30", civil: "C25", bridge: "C40" } }),
}));

vi.mock("./DatabankProvider.js", () => ({
  useDatabank: () => ({
    resources: [
      { id: "1", code: "L01", category: "LABOUR", name: "Mason", unit: "h", rate: "4.5", rateValue: 4.5, currency: "USD", note: "" },
      { id: "2", code: "M01", category: "MATERIAL", name: "Cement", unit: "bag", rate: "8", rateValue: 8, currency: "USD", note: "" },
    ],
    engineResources: [],
    currency: "USD",
    priceBasis: "Starter prices",
    version: 1,
    status: "ready",
    error: null,
    reload: vi.fn(),
    create,
    patch,
    remove: vi.fn(),
    adjust: vi.fn(),
    convert: vi.fn(),
    importCsv: vi.fn(),
  }),
  useOptionalDatabank: () => null,
}));

describe("Phase 10 pricing screens", () => {
  it("renders rate analysis KPIs and the selected item", () => {
    render(
      <MemoryRouter>
        <RatesScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Rate analysis" })).toBeInTheDocument();
    expect(screen.getByText("1 / 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Concrete in pad footings/ })).toBeInTheDocument();
    expect(screen.getAllByText("Standard").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Concrete in pad footings/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add resource" })).toBeInTheDocument();
  });

  it("renders the resource databank table", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResourcesScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Resource databank" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mason")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    expect(create).toHaveBeenCalled();
  });
});
