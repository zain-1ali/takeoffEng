import { NumberField, TextField } from "../../ui/index.js";
import { ALL_TYPES, BUILDING_TYPES, isAllowedType } from "../../lib/catalog.js";
import { asRecord, stringOf } from "../../lib/doc.js";
import { useAuth } from "../auth/AuthProvider.js";
import { useProject } from "./ProjectProvider.js";
import { engineType } from "./schema.js";

export function ProjectTypeScreen() {
  const { doc, setPath } = useProject();
  const auth = useAuth();
  if (!doc) return null;
  const btype = stringOf(doc.btype, "multi");
  const project = asRecord(doc.project);
  const grades = asRecord(doc.grades);
  const allowed = auth.entitlements?.types ?? ALL_TYPES;
  const levels = Array.isArray(doc.levels) ? doc.levels as Record<string, unknown>[] : [];
  const first = levels[0];

  const gradeFields = btype === "road"
    ? [["grades.blind", "Blinding and pipe bedding"], ["grades.civil", "Drains, headwalls and aprons"]] as const
    : btype === "bridge"
      ? [["grades.blind", "Blinding"], ["grades.found", "Footings and approach slabs"], ["grades.bridge", "Piers, abutments and deck"]] as const
      : [["grades.blind", "Blinding"], ["grades.found", "Foundations"], ["grades.frame", "Frame"]] as const;

  return (
    <>
      <div className="pagehead">
        <h1>Project & type</h1>
        <p>Choose what you are measuring. Steps and reports change to suit; data for the other project types is kept.</p>
      </div>
      {["Buildings", "Civil works"].map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          <div className="btcards">
            {BUILDING_TYPES.filter((item) => item.group === group).map((item) => {
              const engine = engineType(item.id);
              const gated = !isAllowedType(item.id, allowed);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="btcard"
                  aria-pressed={btype === engine}
                  disabled={gated}
                  onClick={() => setPath("btype", engine)}
                >
                  <b>{item.label}</b>
                  <span>{item.blurb}</span>
                  {gated ? <span>Professional plan</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {btype === "single" && first ? (
        <fieldset>
          <legend>Storey</legend>
          <div className="grid">
            <TextField label="Level name" value={stringOf(first.name)} onChange={(value) => setPath("levels.0.name", value)} />
            <NumberField label="Floor to roof" unit="m" step={0.1} value={stringOf(first.h)} onChange={(value) => setPath("levels.0.h", value)} />
            <NumberField label="Slab zone at top" unit="m" step={0.05} value={stringOf(first.zone)} onChange={(value) => setPath("levels.0.zone", value)} />
          </div>
        </fieldset>
      ) : null}
      <fieldset>
        <legend>Project details <span className="hint">Printed on reports</span></legend>
        <div className="grid">
          <TextField label="Location" value={stringOf(project.location)} onChange={(value) => setPath("project.location", value)} />
          <TextField label="Client" value={stringOf(project.client)} onChange={(value) => setPath("project.client", value)} />
          <TextField label="Drawing references" value={stringOf(project.drawing)} onChange={(value) => setPath("project.drawing", value)} />
          <TextField label="Prepared by" value={stringOf(project.by)} onChange={(value) => setPath("project.by", value)} />
          <TextField label="Date" value={stringOf(project.date)} onChange={(value) => setPath("project.date", value)} />
        </div>
      </fieldset>
      <fieldset>
        <legend>Concrete grades</legend>
        <div className="grid">
          {gradeFields.map(([path, label]) => (
            <TextField
              key={path}
              label={label}
              value={stringOf(grades[path.split(".")[1]!])}
              onChange={(value) => setPath(path, value)}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}
