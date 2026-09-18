import {
  n,
  roofGeometryReadouts,
  roofLineGeometry,
  roofPlaneGeometry,
  type NumericInput,
  type RoofLine,
  type RoofPlane,
  type RoofType,
  type RoofingProjectLike,
} from "@takeoff/engine";
import { useEffect } from "react";
import { Readout, SelectField } from "../../ui/index.js";
import { asList, asRecord, stringOf, uid, type DocMap } from "../../lib/doc.js";
import { formatNumber } from "../../lib/format.js";
import { asFullProject, useProject } from "./ProjectProvider.js";
import { ensureRoofX } from "./schema.js";

const SHAPES = ["Rectangle", "Trapezium", "Triangle"] as const;
const LINE_KINDS = [
  "Ridge", "Hip", "Valley", "Verge / barge", "Eaves",
  "Abutment – wall", "Abutment – chimney", "Parapet / box gutter",
] as const;
const OPENING_KINDS = [
  "Skylight / roof light", "Dormer", "Roof hatch", "Vent / pipe penetration",
] as const;
const TRUSS_TYPES = ["Steel truss", "Steel rafter / portal", "Timber truss"] as const;
const ON_OPTIONS = ["Plan", "True"] as const;

function asRoofType(row: DocMap | undefined): RoofType | undefined {
  if (!row) return undefined;
  return row as unknown as RoofType;
}

export function RoofPicker() {
  const { doc, replaceDoc } = useProject();
  if (!doc) return null;
  const state = doc;
  const mode = stringOf(state.roofMode, "simple") === "complex" ? "complex" : "simple";

  function setMode(next: string) {
    const updated = ensureRoofX(structuredClone(state));
    updated.roofMode = next;
    replaceDoc(updated);
  }

  return (
    <fieldset>
      <legend>
        Measurement method
        <span className="hint">Only the method you pick is measured, so nothing is counted twice</span>
      </legend>
      <div className="rfpick">
        <SelectField
          label="How do you want to measure the roof?"
          value={mode}
          onChange={setMode}
          options={[
            { value: "simple", label: "Simple roof – rectangles (hip, gable, mono-pitch, flat)" },
            { value: "complex", label: "Complex roof – planes, lines, openings and truss schedule" },
          ]}
        />
        <p className="text-muted" style={{ margin: 0 }}>
          {mode === "simple"
            ? "Enter each roof by plan length and width. Slope areas, ridges, hips, trusses, purlins, fascias and gutters are calculated from the roof form. Best for rectangular buildings and canopies."
            : "Enter roof planes (rectangles, trapeziums, triangles) and lines (ridges, hips, valleys, verges, eaves, abutments, box gutters). Hips and valleys convert to true length; openings are deducted; trusses come from the engineer’s schedule. Best for L, T and irregular roofs."}
        </p>
      </div>
    </fieldset>
  );
}

