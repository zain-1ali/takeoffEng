import { createContext, useContext, useMemo, type ReactNode } from "react";
import { n, type FullProject, type Resource } from "@takeoff/engine";
import { useComputed, type UseComputedResult } from "../editor/useComputed.js";
import { asFullProject, useProject } from "./ProjectProvider.js";
import { useOptionalDatabank } from "./pricing/DatabankProvider.js";
import { raOf } from "./pricing/helpers.js";
import { currencyOf } from "./reports/reportData.js";

const EMPTY: UseComputedResult = {
  result: null,
  boq: null,
  bom: null,
  totals: null,
  params: [],
  split: [],
  status: "idle",
  error: null,
};

const ComputedContext = createContext<UseComputedResult>(EMPTY);
const PricedContext = createContext<FullProject | null>(null);

export function EditorComputedProvider({ children }: { children: ReactNode }) {
  const { doc, meta } = useProject();
  const databank = useOptionalDatabank();
  const project = useMemo(() => {
    const base = asFullProject(doc);
    if (!base) return null;
    const ra = raOf(doc);
    const resources = databank?.engineResources ?? [];
    return {
      ...base,
      resources: resources as Resource[],
      databankCurrency: databank?.currency || String(ra.cur || "") || undefined,
      projectCurrency: currencyOf(doc, meta),
      fxRate: n(ra.fx) || meta?.fxRate || 1,
    } as unknown as FullProject;
  }, [databank?.currency, databank?.engineResources, doc, meta]);
  const computed = useComputed(project);
  return (
    <PricedContext.Provider value={project}>
      <ComputedContext.Provider value={computed}>{children}</ComputedContext.Provider>
    </PricedContext.Provider>
  );
}

export function useEditorComputed(): UseComputedResult {
  return useContext(ComputedContext);
}

export function usePricedProject(): FullProject | null {
  return useContext(PricedContext);
}
