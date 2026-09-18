import { NumberField, TextField } from "../../ui/index.js";
import { asList, asRecord, stringOf, uid, type DocMap } from "../../lib/doc.js";
import { LEVELLED } from "./schema.js";
import { useProject } from "./ProjectProvider.js";
import { formatNumber } from "../../lib/format.js";
import { n } from "@takeoff/engine";

export function LevelsScreen() {
  const { doc, setPath, replaceDoc } = useProject();
  if (!doc) return null;
  const state = doc;
  const levels = asList(state.levels);
  let running = 0;

  function addLevel() {
    const next = structuredClone(state);
    const list = asList(next.levels);
    const top = list.at(-1);
    const created: DocMap = {
      id: uid("lv"),
      name: `Level ${list.length}`,
      h: top?.h ?? 3.3,
      zone: top?.zone ?? 0.2,
    };
    list.push(created);
    next.levels = list;
    if (top) {
      const pl = asRecord(next.pl);
      for (const kind of Object.keys(pl)) {
        if (!LEVELLED.has(kind)) continue;
        const rows = asList(pl[kind]);
        const copies = rows.filter((row) => row.level === top.id).map((row) => ({ ...row, id: uid("p"), level: created.id }));
        pl[kind] = [...rows, ...copies];
      }
    }
    replaceDoc(next);
  }

  function deleteLevel(index: number) {
    const level = levels[index];
    if (!level || levels.length < 2) return;
    if (!confirm(`Delete ${level.name} and all its rows?`)) return;
    const next = structuredClone(state);
    const id = stringOf(level.id);
    next.levels = asList(next.levels).filter((_, i) => i !== index);
    const pl = asRecord(next.pl);
    for (const kind of Object.keys(pl)) {
      pl[kind] = asList(pl[kind]).filter((row) => row.level !== id);
    }
    replaceDoc(next);
  }

  return (
    <>
      <div className="pagehead">
        <h1>Levels</h1>
        <p>Floor-to-floor heights. The slab zone is deducted from column and beam depths so the slab is not measured twice.</p>
      </div>
      <fieldset>
        <legend>Levels, bottom to top</legend>
        <div className="tablewrap">
          <table className="pl">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Floor to floor (m)</th>
                <th>Slab zone (m)</th>
                <th className="n">Top at</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {levels.map((level, index) => {
                running += n((level.h ?? 0) as number | string);
                const top = running;
                return (
                  <tr key={stringOf(level.id, String(index))}>
                    <td className="calc" style={{ textAlign: "left" }}>{index + 1}</td>
                    <td>
                      <TextField value={stringOf(level.name)} onChange={(value) => setPath(`levels.${index}.name`, value)} />
                    </td>
                    <td>
                      <NumberField value={stringOf(level.h)} onChange={(value) => setPath(`levels.${index}.h`, value)} step={0.1} />
                    </td>
                    <td>
                      <NumberField value={stringOf(level.zone)} onChange={(value) => setPath(`levels.${index}.zone`, value)} step={0.05} />
                    </td>
                    <td className="calc">+{formatNumber(top, 2)}</td>
                    <td>
                      <button className="x" type="button" aria-label="Delete level" disabled={levels.length < 2} onClick={() => deleteLevel(index)}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="rowtools">
          <button className="btn sm" type="button" onClick={addLevel}>Add level on top</button>
          <span className="lbl">New levels copy the rows of the level below.</span>
        </div>
      </fieldset>
    </>
  );
}