export function RoofxSections() {
  const { doc, setPath, replaceDoc } = useProject();
  useEffect(() => {
    if (!doc) return;
    const next = ensureRoofX(doc);
    if (next !== doc) replaceDoc(next);
  }, [doc, replaceDoc]);
  if (!doc) return null;
  const state = doc;
  const roofx = asRecord(state.roofx);
  const types = asList(asRecord(state.types).roof);
  const firstId = stringOf(types[0]?.id);
  const project = asFullProject(state) as RoofingProjectLike | null;
  const readouts = project ? roofGeometryReadouts(project) : null;
  const typeOptions = types.map((type) => ({ value: stringOf(type.id), label: stringOf(type.mark) }));
  const typeOptionsNone = [{ value: "", label: "None" }, ...typeOptions];

  function add(list: "planes" | "lines" | "openings" | "trusses") {
    const next = ensureRoofX(structuredClone(state));
    const rows = asList(asRecord(next.roofx)[list]);
    const templates: Record<typeof list, DocMap> = {
      planes: { ref: "", roof: firstId, shape: "Rectangle", a: 0, b: 0, h: 0, pitch: "", no: 1, less: false },
      lines: { ref: "", kind: "Valley", roof: firstId, len: 0, on: "Plan", p1: "", p2: "", no: 1 },
      openings: { ref: "", roof: firstId, kind: "Skylight / roof light", w: 1, l: 1, no: 1 },
      trusses: { mark: `T${rows.length + 1}`, type: "Steel truss", span: 0, wt: 0, no: 1, replaces: "" },
    };
    rows.push({ id: uid("rx"), ...templates[list] });
    asRecord(next.roofx)[list] = rows;
    replaceDoc(next);
  }

  function remove(list: string, index: number) {
    const next = structuredClone(state);
    const rows = asList(asRecord(next.roofx)[list]);
    rows.splice(index, 1);
    asRecord(next.roofx)[list] = rows;
    replaceDoc(next);
  }

  return (
    <>
      <div className="grid" style={{ marginBottom: 14 }}>
        <Readout label="Plan area" value={readouts?.planArea ?? 0} digits={1} unit="m²" />
        <Readout label="Area on slope" value={readouts?.slopeArea ?? 0} digits={1} unit="m²" />
        <Readout label="Ridges and hips" value={readouts?.ridgesAndHips ?? 0} digits={1} unit="m" />
        <Readout label="Valleys" value={readouts?.valleys ?? 0} digits={1} unit="m" />
        <Readout label="Openings deducted" value={readouts?.openingsDeducted ?? 0} digits={2} unit="m²" />
        <Readout label="Scheduled steel" value={(readouts?.scheduledSteelKg ?? 0) / 1000} digits={3} unit="t" />
      </div>
      <RoofTable
        title="Roof planes"
        hint="Plan dimensions; pitch blank = roof type pitch; tick Deduct to subtract an overlap"
        empty="No planes yet."
        heads={["Plane", "Roof", "Shape", "Eaves length (m)", "Top length (m)", "Plan depth (m)", "Pitch (°)", "No.", "Deduct", "Plan m²", "Slope m²"]}
        onAdd={() => add("planes")}
      >
        {asList(roofx.planes).map((plane, index) => {
          const type = asRoofType(types.find((row) => stringOf(row.id) === stringOf(plane.roof)));
          const geometry = roofPlaneGeometry(plane as unknown as RoofPlane, type);
          const sign = plane.less ? -1 : 1;
          const plan = geometry.planArea * geometry.count * sign;
          const slope = (type?.form === "Flat concrete slab" ? geometry.planArea : geometry.slopeArea) * geometry.count * sign;
          return (
            <tr key={stringOf(plane.id, String(index))}>
              <TextCell path={`roofx.planes.${index}.ref`} value={plane.ref} label="Plane" onChange={setPath} />
              <SelectCell path={`roofx.planes.${index}.roof`} value={plane.roof} label="Roof type" options={typeOptions} onChange={setPath} />
              <SelectCell path={`roofx.planes.${index}.shape`} value={plane.shape} label="Shape" options={SHAPES.map((item) => ({ value: item, label: item }))} onChange={setPath} />
              <NumCell path={`roofx.planes.${index}.a`} value={plane.a} label="Eaves length" onChange={setPath} />
              <NumCell path={`roofx.planes.${index}.b`} value={plane.b} label="Top length" onChange={setPath} />
              <NumCell path={`roofx.planes.${index}.h`} value={plane.h} label="Plan depth" onChange={setPath} />
              <NumCell path={`roofx.planes.${index}.pitch`} value={plane.pitch} label="Pitch" placeholder="type" onChange={setPath} />
              <NumCell path={`roofx.planes.${index}.no`} value={plane.no} label="No." onChange={setPath} />
              <td style={{ textAlign: "center" }}>
                <input
                  type="checkbox"
                  aria-label="Deduct"
                  checked={Boolean(plane.less)}
                  onChange={(event) => setPath(`roofx.planes.${index}.less`, event.target.checked)}
                />
              </td>
              <td className="calc">{formatNumber(plan, 2)}</td>
              <td className="calc">{formatNumber(slope, 2)}</td>
              <td>
                <button className="x" type="button" aria-label="Delete row" onClick={() => remove("planes", index)}>×</button>
              </td>
            </tr>
          );
        })}
      </RoofTable>
      <RoofTable
        title="Roof lines"
        hint="Hips and valleys on plan are converted to true length from both pitches"
        empty="No lines yet."
        heads={["Line", "Type", "Roof", "Length (m)", "Measured on", "Pitch 1 (°)", "Pitch 2 (°)", "No.", "True total (m)"]}
        onAdd={() => add("lines")}
      >
        {asList(roofx.lines).map((line, index) => {
          const type = asRoofType(types.find((row) => stringOf(row.id) === stringOf(line.roof)));
          const geometry = roofLineGeometry(line as unknown as RoofLine, type);
          return (
            <tr key={stringOf(line.id, String(index))}>
              <TextCell path={`roofx.lines.${index}.ref`} value={line.ref} label="Line" onChange={setPath} />
              <SelectCell path={`roofx.lines.${index}.kind`} value={line.kind} label="Line type" options={LINE_KINDS.map((item) => ({ value: item, label: item }))} onChange={setPath} />
              <SelectCell path={`roofx.lines.${index}.roof`} value={line.roof} label="Roof type" options={typeOptions} onChange={setPath} />
              <NumCell path={`roofx.lines.${index}.len`} value={line.len} label="Length" onChange={setPath} />
              <SelectCell path={`roofx.lines.${index}.on`} value={line.on} label="Measured on" options={ON_OPTIONS.map((item) => ({ value: item, label: item }))} onChange={setPath} />
              <NumCell path={`roofx.lines.${index}.p1`} value={line.p1} label="Pitch 1" placeholder="type" onChange={setPath} />
              <NumCell path={`roofx.lines.${index}.p2`} value={line.p2} label="Pitch 2" placeholder="type" onChange={setPath} />
              <NumCell path={`roofx.lines.${index}.no`} value={line.no} label="No." onChange={setPath} />
              <td className="calc">{formatNumber(geometry.totalLength, 2)}</td>
              <td>
                <button className="x" type="button" aria-label="Delete row" onClick={() => remove("lines", index)}>×</button>
              </td>
            </tr>
          );
        })}
      </RoofTable>
      <RoofTable
        title="Openings"
        hint="Openings over 1 m² are deducted from covering and insulation"
        empty="No openings."
        heads={["Opening", "Type", "Roof", "Width (m)", "Length on slope (m)", "No.", "Deducted m²"]}
        onAdd={() => add("openings")}
      >
        {asList(roofx.openings).map((opening, index) => {
          const area = n((opening.w ?? 0) as NumericInput) * n((opening.l ?? 0) as NumericInput);
          const deducted = area > 1 ? area * (n((opening.no ?? 1) as NumericInput) || 1) : 0;
          return (
            <tr key={stringOf(opening.id, String(index))}>
              <TextCell path={`roofx.openings.${index}.ref`} value={opening.ref} label="Opening" onChange={setPath} />
              <SelectCell path={`roofx.openings.${index}.kind`} value={opening.kind} label="Opening type" options={OPENING_KINDS.map((item) => ({ value: item, label: item }))} onChange={setPath} />
              <SelectCell path={`roofx.openings.${index}.roof`} value={opening.roof} label="Roof type" options={typeOptions} onChange={setPath} />
              <NumCell path={`roofx.openings.${index}.w`} value={opening.w} label="Width" onChange={setPath} />
              <NumCell path={`roofx.openings.${index}.l`} value={opening.l} label="Length on slope" onChange={setPath} />
              <NumCell path={`roofx.openings.${index}.no`} value={opening.no} label="No." onChange={setPath} />
              <td className="calc">{deducted ? formatNumber(deducted, 2) : "not deducted"}</td>
              <td>
                <button className="x" type="button" aria-label="Delete row" onClick={() => remove("openings", index)}>×</button>
              </td>
            </tr>
          );
        })}
      </RoofTable>
      <RoofTable
        title="Truss schedule"
        hint="From the engineer’s drawings. Steel: weight each in kg. Timber: member length each in m"
        empty="No scheduled trusses."
        heads={["Mark", "Type", "Span (m)", "kg or m each", "No.", "Replaces estimate for", "Total"]}
        onAdd={() => add("trusses")}
      >
        {asList(roofx.trusses).map((truss, index) => {
          const count = n((truss.no ?? 0) as NumericInput);
          const weight = n((truss.wt ?? 0) as NumericInput);
          const total = stringOf(truss.type) === "Timber truss"
            ? `${formatNumber(count, 0)} No.`
            : `${formatNumber(count * weight / 1000, 3)} t`;
          return (
            <tr key={stringOf(truss.id, String(index))}>
              <TextCell path={`roofx.trusses.${index}.mark`} value={truss.mark} label="Mark" onChange={setPath} />
              <SelectCell path={`roofx.trusses.${index}.type`} value={truss.type} label="Truss type" options={TRUSS_TYPES.map((item) => ({ value: item, label: item }))} onChange={setPath} />
              <NumCell path={`roofx.trusses.${index}.span`} value={truss.span} label="Span" onChange={setPath} />
              <NumCell path={`roofx.trusses.${index}.wt`} value={truss.wt} label="Weight or timber" onChange={setPath} />
              <NumCell path={`roofx.trusses.${index}.no`} value={truss.no} label="No." onChange={setPath} />
              <SelectCell path={`roofx.trusses.${index}.replaces`} value={truss.replaces} label="Replaces estimate" options={typeOptionsNone} onChange={setPath} />
              <td className="calc">{total}</td>
              <td>
                <button className="x" type="button" aria-label="Delete row" onClick={() => remove("trusses", index)}>×</button>
              </td>
            </tr>
          );
        })}
      </RoofTable>
      {types.length ? null : <p className="text-muted">Add a roof type first so planes and lines can pick a covering.</p>}
    </>
  );
}

