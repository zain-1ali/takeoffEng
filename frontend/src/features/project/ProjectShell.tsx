import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { BUILDING_TYPES, isAllowedType } from "../../lib/catalog.js";
import { asRecord, stringOf } from "../../lib/doc.js";
import { formatNumber } from "../../lib/format.js";
import { useAuth } from "../auth/AuthProvider.js";
import { BearingsScreen } from "./BearingsScreen.js";
import { ComingSoonScreen } from "./ComingSoonScreen.js";
import { EditorComputedProvider, useEditorComputed } from "./computed.js";
import { KindScreen } from "./KindScreen.js";
import { LevelsScreen } from "./LevelsScreen.js";
import { ProjectTypeScreen } from "./ProjectTypeScreen.js";
import { RoadFurnitureScreen } from "./RoadFurnitureScreen.js";
import { RulesScreen } from "./RulesScreen.js";
import { BbsScreen } from "./reports/BbsScreen.js";
import { BomScreen } from "./reports/BomScreen.js";
import { BoqScreen } from "./reports/BoqScreen.js";
import { DashboardScreen } from "./reports/DashboardScreen.js";
import { DimsScreen } from "./reports/DimsScreen.js";
import { RaReportScreen } from "./reports/RaReportScreen.js";
import { RatesScreen } from "./pricing/RatesScreen.js";
import { ResourcesScreen } from "./pricing/ResourcesScreen.js";
import { useProject } from "./ProjectProvider.js";
import {
  BTYPE_LABEL,
  NAV_PRICING,
  NAV_REPORTS,
  TYPE_SCHEMA,
  engineType,
  hasSidePanel,
  visibleInputSteps,
} from "./schema.js";
import { SidePanel } from "./SidePanel.js";

const PRICING_IX: Record<string, string> = { rates: "R", resources: "D" };

function syncLabel(sync: string): { text: string; className: string } {
  if (sync === "saving") return { text: "Saving…", className: "syncpill warn" };
  if (sync === "unsaved") return { text: "Unsaved", className: "syncpill warn" };
  if (sync === "conflict") return { text: "Conflict", className: "syncpill warn" };
  if (sync === "error") return { text: "Save failed", className: "syncpill warn" };
  if (sync === "loading") return { text: "Opening…", className: "syncpill" };
  return { text: "Saved", className: "syncpill ok" };
}

