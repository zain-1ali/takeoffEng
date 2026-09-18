import { n, type NumericInput } from "@takeoff/engine";
import { NumberField } from "../../ui/index.js";
import { asList, asRecord, stringOf } from "../../lib/doc.js";
import { formatNumber } from "../../lib/format.js";
import { useProject } from "./ProjectProvider.js";

const FIELDS = [
  ["kerb", "Kerbs", "m", 50],
  ["lines", "Marking lines", "No.", 1],
  ["signs", "Road signs", "No.", 1],
  ["grail", "Guardrail", "m", 10],
  ["studs", "Road studs", "No.", 10],
  ["kmp", "Kilometre posts", "No.", 1],
] as const;

export function RoadFurnitureScreen() {
  const { doc, setPath } = useProject();
  if (!doc) return null;
  const road = asRecord(doc.road);
  const length = asList(asRecord(doc.pl).rpave).reduce((sum, row) => (
    sum + Math.abs(n((row.to ?? 0) as NumericInput) - n((row.from ?? 0) as NumericInput))
  ), 0);

  return (
    <>
      <div className="pagehead">
        <h1>Road furniture</h1>
        <p>Kerbs, markings, signs and safety items. Marking length = number of continuous lines × total road length.</p>
      </div>
      <fieldset>
        <legend>
          Furniture and markings
          <span className="hint">Total road length {formatNumber(length, 0)} m</span>
        </legend>
        <div className="grid">
          {FIELDS.map(([key, label, unit, step]) => (
            <NumberField
              key={key}
              label={label}
              unit={unit}
              step={step}
              value={stringOf(road[key])}
              onChange={(value) => setPath(`road.${key}`, value)}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}
