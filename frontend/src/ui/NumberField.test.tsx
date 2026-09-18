/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { NumberField } from "./NumberField.js";

function Harness({ initial = "20*15+4*2.5" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <NumberField label="Room area" value={value} onChange={setValue} unit="m²" step={0.1} />;
}

describe("NumberField", () => {
  it("shows the evaluated badge and commits the result on Enter", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Room area");
    expect(input).toHaveValue("20*15+4*2.5");
    expect(screen.getByText("= 310.00")).toBeInTheDocument();
    await user.type(input, "{Enter}");
    expect(input).toHaveValue("310");
  });

  it("marks an incomplete formula as invalid", () => {
    render(<Harness initial="4*" />);
    expect(screen.getByLabelText("Room area")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("check formula")).toBeInTheDocument();
  });

  it("steps the evaluated value with the plus control", async () => {
    const user = userEvent.setup();
    render(<Harness initial="2" />);
    await user.click(screen.getByRole("button", { name: "Increase" }));
    expect(screen.getByLabelText("Room area")).toHaveValue("2.1");
  });
});
