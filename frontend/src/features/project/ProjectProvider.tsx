import type { FullProject } from "@takeoff/engine";
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
import { useAuth } from "../auth/AuthProvider.js";
import { api, ApiError } from "../../lib/api.js";
import { asRecord, type DocMap } from "../../lib/doc.js";
import type { ProjectRecord } from "../../lib/types.js";

export type SyncState = "loading" | "saved" | "saving" | "unsaved" | "conflict" | "error";

interface DocumentPayload {
  projectId: string;
  version: number;
  stateJson: DocMap;
}

interface ProjectContextValue {
  meta: ProjectRecord | null;
  doc: DocMap | null;
  version: number;
  sync: SyncState;
  error: string | null;
  setPath: (path: string, value: unknown) => void;
  replaceDoc: (next: DocMap) => void;
  saveNow: () => Promise<void>;
  saveVersion: () => Promise<number | null>;
  reload: () => Promise<void>;
  refreshMeta: () => Promise<void>;
  overwriteMine: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ id, children }: { id: string; children: ReactNode }) {
  const auth = useAuth();
  const [meta, setMeta] = useState<ProjectRecord | null>(null);
  const [doc, setDoc] = useState<DocMap | null>(null);
  const [version, setVersion] = useState(1);
  const [sync, setSync] = useState<SyncState>("loading");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<DocMap | null>(null);
  const versionRef = useRef(1);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!auth.token) return;
    setSync("loading");
    try {
      const [project, document] = await Promise.all([
        api<ProjectRecord>(`/v1/projects/${id}`, { token: auth.token, orgId: auth.orgId }),
        api<DocumentPayload>(`/v1/projects/${id}/document`, { token: auth.token, orgId: auth.orgId }),
      ]);
      const state = structuredClone(document.stateJson ?? {});
      const projectFields = asRecord(state.project);
      if (!projectFields.name && project.name) {
        state.project = { ...projectFields, name: project.name };
      }
      if (!state.roofMode && project.roofMode) {
        state.roofMode = project.roofMode === "COMPLEX" ? "complex" : "simple";
      }
      setMeta(project);
      setDoc(state);
      setVersion(document.version);
      versionRef.current = document.version;
      pending.current = null;
      setError(null);
      setSync("saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not open this project.");
      setSync("error");
    }
  }, [auth.orgId, auth.token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async (state: DocMap, currentVersion: number) => {
    if (!auth.token) return;
    setSync("saving");
    try {
      const saved = await api<DocumentPayload>(`/v1/projects/${id}/document`, {
        method: "PUT",
        token: auth.token,
        orgId: auth.orgId,
        ifMatch: currentVersion,
        body: { stateJson: state },
      });
      setVersion(saved.version);
      versionRef.current = saved.version;
      if (pending.current === state) pending.current = null;
      setSync(pending.current ? "unsaved" : "saved");
      const name = String(asRecord(state.project).name ?? "");
      const roofMode = String(state.roofMode ?? "simple") === "complex" ? "COMPLEX" : "SIMPLE";
      const fxRate = Number(asRecord(state.ra).fx);
      const settings: Record<string, unknown> = {};
      if (name && name !== meta?.name) settings.name = name;
      if (roofMode !== (meta?.roofMode ?? "SIMPLE")) settings.roofMode = roofMode;
      if (Number.isFinite(fxRate) && fxRate > 0 && fxRate !== meta?.fxRate) settings.fxRate = fxRate;
      if (Object.keys(settings).length) {
        const updated = await api<ProjectRecord>(`/v1/projects/${id}/settings`, {
          method: "PATCH",
          token: auth.token,
          orgId: auth.orgId,
          body: settings,
        });
        setMeta(updated);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 412) {
        setSync("conflict");
        setError("A newer version was saved. Reload to continue.");
        return;
      }
      setSync("error");
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }, [auth.orgId, auth.token, id, meta?.name, meta?.roofMode, meta?.fxRate]);

  const queueSave = useCallback((state: DocMap) => {
    pending.current = state;
    setSync("unsaved");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = pending.current;
      if (next) void persist(next, versionRef.current);
    }, 800);
  }, [persist]);

  const setPath = useCallback((path: string, value: unknown) => {
    setDoc((current) => {
      if (!current) return current;
      const keys = path.split(".");
      const next = structuredClone(current);
      let cursor: DocMap = next;
      for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i]!;
        if (cursor[key] == null || typeof cursor[key] !== "object") cursor[key] = {};
        cursor = cursor[key] as DocMap;
      }
      cursor[keys.at(-1)!] = value;
      queueSave(next);
      return next;
    });
  }, [queueSave]);

  const replaceDoc = useCallback((next: DocMap) => {
    setDoc(next);
    queueSave(next);
  }, [queueSave]);

  const saveNow = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    const next = pending.current ?? doc;
    if (next) await persist(next, versionRef.current);
  }, [doc, persist]);

  const refreshMeta = useCallback(async () => {
    if (!auth.token) return;
    const project = await api<ProjectRecord>(`/v1/projects/${id}`, { token: auth.token, orgId: auth.orgId });
    setMeta(project);
  }, [auth.orgId, auth.token, id]);

  const overwriteMine = useCallback(async () => {
    if (!auth.token || !id) return;
    const latest = await api<DocumentPayload>(`/v1/projects/${id}/document`, {
      token: auth.token,
      orgId: auth.orgId,
    });
    const mine = pending.current ?? doc;
    if (!mine) return;
    versionRef.current = latest.version;
    await persist(mine, latest.version);
  }, [auth.orgId, auth.token, doc, id, persist]);

  const saveVersion = useCallback(async () => {
    if (!auth.token) return null;
    await saveNow();
    const created = await api<{ number: number }>(`/v1/projects/${id}/versions`, {
      token: auth.token,
      orgId: auth.orgId,
      body: {},
    });
    return created.number;
  }, [auth.orgId, auth.token, id, saveNow]);

  const value = useMemo<ProjectContextValue>(
    () => ({ meta, doc, version, sync, error, setPath, replaceDoc, saveNow, saveVersion, reload: load, refreshMeta, overwriteMine }),
    [doc, error, load, meta, overwriteMine, refreshMeta, replaceDoc, saveNow, saveVersion, setPath, sync, version],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProject must be used within ProjectProvider");
  return value;
}

export function asFullProject(doc: DocMap | null): FullProject | null {
  return doc as FullProject | null;
}
