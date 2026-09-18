import { NumberField } from "../../ui/index.js";
import { asRecord, stringOf } from "../../lib/doc.js";
import { useProject } from "./ProjectProvider.js";

export function BearingsScreen() {
  const { doc, setPath } = useProject();
  if (!doc) return null;
  const bacc = asRecord(doc.bacc);

  return (
    <>
      <div className="pagehead">
        <h1>Bearings & finishes</h1>
        <p>Items measured by number, length or area rather than from member schedules.</p>
      </div>
      <fieldset>
        <legend>Bearings and joints</legend>
        <div className="grid">
          <NumberField label="Bearings" unit="No." step={1} value={stringOf(bacc.bearings)} onChange={(value) => setPath("bacc.bearings", value)} />
          <NumberField label="Expansion joints" unit="m" step={0.5} value={stringOf(bacc.joints)} onChange={(value) => setPath("bacc.joints", value)} />
        </div>
      </fieldset>
      <fieldset>
        <legend>Deck finishes</legend>
        <div className="grid">
          <NumberField label="Waterproofing" unit="m²" step={5} value={stringOf(bacc.wp)} onChange={(value) => setPath("bacc.wp", value)} />
          <NumberField label="Surfacing area" unit="m²" step={5} value={stringOf(bacc.surf)} onChange={(value) => setPath("bacc.surf", value)} />
          <NumberField label="Surfacing thickness" unit="mm" step={5} value={stringOf(bacc.surfT)} onChange={(value) => setPath("bacc.surfT", value)} />
          <NumberField label="Drainage spouts" unit="No." step={1} value={stringOf(bacc.spouts)} onChange={(value) => setPath("bacc.spouts", value)} />
          <NumberField label="Handrail" unit="m" step={1} value={stringOf(bacc.rail)} onChange={(value) => setPath("bacc.rail", value)} />
        </div>
      </fieldset>
      <fieldset>
        <legend>Abutment backfill</legend>
        <div className="grid">
          <NumberField label="Granular backfill" unit="m³" step={5} value={stringOf(bacc.backfill)} onChange={(value) => setPath("bacc.backfill", value)} />
        </div>
      </fieldset>
    </>
  );
}
