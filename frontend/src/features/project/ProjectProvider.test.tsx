/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectProvider, useProject } from "./ProjectProvider.js";

const auth = {
  token: "tok",
  orgId: "org1",
};

vi.mock("../auth/AuthProvider.js", () => ({
  useAuth: () => auth,
}));

const sampleDoc = {
  btype: "foundation",
  project: { name: "Clinic" },
  types: { pad: [{ id: "F1", mark: "F1", L: 1.8 }] },
  pl: { pad: [] },
  ui: { sel: { pad: 0 } },
};

function Probe() {
  const { doc, setPath, sync } = useProject();
  if (!doc) return <p>loading</p>;
  return (
    <div>
      <p>sync:{sync}</p>
      <p>L:{String(asPadL(doc))}</p>
      <button type="button" onClick={() => setPath("types.pad.0.L", 2.4)}>edit pad</button>
    </div>
  );
}

function asPadL(doc: Record<string, unknown>) {
  const types = doc.types as { pad: { L: unknown }[] };
  return types.pad[0]?.L;
}

describe("ProjectProvider save", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("PUTs the document with If-Match after an edit", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/v1/projects/p1" && init?.method !== "PATCH") {
        return new Response(JSON.stringify({ id: "p1", name: "Clinic", buildingType: "FOUNDATION" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/v1/projects/p1/document" && init?.method === "PUT") {
        return new Response(JSON.stringify({ projectId: "p1", version: 2, stateJson: sampleDoc }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/v1/projects/p1/document") {
        return new Response(JSON.stringify({ projectId: "p1", version: 1, stateJson: sampleDoc }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ProjectProvider id="p1">
        <Probe />
      </ProjectProvider>,
    );

    await screen.findByText("sync:saved");
    await user.click(screen.getByRole("button", { name: "edit pad" }));
    await waitFor(() => {
      const put = fetchMock.mock.calls.find(([url, init]) => (
        String(url).includes("/v1/projects/p1/document") && (init as RequestInit | undefined)?.method === "PUT"
      ));
      expect(put).toBeTruthy();
      const headers = (put?.[1] as RequestInit).headers as Headers;
      expect(headers.get("If-Match")).toBe('"1"');
      const body = JSON.parse(String((put?.[1] as RequestInit).body)) as { stateJson: { types: { pad: { L: number }[] } } };
      expect(body.stateJson.types.pad[0]?.L).toBe(2.4);
    }, { timeout: 2000 });
  });
});
