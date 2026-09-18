import { DEFAULT_MATERIAL_FACTORS } from "@takeoff/engine";
import { NumberField, Switch } from "../../ui/index.js";
import { asRecord, stringOf } from "../../lib/doc.js";
import { useProject } from "./ProjectProvider.js";
import { DEFAULT_MIXES, resetToExample } from "./schema.js";

const COVER_FIELDS = [
  ["cF", "Footings", "mm", 5],
  ["cC", "Columns", "mm", 5],
  ["cB", "Beams", "mm", 5],
  ["cS", "Slabs & stairs", "mm", 5],
  ["cW", "Walls", "mm", 5],
] as const;

const BAR_FIELDS = [
  ["anchF", "Footing bend per end", "× dia", 1],
  ["anchB", "Beam anchorage per end", "× dia", 5],
  ["anchS", "Slab & wall anchorage", "× dia", 5],
  ["lap", "Lap length", "× dia", 5],
  ["hook", "Link hooks total", "× dia", 1],
  ["stock", "Stock bar length", "m", 1],
] as const;

const FACTOR_FIELDS = [
  ["concWaste", "Concrete waste", "%"],
  ["steelWaste", "Steel waste", "%"],
  ["stock", "Stock bar length", "m"],
  ["wire", "Binding wire", "kg/t"],
  ["meshLap", "Mesh laps", "%"],
  ["meshWaste", "Mesh waste", "%"],
  ["uses", "Formwork uses", "No."],
  ["fwWaste", "Formwork waste", "%"],
  ["timber", "Timber", "m/m²"],
  ["nails", "Nails", "kg/m²"],
  ["compact", "Loose factor", "×"],
  ["att", "Anti-termite", "l/m²"],
  ["aggWaste", "Aggregate waste", "%"],
  ["asWaste", "Asphalt waste", "%"],
  ["prime", "Prime coat", "l/m²"],
  ["tack", "Tack coat", "l/m²"],
  ["bitWaste", "Bitumen waste", "%"],
  ["pipeLen", "Pipe unit length", "m"],
  ["paint", "Road marking", "kg/m"],
] as const;

export function RulesScreen() {
  const { doc, setPath, replaceDoc } = useProject();
  if (!doc) return null;
  const state = doc;
  const rules = asRecord(state.rules);
  const mat = { ...DEFAULT_MATERIAL_FACTORS, ...asRecord(state.mat) };
  const mix = { ...DEFAULT_MIXES, ...asRecord(state.mix) } as Record<string, { cem: number; sand: number; agg: number }>;
  const classes = Object.keys(mix).sort((a, b) => Number(a) - Number(b));

  function reset() {
    if (!confirm("Replace everything with the example project? Unsaved edits in this document will be lost.")) return;
    replaceDoc(resetToExample(state));
  }

  return (
    <>
      <div className="pagehead">
        <h1>Covers & rules</h1>
        <p>Concrete covers, bar anchorage and lap allowances used for every bar length, plus earthworks rules.</p>
      </div>
      <fieldset>
        <legend>Concrete cover</legend>
        <div className="grid">
          {COVER_FIELDS.map(([key, label, unit, step]) => (
            <NumberField
              key={key}
              label={label}
              unit={unit}
              step={step}
              value={stringOf(rules[key])}
              onChange={(value) => setPath(`rules.${key}`, value)}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Bar lengths</legend>
        <div className="grid">
          {BAR_FIELDS.map(([key, label, unit, step]) => (
            <NumberField
              key={key}
              label={label}
              unit={unit}
              step={step}
              value={stringOf(rules[key])}
              onChange={(value) => setPath(`rules.${key}`, value)}
            />
          ))}
        </div>
        <p className="text-muted" style={{ margin: "10px 0 0" }}>
          Continuous bars longer than the stock length get one lap per extra stock length. Unit weight = d² ÷ 162.2 kg/m.
        </p>
      </fieldset>
      <fieldset>
        <legend>Earthworks</legend>
        <div className="grid">
          <NumberField label="Working space each side" unit="m" step={0.05} value={stringOf(rules.ws)} onChange={(value) => setPath("rules.ws", value)} />
          <NumberField label="Blinding thickness" unit="mm" step={5} value={stringOf(rules.blinding)} onChange={(value) => setPath("rules.blinding", value)} />
        </div>
        <div className="toggles">
          <Switch label="Include working space" checked={Boolean(rules.wsOn)} onChange={(value) => setPath("rules.wsOn", value)} />
          <Switch label="Measure earthwork support" checked={Boolean(rules.supOn)} onChange={(value) => setPath("rules.supOn", value)} />
          <Switch label="Measure anti-termite treatment" checked={Boolean(rules.attOn)} onChange={(value) => setPath("rules.attOn", value)} />
        </div>
      </fieldset>
      <fieldset>
        <legend>
          Material factors
          <span className="hint">Edit to match your mix designs and site practice</span>
        </legend>
        <div className="toggles" style={{ marginBottom: 12 }}>
          <Switch label="Ready-mix concrete" checked={Boolean(mat.readymix)} onChange={(value) => setPath("mat.readymix", value)} />
        </div>
        <div className="scroll" style={{ marginBottom: 14 }}>
          <table className="dt" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th>Concrete class</th>
                <th>Cement (kg/m³)</th>
                <th>Sand (m³/m³)</th>
                <th>Aggregate (m³/m³)</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((grade) => {
                const row = mix[grade] ?? DEFAULT_MIXES[grade]!;
                return (
                  <tr key={grade}>
                    <td><b>C{grade}</b> and above</td>
                    {(["cem", "sand", "agg"] as const).map((key) => (
                      <td key={key} style={{ padding: "4px 8px" }}>
                        <div className="box">
                          <input
                            inputMode="decimal"
                            aria-label={`C${grade} ${key}`}
                            value={stringOf(row[key])}
                            onChange={(event) => setPath(`mix.${grade}.${key}`, event.target.value)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid">
          {FACTOR_FIELDS.map(([key, label, unit]) => (
            <NumberField
              key={key}
              label={label}
              unit={unit}
              step={key === "nails" || key === "tack" ? 0.05 : 1}
              value={stringOf(asRecord(mat)[key])}
              onChange={(value) => setPath(`mat.${key}`, value)}
            />
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn sm danger" type="button" onClick={reset}>
            Reset everything to the example project
          </button>
        </div>
      </fieldset>
    </>
  );
}
