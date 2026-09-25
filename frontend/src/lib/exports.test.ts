/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { downloadProjectExcel } from "./exports.js";

describe("Excel export client", () => {
  it("polls the job then downloads the workbook", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/exports") && !url.includes("/v1/exports/") && init?.method === "POST") {
        return new Response(JSON.stringify({ id: "job1", status: "QUEUED", fileName: null }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/v1/exports/job1") && !url.endsWith("/file")) {
        return new Response(JSON.stringify({ id: "job1", status: "DONE", fileName: "clinic_takeoff.xlsx" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/file")) {
        return new Response(new Blob(["xlsx"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click, remove() {} } as unknown as HTMLAnchorElement;
      }
      return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    });
    URL.createObjectURL = vi.fn(() => "blob:excel");
    URL.revokeObjectURL = vi.fn();

    await downloadProjectExcel({ projectId: "p1", token: "tok", orgId: "org1" });
    expect(click).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/v1\/projects\/p1\/exports$/),
      expect.objectContaining({ method: "POST" }),
    );
  });
});
