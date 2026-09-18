import { type ReactNode } from "react";
import { asRecord, stringOf } from "../../../lib/doc.js";
import { useProject } from "../ProjectProvider.js";
import { useEditorComputed } from "../computed.js";
import { filterBars, localeOf, money } from "./reportData.js";

export function BbsScreen() {
  const { doc, setPath } = useProject();
  const { result } = useEditorComputed();
  const locale = localeOf(doc);
  const bars = result?.bars ?? [];
  const levels = result?.levels ?? [];
  const ui = asRecord(doc?.ui);
  const element = stringOf(ui.bbsEl);
  const levelName = stringOf(ui.bbsLv);
  const elements = [...new Set(bars.map((bar) => bar.el))];
  const levelNames = ["Foundations", ...levels.map((level) => level.name)];
  const shown = filterBars(bars, levels, element, levelName);
  const kg = shown.reduce((sum, bar) => sum + bar.kg, 0);
  let last = "";

  return (
    <>
      <div className="pagehead">
        <h1>Bar schedule</h1>
        <p>Every bar mark with number of members, bars in each, length and weight. Lengths include cover, anchorage, hooks and laps from Covers & rules.</p>
      </div>
      <div className="filter">
        <label htmlFor="bbsEl" style={{ fontWeight: 600 }}>Element</label>
        <select id="bbsEl" value={element} onChange={(event) => setPath("ui.bbsEl", event.target.value)}>
          <option value="">All</option>
          {elements.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <label htmlFor="bbsLv" style={{ fontWeight: 600 }}>Level</label>
        <select id="bbsLv" value={levelName} onChange={(event) => setPath("ui.bbsLv", event.target.value)}>
          <option value="">All</option>
          {levelNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontFamily: "var(--cond)", fontWeight: 700, fontSize: 18 }}>
          {money(kg, 1, locale)} kg shown
        </span>
      </div>
      <div className="scroll">
        <table className="dt">
          <thead>
            <tr>
              <th>Bar mark</th>
              <th>Shape</th>
              <th className="n">Dia</th>
              <th className="n">No. of members</th>
              <th className="n">Bars in each</th>
              <th className="n">Total bars</th>
              <th className="n">Length each (m)</th>
              <th className="n">Total length (m)</th>
              <th className="n">Weight (kg)</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((bar) => {
              const head = bar.loc !== last;
              last = bar.loc;
              return (
                <RowGroup key={`${bar.loc}-${bar.mark}-${bar.dia}-${bar.shape}`} showHead={head} loc={bar.loc}>
                  <td><b>{bar.mark}</b></td>
                  <td>{bar.shape}</td>
                  <td className="n">{bar.dia}</td>
                  <td className="n">{money(bar.members, 0, locale)}</td>
                  <td className="n">{money(bar.each, 0, locale)}</td>
                  <td className="n">{money(bar.members * bar.each, 0, locale)}</td>
                  <td className="n">{money(bar.len, 3, locale)}</td>
                  <td className="n">{money(bar.total, 2, locale)}</td>
                  <td className="n sq">{money(bar.kg, 1, locale)}</td>
                </RowGroup>
              );
            })}
            {!shown.length ? <tr><td colSpan={9} className="empty">No bars match this filter.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RowGroup({
  showHead,
  loc,
  children,
}: {
  showHead: boolean;
  loc: string;
  children: ReactNode;
}) {
  return (
    <>
      {showHead ? <tr className="ph"><td colSpan={9}>{loc}</td></tr> : null}
      <tr>{children}</tr>
    </>
  );
}