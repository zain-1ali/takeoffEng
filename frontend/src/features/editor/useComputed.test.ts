/** @vitest-environment jsdom */
import { createCompleteBuildingExample } from "@takeoff/engine";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { runProject } from "./runProject.js";
import { useComputed } from "./useComputed.js";

describe("useComputed", () => {
  it("exposes result, boq, bom, totals and params after debounce", async () => {
    const project = createCompleteBuildingExample();
    const { result } = renderHook(() =>
      useComputed(project, { debounceMs: 1, run: async (next) => runProject(next) }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.totals?.itemCount).toBe(1153);
    expect(result.current.boq?.items.length).toBe(151);
    expect(result.current.bom?.some((row) => "code" in row)).toBe(true);
    expect(result.current.params[0]?.[0]).toBe("Project type");
  });
});
