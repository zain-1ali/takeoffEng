import {
  createCompleteBuildingExample,
  type FullBuildingProject,
} from "@takeoff/engine";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useComputed } from "../features/editor/useComputed.js";
import { DiaChips, NumberField, Readout, SelectField, Switch, TextField } from "../ui/index.js";

export function KitPage() {
  const [formula, setFormula] = useState("20*15+4*2.5");
  const [name, setName] = useState("Pad F1");
  const [roofMode, setRoofMode] = useState("simple");
  const [wsOn, setWsOn] = useState(true);
  const [dia, setDia] = useState(16);
  const [padLength, setPadLength] = useState("1.8");

  const project = useMemo(() => {
    const next = structuredClone(createCompleteBuildingExample()) as FullBuildingProject;
    const pad = next.types.pad[0];
    if (pad) pad.L = padLength;
    return next;
  }, [padLength]);

  const computed = useComputed(project);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans">
      <header className="sticky top-0 z-30 flex min-h-[62px] flex-wrap items-center gap-3.5 bg-ink px-5 py-2.5 text-white">
        <div className="flex min-w-0 flex-1 flex-col">
          <Link to="/" className="font-cond text-[21px] font-semibold leading-tight text-white no-underline">
            TakeOff Studio
          </Link>
          <small className="text-xs text-[#9fb0bf]">UI kit · NumberField · engine worker</small>
        </div>
        <span className="rounded-md bg-hivis px-3.5 py-2 text-sm font-semibold text-ink">Phase 5</span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-cond text-[34px] font-normal leading-tight">UI kit</h1>
        <p className="mt-1 max-w-[75ch] text-muted">
          Number fields keep the formula you type, show the evaluated result, and the engine
          recomputes in a Web Worker after 150 ms.
        </p>

        <fieldset className="mt-6 rounded-[10px] border border-line bg-surface p-5">
          <legend className="px-1 text-[17px] font-bold">Inputs</legend>
          <div className="mt-3 flex flex-wrap gap-4">
            <div className="w-[178px]">
              <NumberField
                label="Room area"
                value={formula}
                onChange={setFormula}
                unit="m²"
                step={0.1}
              />
            </div>
            <div className="w-[178px]">
              <NumberField
                label="Pad F1 length"
                value={padLength}
                onChange={setPadLength}
                unit="m"
                step={0.1}
              />
            </div>
            <div className="w-[220px]">
              <TextField label="Type mark" value={name} onChange={setName} />
            </div>
            <div className="w-[220px]">
              <SelectField
                label="Roof method"
                value={roofMode}
                onChange={setRoofMode}
                options={[
                  { value: "simple", label: "Simple roof – rectangles" },
                  { value: "complex", label: "Complex roof – planes and lines" },
                ]}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-6">
            <Switch checked={wsOn} onChange={setWsOn} label="Working space" />
            <DiaChips label="Bar diameter (mm)" value={dia} onChange={setDia} />
          </div>
        </fieldset>

        <fieldset className="mt-6 rounded-[10px] border border-line bg-surface p-5">
          <legend className="px-1 text-[17px] font-bold">
            Engine worker{" "}
            <span className="hint font-normal text-[13px] text-muted">
              {computed.status === "ready" ? "ready" : computed.status}
              {computed.error ? ` · ${computed.error}` : ""}
            </span>
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Readout label="Concrete" value={computed.totals?.concrete ?? 0} digits={1} unit="m³" />
            <Readout label="Steel" value={(computed.totals?.steelKg ?? 0) / 1000} digits={2} unit="t" />
            <Readout label="Formwork" value={computed.totals?.formwork ?? 0} digits={0} unit="m²" />
            <Readout label="BOQ total" value={computed.totals?.total ?? 0} digits={0} />
          </div>
          <p className="mt-3 text-sm text-muted">
            Example building: {computed.totals?.itemCount ?? "–"} measured items ·{" "}
            {computed.boq?.items.length ?? "–"} BOQ items. Change pad length to recompute.
          </p>
          <ul className="mt-2 text-sm text-muted">
            {computed.params.slice(0, 6).map(([label, value]) => (
              <li key={label}>
                <span className="font-semibold text-ink">{label}: </span>
                {value}
              </li>
            ))}
          </ul>
        </fieldset>
      </main>
    </div>
  );
}
