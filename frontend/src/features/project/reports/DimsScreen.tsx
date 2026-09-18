import { catalogue } from "@takeoff/engine";
import { asRecord, stringOf } from "../../../lib/doc.js";
import { asFullProject, useProject } from "../ProjectProvider.js";
import { useEditorComputed } from "../computed.js";
import { localeOf, money } from "./reportData.js";

export function DimsScreen() {
  const { doc, setPath } = useProject();
  const { result } = useEditorComputed();
  const locale = localeOf(doc);
  const items = result?.items ?? [];
  const locations = [...new Set(items.map((item) => item.loc))];
  const selected = stringOf(asRecord(doc?.ui).dimLoc);
  const project = asFullProject(doc);
  const cat = Object.fromEntries((project ? catalogue(project) : []).map((entry) => [entry.code, entry]));
  const shown = locations.filter((loc) => !selected || loc === selected);

  return (
    <>
      <div className="pagehead">
        <h1>Dimension sheet</h1>
        <p>Timesing × dimensions = squaring. Negative timesing is a deduction. Reinforcement lines read members × length × bars × kg/m.</p>
      </div>
      <div className="filter">
        <label htmlFor="dimLoc" style={{ fontWeight: 600 }}>Location</label>
        <select id="dimLoc" value={selected} onChange={(event) => setPath("ui.dimLoc", event.target.value)}>
          <option value="">All ({locations.length})</option>
          {locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </div>
      <div className="scroll">
        <table className="dt">
          <thead>
            <tr>
              <th className="n">Times</th>
              <th className="n">Dim 1</th>
              <th className="n">Dim 2</th>
              <th className="n">Dim 3</th>
              <th className="n">Squaring</th>
              <th>Unit</th>
              <th>Description</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((loc) => (
              <LocationBlock
                key={loc}
                loc={loc}
                locale={locale}
                items={items.filter((item) => item.loc === loc)}
                cat={cat}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function LocationBlock({
  loc,
  items,
  cat,
  locale,
}: {
  loc: string;
  items: { times: number; d1: number | null; d2: number | null; d3: number | null; q: number; code: string }[];
  cat: Record<string, { unit: string; desc: string }>;
  locale: string;
}) {
  const dim = (value: number | null) => (value == null ? "" : money(value, 3, locale));
  return (
    <>
      <tr className="ph"><td colSpan={8}>{loc}</td></tr>
      {items.map((item, index) => {
        const entry = cat[item.code] ?? { unit: "", desc: item.code };
        const unit = entry.unit === "t" ? "kg" : entry.unit;
        return (
          <tr key={`${item.code}-${index}`}>
            <td className="n">{money(item.times, Number.isInteger(item.times) ? 0 : 3, locale)}</td>
            <td className="n">{dim(item.d1)}</td>
            <td className="n">{dim(item.d2)}</td>
            <td className="n">{dim(item.d3)}</td>
            <td className="n sq">{money(item.q, 3, locale)}</td>
            <td>{unit}</td>
            <td>{entry.desc}</td>
            <td className="code">{item.code}</td>
          </tr>
        );
      })}
    </>
  );
}