function RoofTable({
  title,
  hint,
  heads,
  empty,
  onAdd,
  children,
}: {
  title: string;
  hint: string;
  heads: string[];
  empty: string;
  onAdd: () => void;
  children: import("react").ReactNode;
}) {
  const hasRows = (Array.isArray(children) ? children : [children]).filter(Boolean).length > 0;
  return (
    <fieldset>
      <legend>
        {title}
        <span className="hint">{hint}</span>
      </legend>
      <div className="tablewrap">
        <table className="pl">
          <thead>
            <tr>
              {heads.map((head) => (
                <th key={head} className={/m²|m\)|Total/.test(head) ? "n" : undefined}>{head}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {hasRows ? children : (
              <tr>
                <td colSpan={heads.length + 1} className="text-muted" style={{ padding: 10 }}>{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="rowtools">
        <button className="btn sm" type="button" onClick={onAdd}>Add row</button>
      </div>
    </fieldset>
  );
}

function TextCell({
  path, value, label, onChange,
}: {
  path: string; value: unknown; label: string; onChange: (path: string, value: unknown) => void;
}) {
  return (
    <td>
      <div className="box">
        <input className="t" aria-label={label} value={stringOf(value)} onChange={(event) => onChange(path, event.target.value)} />
      </div>
    </td>
  );
}

function NumCell({
  path, value, label, placeholder, onChange,
}: {
  path: string; value: unknown; label: string; placeholder?: string; onChange: (path: string, value: unknown) => void;
}) {
  return (
    <td>
      <div className="box">
        <input
          inputMode="decimal"
          aria-label={label}
          placeholder={placeholder}
          value={stringOf(value)}
          onChange={(event) => onChange(path, event.target.value)}
        />
      </div>
    </td>
  );
}

function SelectCell({
  path, value, label, options, onChange,
}: {
  path: string;
  value: unknown;
  label: string;
  options: readonly { value: string; label: string }[];
  onChange: (path: string, value: unknown) => void;
}) {
  return (
    <td>
      <div className="box">
        <select aria-label={label} value={stringOf(value)} onChange={(event) => onChange(path, event.target.value)}>
          {options.map((option) => (
            <option key={option.value || option.label} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </td>
  );
}

export function RoofPlanSketch() {
  const ink = "var(--ink)";
  const core = "var(--core)";
  const steel = "var(--steel)";
  const hv = "var(--hivis)";
  const warn = "var(--warn)";
  const ok = "var(--ok)";
  const mut = "var(--muted)";
  const paper = "var(--paper)";
  const conc = "var(--conc)";
  const label = (x: number, y: number, text: string, fill = ink) => (
    <text key={`${x}-${y}-${text}`} x={x} y={y} fontSize="10.5" fontFamily="Barlow Semi Condensed, Arial" fontWeight="700" fill={fill} textAnchor="middle">
      {text}
    </text>
  );
  return (
    <svg viewBox="0 0 320 250" role="img" aria-label="Plan of an L-shaped roof showing line types">
      <rect width="320" height="250" fill={paper} />
      <path d="M30 30 H230 V130 H30 Z" fill={conc} opacity=".45" stroke={ink} strokeWidth="2" />
      <path d="M150 130 H230 V220 H150 Z" fill={conc} opacity=".45" stroke={ink} strokeWidth="2" />
      <line x1="80" y1="80" x2="180" y2="80" stroke={steel} strokeWidth="3" />
      {label(130, 74, "Ridge", steel)}
      <line x1="30" y1="30" x2="80" y2="80" stroke={core} strokeWidth="3" />
      <line x1="30" y1="130" x2="80" y2="80" stroke={core} strokeWidth="3" />
      <line x1="230" y1="30" x2="180" y2="80" stroke={core} strokeWidth="3" />
      {label(60, 48, "Hip", core)}
      <line x1="190" y1="80" x2="190" y2="220" stroke={steel} strokeWidth="3" strokeDasharray="6 3" />
      <line x1="150" y1="130" x2="190" y2="170" stroke={warn} strokeWidth="3" />
      <line x1="230" y1="130" x2="190" y2="170" stroke={warn} strokeWidth="3" />
      {label(158, 160, "Valley", warn)}
      <line x1="150" y1="220" x2="230" y2="220" stroke={ok} strokeWidth="4" />
      {label(190, 238, "Verge (gable)", ok)}
      <line x1="30" y1="30" x2="230" y2="30" stroke={hv} strokeWidth="4" />
      {label(130, 22, "Eaves")}
      <rect x="245" y="150" width="50" height="30" fill="none" stroke={mut} strokeDasharray="3 2" />
      {label(270, 196, "Opening", mut)}
      {label(80, 112, "Trapezium plane", mut)}
      {label(40, 95, "Triangle", mut)}
    </svg>
  );
}
