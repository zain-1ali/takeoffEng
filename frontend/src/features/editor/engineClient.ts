import type { FullProject } from "@takeoff/engine";
import type { ComputedBundle } from "./runProject.js";

type ResponseMessage =
  | { id: number; ok: true; bundle: ComputedBundle }
  | { id: number; ok: false; error: string };

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<
  number,
  { resolve: (bundle: ComputedBundle) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<ResponseMessage>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.ok) job.resolve(event.data.bundle);
      else job.reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      const error = new Error(event.message || "Engine worker failed");
      for (const job of pending.values()) job.reject(error);
      pending.clear();
    };
  }
  return worker;
}

export function computeInWorker(project: FullProject): Promise<ComputedBundle> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, project });
  });
}
