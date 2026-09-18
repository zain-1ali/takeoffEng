import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TypeArt } from "../marketing/TypeArt.js";
import { useAuth } from "../auth/AuthProvider.js";
import { api, ApiError } from "../../lib/api.js";
import {
  BUILDING_TYPES,
  STAGE_OPTIONS,
  buildingTypeLabel,
  stageLabel,
} from "../../lib/catalog.js";
import { relativeTime } from "../../lib/format.js";
import type { ProjectCard } from "../../lib/types.js";
import { AppShell } from "./AppShell.js";

interface ProjectList {
  projects: ProjectCard[];
  nextCursor: string | null;
}

export function WorkspacePage() {
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [stage, setStage] = useState("");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async (reset: boolean, next?: string | null) => {
    if (!auth.token) return;
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (type) params.set("type", type);
      if (stage) params.set("stage", stage);
      if (!reset && next) params.set("cursor", next);
      const path = `/v1/projects${params.size ? `?${params}` : ""}`;
      const result = await api<ProjectList>(path, { token: auth.token, orgId: auth.orgId });
      setProjects((current) => (reset ? result.projects : [...current, ...result.projects]));
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load projects.");
    } finally {
      setBusy(false);
    }
  }, [auth.orgId, auth.token, query, stage, type]);

  useEffect(() => {
    void load(true);
  }, [load]);

  async function archive(id: string) {
    if (!auth.token || !confirm("Archive this project? You can still find it later from archived views.")) return;
    try {
      await api(`/v1/projects/${id}`, { method: "DELETE", token: auth.token, orgId: auth.orgId });
      setProjects((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not archive the project.");
    }
  }

  async function duplicate(id: string) {
    if (!auth.token) return;
    try {
      const copy = await api<ProjectCard>(`/v1/projects/${id}/duplicate`, {
        method: "POST",
        token: auth.token,
        orgId: auth.orgId,
      });
      setProjects((current) => [copy, ...current]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not duplicate the project.");
    }
  }

  const empty = !busy && projects.length === 0;
  const maxReached = useMemo(() => {
    const max = auth.entitlements?.maxProjects;
    return max != null && projects.length >= max;
  }, [auth.entitlements?.maxProjects, projects.length]);

  return (
    <AppShell
      title={auth.orgName ?? "Workspace"}
      subtitle={`${auth.user?.email ?? ""} · ${projects.length} project${projects.length === 1 ? "" : "s"}`}
      actions={
        <Link className="btn primary" to="/app/new">
          New project
        </Link>
      }
    >
      <main className="mx-auto max-w-[1180px] px-6 py-8">
        <div className="pagehead">
          <h1>Projects</h1>
          <p>Open a take-off or start a new one. Cards show the last saved totals when the engine has run.</p>
        </div>
        <div className="wtools">
          <div className="f">
            <label htmlFor="q">Search</label>
            <div className="box">
              <input
                id="q"
                className="t"
                value={query}
                placeholder="Name"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
          <div className="f">
            <label htmlFor="type">Type</label>
            <div className="box">
              <select id="type" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="">All types</option>
                {BUILDING_TYPES.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="f">
            <label htmlFor="stage">Stage</label>
            <div className="box">
              <select id="stage" value={stage} onChange={(event) => setStage(event.target.value)}>
                <option value="">All stages</option>
                {STAGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {error ? <p className="alert">{error}</p> : null}
        {empty ? (
          <div className="wempty">
            <h2>No projects yet</h2>
            <p className="text-muted">Create a foundations or single-storey take-off to see the engine run.</p>
            <Link className="btn primary" to="/app/new">New project</Link>
          </div>
        ) : (
          <div className="wgrid">
            {projects.map((project) => (
              <article key={project.id} className="wproj">
                <Link to={`/app/p/${project.id}`} className="wproj" style={{ border: 0, borderRadius: 0 }}>
                  <div className="wpart"><TypeArt kind={project.buildingType} /></div>
                  <div className="wpb">
                    <h4>{project.name}</h4>
                    <small>
                      {buildingTypeLabel(project.buildingType)} · {project.currency} · {stageLabel(project.stage)}
                    </small>
                    <small>
                      {project.summary?.total != null
                        ? `Total ${Math.round(project.summary.total).toLocaleString("en-GB")}`
                        : "No totals yet"}
                      {" · "}
                      {relativeTime(project.updatedAt)}
                    </small>
                  </div>
                </Link>
                <div className="wpact">
                  <button className="btn sm" type="button" onClick={() => void duplicate(project.id)}>Duplicate</button>
                  <button className="btn sm" type="button" onClick={() => void archive(project.id)}>Archive</button>
                </div>
              </article>
            ))}
          </div>
        )}
        {maxReached ? (
          <p className="mt-4 text-sm text-muted">
            Starter includes one active project. <Link to="/pricing">Upgrade</Link> for unlimited projects.
          </p>
        ) : null}
        {cursor ? (
          <p className="mt-4">
            <button className="btn" type="button" disabled={busy} onClick={() => void load(false, cursor)}>
              {busy ? "Loading…" : "Load more"}
            </button>
          </p>
        ) : null}
      </main>
    </AppShell>
  );
}
