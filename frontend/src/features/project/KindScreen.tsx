import { DiaChips, NumberField, SelectField, Switch, TextField } from "../../ui/index.js";
import { asList, asRecord, stringOf, type DocMap } from "../../lib/doc.js";
import { formatNumber } from "../../lib/format.js";
import { useEditorComputed } from "./computed.js";
import {
  KIND_INTRO,
  KIND_LABEL,
  LEVELLED,
  NO_CONC_STEEL,
  PL_SCHEMA,
  TYPE_SCHEMA,
  activeLevels,
  addType,
  blankRow,
  copyUp,
  deleteType,
  duplicateType,
  optionLabel,
  typeSummary,
  type TypeField,
} from "./schema.js";
import { typeUseLabel } from "./qty.js";
import { RoofPicker, RoofxSections } from "./RoofComplex.js";
import { useProject } from "./ProjectProvider.js";
import { useState } from "react";

export function KindScreen({ kind }: { kind: string }) {
  const { doc, setPath, replaceDoc } = useProject();
  const computed = useEditorComputed();
  if (!doc) return null;
  const types = asList(asRecord(doc.types)[kind]);
  const selected = Number(asRecord(doc.ui).sel && asRecord(asRecord(doc.ui).sel)[kind] || 0);
  const index = Math.min(Math.max(0, selected), Math.max(0, types.length - 1));
  const current = types[index] ?? null;
  const schema = TYPE_SCHEMA[kind] ?? [];
  const stats = current ? computed.result?.byType[stringOf(current.id)] : undefined;
  const used = current ? asList(asRecord(doc.pl)[kind]).filter((row) => row.type === current.id).length : 0;

  function select(next: number) {
    setPath(`ui.sel.${kind}`, next);
  }

  return (
    <>
      <div className="pagehead">
        <h1>{KIND_LABEL[kind] ?? kind}</h1>
        <p>{KIND_INTRO[kind] ?? "Schedule the types, then say where they occur."}</p>
      </div>
      <fieldset>
        <legend>
          Types
          <span className="hint">{types.length} type{types.length === 1 ? "" : "s"} in the schedule</span>
        </legend>
        <div className="types">
          {types.map((type, i) => (
            <button
              key={stringOf(type.id, String(i))}
              type="button"
              className="tchip"
              aria-current={i === index || undefined}
              onClick={() => select(i)}
            >
              <b>{stringOf(type.mark, "?")}</b>
              <small>{typeSummary(kind, type)}</small>
              <small>{typeUseLabel(kind, computed.result?.byType[stringOf(type.id)])}</small>
            </button>
          ))}
          <button
            type="button"
            className="tchip add"
            onClick={() => {
              const result = addType(doc, kind, index);
              replaceDoc(result.doc);
            }}
          >
            Add type
          </button>
        </div>
        {current ? (
          <>
            {schema.map(([group, hint, fields]) => (
              <div className="grp" key={group}>
                <div className="gname">
                  {group}
                  {hint ? <small>{hint}</small> : null}
                </div>
                <div className="gfields">
                  {fields.map((field) => (
                    <TypeFieldControl
                      key={field[0]}
                      value={current[field[0]]}
                      field={field}
                      onChange={(value) => setPath(`types.${kind}.${index}.${field[0]}`, value)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className="typetools">
              <span className="lbl" style={{ marginRight: "auto" }}>
                {stats?.uses
                  ? (stats.conc || stats.kg
                    ? `${current.mark}: ${formatNumber(stats.conc, 2)} m³ concrete, ${formatNumber(stats.kg, 0)} kg steel`
                    : `${current.mark} is used in ${stats.uses} row${stats.uses === 1 ? "" : "s"}`)
                  : `${current.mark} is not used yet – add rows below.`}
              </span>
              <button className="btn sm" type="button" onClick={() => replaceDoc(duplicateType(doc, kind, index).doc)}>
                Duplicate {stringOf(current.mark)}
              </button>
              <button
                className="btn sm danger"
                type="button"
                onClick={() => {
                  if (!confirm(used ? `${current.mark} is used in ${used} row(s). Delete the type and those rows?` : `Delete ${current.mark}?`)) return;
                  const result = deleteType(doc, kind, index);
                  replaceDoc(result.doc);
                }}
              >
                Delete {stringOf(current.mark)}
              </button>
            </div>
          </>
        ) : (
          <div className="empty">No types yet. Use Add type to create the first one.</div>
        )}
      </fieldset>
      {kind === "roof" ? <RoofPicker /> : null}
      {kind === "cfin" ? (
        <fieldset>
          <legend>Where they are used</legend>
          <p className="text-muted" style={{ margin: 0 }}>
            Assign ceiling finishes to each room in the room finishes schedule.
          </p>
        </fieldset>
      ) : kind === "roof" && stringOf(doc.roofMode, "simple") === "complex" ? (
        <RoofxSections />
      ) : (
        <PlacementTable kind={kind} />
      )}
      {kind === "gbeam" ? <GroundSlabFields /> : null}
    </>
  );
}

function TypeFieldControl({
  field,
  value,
  onChange,
}: {
  field: TypeField;
  value: unknown;
  onChange: (value: string | number | boolean) => void;
}) {
  const [, label, kind, extra, step] = field;
  if (kind === "text") return <TextField label={label} value={stringOf(value)} onChange={onChange} />;
  if (kind === "bool") return <div className="f" style={{ paddingBottom: 6 }}><Switch label={label} checked={Boolean(value)} onChange={onChange} /></div>;
  if (kind === "dia") return <div className="f wide"><DiaChips label={label} value={value as number | string} onChange={onChange} /></div>;
  if (kind === "sel") {
    const options = (Array.isArray(extra) ? extra : []).map((item) => ({ value: item, label: optionLabel(item) }));
    return <SelectField label={label} value={stringOf(value)} onChange={onChange} options={options} />;
  }
  return (
    <NumberField
      label={label}
      value={stringOf(value)}
      onChange={onChange}
      unit={typeof extra === "string" ? extra : undefined}
      step={step ?? 1}
    />
  );
}

function PlacementTable({ kind }: { kind: string }) {
  const { doc, setPath, replaceDoc } = useProject();
  const computed = useEditorComputed();
  const levels = doc ? activeLevels(doc) : [];
  const [copyFrom, setCopyFrom] = useState(stringOf(levels[0]?.id));
  if (!doc) return null;
  const state = doc;
  const schema = PL_SCHEMA[kind];
  if (!schema) return null;
  const types = asList(asRecord(doc.types)[kind]);
  const rows = asList(asRecord(doc.pl)[kind]);
  const noCS = NO_CONC_STEEL.has(kind);
  const colSpan = schema.length + (LEVELLED.has(kind) ? 1 : 0) + (noCS ? 0 : 2) + 1;

  function add(levelId?: string) {
    const next = structuredClone(state);
    const list = asList(asRecord(next.pl)[kind]);
    list.push(blankRow(kind, state, stringOf(types[0]?.id), levelId));
    asRecord(next.pl)[kind] = list;
    replaceDoc(next);
  }

  function remove(index: number) {
    const next = structuredClone(state);
    const list = asList(asRecord(next.pl)[kind]);
    list.splice(index, 1);
    asRecord(next.pl)[kind] = list;
    replaceDoc(next);
  }

  function copyAbove() {
    const fromId = copyFrom || stringOf(levels[0]?.id);
    const fromIndex = levels.findIndex((level) => stringOf(level.id) === fromId);
    if (fromIndex < 0 || fromIndex === levels.length - 1) {
      window.alert("Choose a level that has levels above it");
      return;
    }
    const count = levels.length - fromIndex - 1;
    if (!confirm(`Replace ${KIND_LABEL[kind]?.toLowerCase() ?? kind} rows on ${count} level(s) above with a copy of ${stringOf(levels[fromIndex]?.name)}?`)) return;
    const next = copyUp(state, kind, fromId);
    if (next) replaceDoc(next);
  }

  if (!types.length) {
    return (
      <fieldset>
        <legend>Where they occur</legend>
        <div className="empty">Add a type first.</div>
      </fieldset>
    );
  }

  const drawRow = (row: DocMap, index: number) => {
    const stats = computed.result?.byPlacement[stringOf(row.id)];
    return (
      <tr key={stringOf(row.id, String(index))}>
        {LEVELLED.has(kind) ? (
          <td>
            <div className="box">
              <select
                aria-label="Level"
                value={stringOf(row.level)}
                onChange={(event) => setPath(`pl.${kind}.${index}.level`, event.target.value)}
              >
                {levels.map((level) => (
                  <option key={stringOf(level.id)} value={stringOf(level.id)}>{stringOf(level.name)}</option>
                ))}
              </select>
            </div>
          </td>
        ) : null}
        {schema.map(([key, label, fieldKind, extra]) => (
          <td key={key}>
            <PlacementCell
              kind={fieldKind}
              extra={extra}
              label={label}
              value={row[key]}
              types={types}
              doc={state}
              onChange={(value) => setPath(`pl.${kind}.${index}.${key}`, value)}
            />
          </td>
        ))}
        {noCS ? null : (
          <>
            <td className="calc">{stats?.conc ? `${formatNumber(stats.conc, 2)} m³` : "–"}</td>
            <td className="calc">{stats?.kg ? `${formatNumber(stats.kg, 0)} kg` : "–"}</td>
          </>
        )}
        <td>
          <button className="x" type="button" aria-label="Delete row" onClick={() => remove(index)}>×</button>
        </td>
      </tr>
    );
  };

  return (
    <fieldset>
      <legend>
        {kind === "ffin" ? "Room finishes schedule" : kind === "wfin" ? "Other surfaces" : kind === "roof" ? "Simple roofs" : "Where they occur"}
        <span className="hint">{LEVELLED.has(kind) ? "Grouped by level" : kind === "roof" ? "Plan length × width" : "Foundation level"}</span>
      </legend>
      <div className="tablewrap">
        <table className="pl">
          <thead>
            <tr>
              {LEVELLED.has(kind) ? <th>Level</th> : null}
              {schema.map(([key, label, fieldKind, extra]) => (
                <th key={key}>
                  {label}
                  {typeof extra === "string" && fieldKind !== "ftype" ? ` (${extra})` : ""}
                </th>
              ))}
              {noCS ? null : <><th className="n">Concrete</th><th className="n">Steel</th></>}
              <th />
            </tr>
          </thead>
          <tbody>
            {LEVELLED.has(kind)
              ? levels.map((level) => {
                const id = stringOf(level.id);
                return (
                  <FragmentLevel key={id} name={stringOf(level.name)} colSpan={colSpan} onAdd={() => add(id)}>
                    {rows.map((row, index) => stringOf(row.level) === id ? drawRow(row, index) : null)}
                  </FragmentLevel>
                );
              })
              : rows.map((row, index) => drawRow(row, index))}
          </tbody>
        </table>
      </div>
      <div className="rowtools">
        {LEVELLED.has(kind) ? null : (
          <button className="btn sm" type="button" onClick={() => add()}>Add row</button>
        )}
        {LEVELLED.has(kind) && levels.length > 1 ? (
          <>
            <span className="lbl">Copy rows from</span>
            <div className="box" style={{ width: 180 }}>
              <select aria-label="Copy from level" value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}>
                {levels.map((level) => (
                  <option key={stringOf(level.id)} value={stringOf(level.id)}>{stringOf(level.name)}</option>
                ))}
              </select>
            </div>
            <button className="btn sm" type="button" onClick={copyAbove}>to all levels above</button>
          </>
        ) : null}
      </div>
    </fieldset>
  );
}

function FragmentLevel({
  name,
  onAdd,
  colSpan,
  children,
}: {
  name: string;
  onAdd: () => void;
  colSpan: number;
  children: import("react").ReactNode;
}) {
  return (
    <>
      <tr className="lvlhead">
        <td colSpan={colSpan}>
          {name}{" "}
          <button className="btn sm ghost" type="button" onClick={onAdd} style={{ marginLeft: 8, padding: "1px 8px" }}>
            Add row
          </button>
        </td>
      </tr>
      {children}
    </>
  );
}

function PlacementCell({
  kind,
  extra,
  label,
  value,
  types,
  doc,
  onChange,
}: {
  kind: string;
  extra?: string | readonly string[];
  label: string;
  value: unknown;
  types: DocMap[];
  doc: DocMap;
  onChange: (value: string) => void;
}) {
  if (kind === "type") {
    return (
      <div className="box">
        <select aria-label={label} value={stringOf(value)} onChange={(event) => onChange(event.target.value)}>
          {types.map((type) => (
            <option key={stringOf(type.id)} value={stringOf(type.id)}>{stringOf(type.mark)}</option>
          ))}
        </select>
      </div>
    );
  }
  if (kind === "ftype") {
    const others = asList(asRecord(doc.types)[String(extra)]);
    return (
      <div className="box">
        <select aria-label={label} value={stringOf(value)} onChange={(event) => onChange(event.target.value)}>
          <option value="">None</option>
          {others.map((type) => (
            <option key={stringOf(type.id)} value={stringOf(type.id)}>{stringOf(type.mark)}</option>
          ))}
        </select>
      </div>
    );
  }
  if (kind === "sel") {
    const options = Array.isArray(extra) ? extra : [];
    return (
      <div className="box">
        <select aria-label={label} value={stringOf(value)} onChange={(event) => onChange(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
    );
  }
  if (kind === "text") {
    return (
      <div className="box">
        <input className="t" aria-label={label} value={stringOf(value)} onChange={(event) => onChange(event.target.value)} />
      </div>
    );
  }
  return (
    <div className="box">
      <input
        inputMode="decimal"
        aria-label={label}
        value={stringOf(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function GroundSlabFields() {
  const { setPath, doc } = useProject();
  const sog = asRecord(doc?.sog);
  return (
    <fieldset>
      <legend>Ground-bearing slab <span className="hint">Measured net of openings</span></legend>
      <div className="grid">
        <NumberField label="Slab area" unit="m²" step={5} value={stringOf(sog.area)} onChange={(value) => setPath("sog.area", value)} />
        <NumberField label="Edge length" unit="m" step={1} value={stringOf(sog.edge)} onChange={(value) => setPath("sog.edge", value)} />
        <NumberField label="Slab thickness" unit="mm" step={25} value={stringOf(sog.t)} onChange={(value) => setPath("sog.t", value)} />
        <NumberField label="Hardcore" unit="mm" step={25} value={stringOf(sog.hardcore)} onChange={(value) => setPath("sog.hardcore", value)} />
        <NumberField label="Sand blinding" unit="mm" step={10} value={stringOf(sog.sand)} onChange={(value) => setPath("sog.sand", value)} />
        <TextField label="Fabric mesh" value={stringOf(sog.mesh)} onChange={(value) => setPath("sog.mesh", value)} />
        <NumberField label="Topsoil strip" unit="mm" step={25} value={stringOf(sog.topsoil)} onChange={(value) => setPath("sog.topsoil", value)} />
      </div>
      <div className="toggles">
        <Switch label="Damp-proof membrane" checked={Boolean(sog.dpm)} onChange={(value) => setPath("sog.dpm", value)} />
      </div>
    </fieldset>
  );
}
