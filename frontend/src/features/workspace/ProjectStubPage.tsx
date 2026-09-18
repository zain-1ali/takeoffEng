import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.js";
import { api, ApiError } from "../../lib/api.js";
import { buildingTypeLabel, stageLabel } from "../../lib/catalog.js";
import type { ProjectRecord } from "../../lib/types.js";
import { AppShell } from "./AppShell.js";

export function ProjectStubPage() {
  const { id } = useParams();
  const auth = useAuth();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !auth.token) return;
    void api<ProjectRecord>(`/v1/projects/${id}`, { token: auth.token, orgId: auth.orgId })
      .then(setProject)
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not open this project.");
      });
  }, [auth.orgId, auth.token, id]);

  return (
    <AppShell
      title={project?.name ?? "Project"}
      subtitle={
        project
          ? `${buildingTypeLabel(project.buildingType)} · ${project.currency} · ${stageLabel(project.stage)}`
          : "Loading…"
      }
      actions={<Link className="btn" to="/app">All projects</Link>}
    >
      <div className="stubnote">
        {error ? <p className="alert">{error}</p> : null}
        {project ? (
          <>
            <div className="pagehead">
              <h1>{project.name}</h1>
              <p>
                {project.reference ? `${project.reference} · ` : ""}
                {project.location || "Location not set"}
                {project.measurementBasis ? ` · ${project.measurementBasis}` : ""}
              </p>
            </div>
            <p className="mt-6 text-muted">
              The take-off editor, drawings and live quantities arrive in the next phase.
              This project is saved in your workspace — reopen it from the grid any time.
            </p>
            {project.summary?.total != null ? (
              <p className="mt-4">
                Last computed total: <b>{Math.round(project.summary.total).toLocaleString("en-GB")} {project.currency}</b>
              </p>
            ) : null}
            <p className="mt-6">
              <Link className="btn primary" to="/app">Back to projects</Link>
            </p>
          </>
        ) : !error ? (
          <p className="text-muted">Opening project…</p>
        ) : null}
      </div>
    </AppShell>
  );
}
