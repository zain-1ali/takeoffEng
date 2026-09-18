import { useEffect, useRef, useState } from "react";
import type { FullProject } from "@takeoff/engine";
import { computeInWorker } from "./engineClient.js";
import type { ComputedBundle } from "./runProject.js";

export type ComputedStatus = "idle" | "computing" | "ready" | "error";

export interface UseComputedOptions {
  debounceMs?: number;
  run?: (project: FullProject) => Promise<ComputedBundle> | ComputedBundle;
}

export interface UseComputedResult {
  result: ComputedBundle["result"] | null;
  boq: ComputedBundle["boq"] | null;
  bom: ComputedBundle["bom"] | null;
  totals: ComputedBundle["totals"] | null;
  params: ComputedBundle["params"];
  split: ComputedBundle["split"];
  status: ComputedStatus;
  error: string | null;
}

export function useComputed(
  project: FullProject | null,
  options: UseComputedOptions = {},
): UseComputedResult {
  const debounceMs = options.debounceMs ?? 150;
  const runRef = useRef(options.run ?? computeInWorker);
  runRef.current = options.run ?? computeInWorker;
  const [bundle, setBundle] = useState<ComputedBundle | null>(null);
  const [status, setStatus] = useState<ComputedStatus>(project ? "computing" : "idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) {
      setBundle(null);
      setStatus("idle");
      setError(null);
      return;
    }
    let alive = true;
    setStatus("computing");
    const timer = globalThis.setTimeout(() => {
      void Promise.resolve(runRef.current(project))
        .then((next) => {
          if (!alive) return;
          setBundle(next);
          setStatus("ready");
          setError(null);
        })
        .catch((err: unknown) => {
          if (!alive) return;
          setStatus("error");
          setError(err instanceof Error ? err.message : "Engine failed");
        });
    }, debounceMs);
    return () => {
      alive = false;
      globalThis.clearTimeout(timer);
    };
  }, [project, debounceMs]);

  return {
    result: bundle?.result ?? null,
    boq: bundle?.boq ?? null,
    bom: bundle?.bom ?? null,
    totals: bundle?.totals ?? null,
    params: bundle?.params ?? [],
    split: bundle?.split ?? [],
    status,
    error,
  };
}
