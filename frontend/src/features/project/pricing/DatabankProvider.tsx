import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Resource } from "@takeoff/engine";
import { useAuth } from "../../auth/AuthProvider.js";
import { api, ApiError } from "../../../lib/api.js";
import { toEngineResource } from "./helpers.js";

export interface DatabankResource {
  id: string;
  code: string;
  category: string;
  name: string;
  unit: string;
  rate: string;
  rateValue: number;
  currency: string;
  note: string;
}

interface DatabankPayload {
  resources: DatabankResource[];
  currency?: string;
  priceBasis?: string;
  version?: number;
}

interface DatabankContextValue {
  resources: DatabankResource[];
  engineResources: Resource[];
  currency: string;
  priceBasis: string;
  version: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  reload: () => Promise<void>;
  create: (input?: Partial<DatabankResource>) => Promise<DatabankResource | null>;
  patch: (id: string, patch: Partial<DatabankResource>) => void;
  remove: (id: string) => Promise<void>;
  adjust: (percent: number, category?: string) => Promise<number>;
  convert: (toCurrency: string, fxRate: number) => Promise<void>;
  importCsv: (csv: string) => Promise<{ added: number; updated: number }>;
}

const DatabankContext = createContext<DatabankContextValue | null>(null);

export function DatabankProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [resources, setResources] = useState<DatabankResource[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [priceBasis, setPriceBasis] = useState("Indicative starter prices – replace with your local rates");
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState<DatabankContextValue["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const timers = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, Partial<DatabankResource>>());

  const applyPayload = useCallback((payload: DatabankPayload) => {
    setResources(payload.resources ?? []);
    setCurrency(payload.currency ?? "USD");
    setPriceBasis(payload.priceBasis ?? "Indicative starter prices – replace with your local rates");
    setVersion(payload.version ?? 1);
  }, []);

  const reload = useCallback(async () => {
    if (!auth.token || !auth.orgId) return;
    setStatus("loading");
    try {
      const payload = await api<DatabankPayload>("/v1/databank", { token: auth.token, orgId: auth.orgId });
      applyPayload(payload);
      setError(null);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Could not load the resource databank.");
    }
  }, [applyPayload, auth.orgId, auth.token]);

  useEffect(() => {
    void reload();
    return () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    };
  }, [reload]);

  const create = useCallback(async (input: Partial<DatabankResource> = {}) => {
    if (!auth.token) return null;
    try {
      const created = await api<DatabankResource>("/v1/databank", {
        token: auth.token,
        orgId: auth.orgId,
        body: input,
      });
      setResources((current) => [...current, created]);
      setError(null);
      return created;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the resource.");
      return null;
    }
  }, [auth.orgId, auth.token]);

  const patch = useCallback((id: string, next: Partial<DatabankResource>) => {
    setResources((current) => current.map((row) => (row.id === id ? { ...row, ...next } : row)));
    const merged = { ...pending.current.get(id), ...next };
    pending.current.set(id, merged);
    const existing = timers.current.get(id);
    if (existing) window.clearTimeout(existing);
    timers.current.set(id, window.setTimeout(() => {
      timers.current.delete(id);
      const body = pending.current.get(id);
      pending.current.delete(id);
      if (!auth.token || !body) return;
      void api<DatabankResource>(`/v1/databank/${id}`, {
        method: "PATCH",
        token: auth.token,
        orgId: auth.orgId,
        body,
      }).catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not save the resource.");
      });
    }, 400));
  }, [auth.orgId, auth.token]);

  const remove = useCallback(async (id: string) => {
    if (!auth.token) return;
    await api(`/v1/databank/${id}`, { method: "DELETE", token: auth.token, orgId: auth.orgId });
    setResources((current) => current.filter((row) => row.id !== id));
  }, [auth.orgId, auth.token]);

  const adjust = useCallback(async (percent: number, category?: string) => {
    if (!auth.token) return 0;
    const result = await api<{ count: number }>("/v1/databank/adjust", {
      token: auth.token,
      orgId: auth.orgId,
      body: { percent, category: category && category !== "All" ? category : undefined },
    });
    await reload();
    return result.count;
  }, [auth.orgId, auth.token, reload]);

  const convert = useCallback(async (toCurrency: string, fxRate: number) => {
    if (!auth.token) return;
    await api("/v1/databank/convert", {
      token: auth.token,
      orgId: auth.orgId,
      body: { toCurrency, fxRate },
    });
    await reload();
  }, [auth.orgId, auth.token, reload]);

  const importCsv = useCallback(async (csv: string) => {
    if (!auth.token) return { added: 0, updated: 0 };
    const result = await api<{ added: number; updated: number }>("/v1/databank/import", {
      token: auth.token,
      orgId: auth.orgId,
      body: { csv },
    });
    await reload();
    return result;
  }, [auth.orgId, auth.token, reload]);

  const engineResources = useMemo(() => resources.map(toEngineResource), [resources]);

  const value = useMemo<DatabankContextValue>(() => ({
    resources,
    engineResources,
    currency,
    priceBasis,
    version,
    status,
    error,
    reload,
    create,
    patch,
    remove,
    adjust,
    convert,
    importCsv,
  }), [adjust, convert, create, currency, engineResources, error, importCsv, patch, priceBasis, reload, remove, resources, status, version]);

  return <DatabankContext.Provider value={value}>{children}</DatabankContext.Provider>;
}

export function useDatabank(): DatabankContextValue {
  const value = useContext(DatabankContext);
  if (!value) throw new Error("useDatabank must be used within DatabankProvider");
  return value;
}

export function useOptionalDatabank(): DatabankContextValue | null {
  return useContext(DatabankContext);
}
