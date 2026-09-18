import type { FullProject } from "@takeoff/engine";
import { runProject } from "./runProject.js";

type RequestMessage = { id: number; project: FullProject };

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<RequestMessage>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = (event) => {
  const { id, project } = event.data;
  try {
    scope.postMessage({ id, ok: true, bundle: runProject(project) });
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Engine failed",
    });
  }
};