function EditorBody({ view }: { view: string }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const auth = useAuth();
  const { meta, doc, sync, error, setPath, saveNow, reload } = useProject();
  const { result } = useEditorComputed();
  const allowed = auth.entitlements?.types ?? ["FOUNDATION", "SINGLE"];
  const btype = stringOf(doc?.btype, "multi");
  const project = asRecord(doc?.project);
  const steps = visibleInputSteps(btype);
  useEffect(() => {
    if (!doc || !id) return;
    const views = new Set([
      ...visibleInputSteps(btype).map(([key]) => key),
      ...NAV_PRICING.map(([key]) => key),
      ...NAV_REPORTS.map(([key]) => key),
      "team",
    ]);
    if (!views.has(view)) navigate(`/app/p/${id}/project`, { replace: true });
  }, [btype, doc, id, navigate, view]);

  if (sync === "loading" && !doc) {
    return <p className="text-muted" style={{ padding: 24 }}>Opening project…</p>;
  }
  if (!doc) {
    return (
      <div className="main">
        <p className="alert">{error ?? "Could not open this project."}</p>
        <p><Link className="btn" to="/app">Back to projects</Link></p>
      </div>
    );
  }

  const name = stringOf(project.name, meta?.name ?? "Untitled project");
  const metaLine = [
    stringOf(project.location),
    btype === "multi" ? `${asRecord(doc).levels && Array.isArray(doc.levels) ? doc.levels.length : 0} levels` : BTYPE_LABEL[btype],
    stringOf(project.drawing),
  ].filter(Boolean).join("  |  ");
  const pill = syncLabel(sync);
  const planLabel = auth.plan === "STARTER" ? "Starter" : auth.plan;

  function go(next: string) {
    if (id) navigate(`/app/p/${id}/${next}`);
  }

  let screen;
  if (view === "project") screen = <ProjectTypeScreen />;
  else if (view === "levels") screen = <LevelsScreen />;
  else if (view === "rules") screen = <RulesScreen />;
  else if (view === "rfurn") screen = <RoadFurnitureScreen />;
  else if (view === "bacc") screen = <BearingsScreen />;
  else if (view === "summary") screen = <DashboardScreen />;
  else if (view === "boq") screen = <BoqScreen />;
  else if (view === "bom") screen = <BomScreen />;
  else if (view === "rareport") screen = <RaReportScreen />;
  else if (view === "bbs") screen = <BbsScreen />;
  else if (view === "dims") screen = <DimsScreen />;
  else if (view === "rates") screen = <RatesScreen />;
  else if (view === "resources") screen = <ResourcesScreen />;
  else if (TYPE_SCHEMA[view]) screen = <KindScreen kind={view} />;
  else screen = <ComingSoonScreen view={view} />;

  const groups = [
    { id: "Buildings", label: "Buildings", items: BUILDING_TYPES.filter((item) => item.group === "Buildings") },
    { id: "Civil works", label: "Civil works", items: BUILDING_TYPES.filter((item) => item.group === "Civil works") },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="abar">
        <Link to="/app" className="lbrand" aria-label="All projects"><span className="logo">T</span></Link>
        <div className="brand-edit">
          <input
            aria-label="Project name"
            value={name}
            onChange={(event) => setPath("project.name", event.target.value)}
          />
          <small>{metaLine || "Take-off editor"}</small>
        </div>
        <span className={pill.className}>{pill.text}</span>
        <span className="planpill">Plan: <b>{planLabel}</b></span>
        <button className="btn" type="button" onClick={() => void saveNow()}>Save project</button>
        <button className="btn" type="button" onClick={() => void auth.logout()}>Sign out</button>
      </header>
      {sync === "conflict" ? (
        <div className="alert" style={{ margin: 0, borderRadius: 0 }}>
          {error}{" "}
          <button className="btn sm" type="button" onClick={() => void reload()}>Reload</button>
        </div>
      ) : null}
      <div className="shell">
        <nav className="nav" aria-label="Take-off steps">
          <h2>Project type</h2>
          <div className="btype" role="group" aria-label="Project type">
            {groups.map((group) => (
              <span key={group.id} style={{ display: "contents" }}>
                <span className="bthead">{group.label}</span>
                {group.items.map((item) => {
                  const engine = engineType(item.id);
                  const gated = !isAllowedType(item.id, allowed);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={btype === engine}
                      disabled={gated}
                      title={gated ? "Professional plan" : item.label}
                      onClick={() => setPath("btype", engine)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </span>
            ))}
          </div>
          <h2>Inputs</h2>
          <div className="steps">
            {steps.map(([key, label], index) => (
              <button
                key={key}
                type="button"
                className="step"
                aria-current={view === key ? true : undefined}
                onClick={() => go(key)}
              >
                <span className="ix">{index + 1}</span>
                {label}
              </button>
            ))}
          </div>
          <h2>Collaborate</h2>
          <div className="steps">
            <button type="button" className="step" aria-current={view === "team" || undefined} onClick={() => go("team")}>
              <span className="ix">T</span>Team workspace
            </button>
          </div>
          <h2>Pricing</h2>
          <div className="steps">
            {NAV_PRICING.map(([key, label]) => (
              <button key={key} type="button" className="step" aria-current={view === key || undefined} onClick={() => go(key)}>
                <span className="ix">{PRICING_IX[key] ?? "·"}</span>{label}
              </button>
            ))}
          </div>
          <h2>Reports</h2>
          <div className="steps">
            {NAV_REPORTS.map(([key, label]) => (
              <button key={key} type="button" className="step" aria-current={view === key || undefined} onClick={() => go(key)}>
                <span className="ix">·</span>{label}
              </button>
            ))}
          </div>
          <div className="navtot">
            <div><span>Concrete</span><b>{formatNumber(result?.concrete ?? 0, 1)} m³</b></div>
            <div><span>Reinforcement</span><b>{formatNumber((result?.steelKg ?? 0) / 1000, 2)} t</b></div>
            <div><span>Formwork</span><b>{formatNumber(result?.formwork ?? 0, 0)} m²</b></div>
            <div><span>Bar marks</span><b>{result?.bars.length ?? 0}</b></div>
          </div>
        </nav>
        <div className={hasSidePanel(view) ? "work" : "work full"}>
          <main className="main">
            {result?.warn?.length ? (
              <div className="alerts">
                {result.warn.slice(0, 6).map((warning) => (
                  <div className="alert" key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
            {screen}
          </main>
          {hasSidePanel(view) ? (
            <aside className="side">
              <SidePanel view={view} />
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ProjectShell() {
  const { id, view } = useParams();
  if (!id) return <Navigate to="/app" replace />;
  if (!view) return <Navigate to={`/app/p/${id}/project`} replace />;
  return (
    <EditorComputedProvider>
      <EditorBody view={view} />
    </EditorComputedProvider>
  );
}
