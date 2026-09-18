import { asList, asRecord, stringOf } from "../../lib/doc.js";
import { formatNumber } from "../../lib/format.js";
import { useEditorComputed } from "./computed.js";
import { asFullProject, useProject } from "./ProjectProvider.js";
import { KIND_LABEL, TYPE_SCHEMA } from "./schema.js";
import { RoofPlanSketch } from "./RoofComplex.js";
import { TypeDrawing } from "./TypeDrawing.js";
import {
  catalogLines,
  excavation,
  kindConcrete,
  kindFormwork,
  kindItems,
  kindSteel,
  memberTypeCount,
  usesCatalogQty,
} from "./qty.js";

function Quick({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return <p className="text-muted">Add rows to see quantities.</p>;
  return (
    <div className="quick">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}

function WholeStructure() {
  const { doc } = useProject();
  const { result } = useEditorComputed();
  if (!doc || !result) {
    return (
      <div>
        <h3>Whole structure</h3>
        <p className="text-muted">Computing…</p>
      </div>
    );
  }
  return (
    <div>
      <h3>Whole structure</h3>
      <Quick
        rows={[
          { label: "Concrete", value: `${formatNumber(result.concrete, 1)} m³` },
          { label: "Reinforcement", value: `${formatNumber(result.steelKg / 1000, 3)} t` },
          { label: "Formwork", value: `${formatNumber(result.formwork, 0)} m²` },
          { label: "Excavation", value: `${formatNumber(excavation(result), 1)} m³` },
          { label: "Bar marks", value: String(result.bars.length) },
          { label: "Member types", value: String(memberTypeCount(doc)) },
        ]}
      />
    </div>
  );
}

export function SidePanel({ view }: { view: string }) {
  const { doc } = useProject();
  const { result } = useEditorComputed();
  if (!doc) return null;
  if (!TYPE_SCHEMA[view]) return <WholeStructure />;

  const types = asList(asRecord(doc.types)[view]);
  const selected = Number(asRecord(asRecord(doc.ui).sel)[view] || 0);
  const type = types[Math.min(Math.max(0, selected), Math.max(0, types.length - 1))] ?? null;
  const complexRoof = view === "roof" && stringOf(doc.roofMode, "simple") === "complex";
  const items = complexRoof
    ? (result?.items.filter((item) => item.loc.startsWith("Complex roof")) ?? [])
    : kindItems(result, view);
  const conc = kindConcrete(items);
  const kg = kindSteel(result, view);
  const fw = kindFormwork(items);
  const catalog = usesCatalogQty(view)
    ? catalogLines(asFullProject(doc), items).map((row) => (
      view === "roof"
        ? { ...row, label: row.label.replace(/ \(roof .*\)/, "") }
        : row
    ))
    : [];
  const heading = view === "pad" || view === "strip" || view === "gbeam"
    ? "All foundations"
    : `${KIND_LABEL[view] ?? view}`;

  return (
    <>
      <div>
        <h3>{type ? `${stringOf(type.mark)} section` : view === "roof" ? "Roof type" : "Section"}</h3>
        <TypeDrawing kind={view} type={type} rules={asRecord(doc.rules)} />
        {complexRoof ? (
          <>
            <h3>Roof planes and lines</h3>
            <RoofPlanSketch />
          </>
        ) : null}
      </div>
      <div>
        {usesCatalogQty(view) ? (
          <>
            <h3>{complexRoof ? "Complex roof – quantities" : `${KIND_LABEL[view] ?? view} – quantities`}</h3>
            <Quick rows={catalog} />
          </>
        ) : (
          <>
            <h3>{heading}</h3>
            <Quick
              rows={[
                { label: "Concrete", value: `${formatNumber(conc, 2)} m³` },
                { label: "Reinforcement", value: `${formatNumber(kg, 0)} kg` },
                { label: "Steel ratio", value: conc ? `${formatNumber(kg / conc, 0)} kg/m³` : "–" },
                { label: "Formwork", value: `${formatNumber(fw, 1)} m²` },
              ]}
            />
            <h3 style={{ marginTop: 16 }}>Whole structure</h3>
            <Quick
              rows={[
                { label: "Concrete", value: `${formatNumber(result?.concrete ?? 0, 1)} m³` },
                { label: "Reinforcement", value: `${formatNumber((result?.steelKg ?? 0) / 1000, 3)} t` },
                { label: "Formwork", value: `${formatNumber(result?.formwork ?? 0, 0)} m²` },
              ]}
            />
          </>
        )}
      </div>
    </>
  );
}
