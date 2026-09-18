/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { TypeDrawing } from "./TypeDrawing.js";

const rules = {
  ws: 0.3,
  wsOn: true,
  blinding: 50,
  cF: 50,
  cC: 40,
  cB: 30,
  cS: 25,
  cW: 30,
};

describe("TypeDrawing", () => {
  it("renders a pad footing section", () => {
    render(
      <TypeDrawing
        kind="pad"
        type={{ mark: "F1", L: 1.8, W: 1.8, D: 0.5, depth: 1.5, sb: 400, sh: 0.95 }}
        rules={rules}
      />,
    );
    expect(screen.getByRole("img", { name: "Section through F1" })).toBeInTheDocument();
  });

  it("renders a column section", () => {
    render(
      <TypeDrawing
        kind="column"
        type={{ mark: "C1", b: 400, d: 400, nb: 8, dia: 16, lkd: 8, lks: 200 }}
        rules={rules}
      />,
    );
    expect(screen.getByRole("img", { name: "Section through C1" })).toBeInTheDocument();
  });

  it("maps bridge footings onto the pad drawing", () => {
    render(
      <TypeDrawing
        kind="bfoot"
        type={{ mark: "BF1", L: 3, W: 4, D: 0.8, depth: 2, sb: 0, sh: 0 }}
        rules={rules}
      />,
    );
    expect(screen.getByRole("img", { name: "Section through BF1" })).toBeInTheDocument();
  });

  it("renders a pitched roof section", () => {
    render(
      <TypeDrawing
        kind="roof"
        type={{
          mark: "RF1",
          form: "Pitched – hip",
          cover: "Pre-painted IT4 iron sheets",
          pitch: 22.5,
          overhang: 0.6,
          struct: "Steel trusses",
          ts: 4.5,
          ps: 1200,
          gutter: true,
        }}
        rules={rules}
      />,
    );
    expect(screen.getByRole("img", { name: "Roof section" })).toBeInTheDocument();
  });

  it("renders a flat roof build-up", () => {
    render(
      <TypeDrawing
        kind="roof"
        type={{
          mark: "RF2",
          form: "Flat concrete slab",
          cover: "Torch-on bituminous membrane",
          falls: 50,
          ins: "Rigid PIR board 50 mm",
        }}
        rules={rules}
      />,
    );
    expect(screen.getByRole("img", { name: "Flat roof build-up" })).toBeInTheDocument();
  });
});
