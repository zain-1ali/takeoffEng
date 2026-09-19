import { useMemo, useRef, useState } from "react";
import { analyse, n, type ResourceCategory } from "@takeoff/engine";
import { NumberField, TextField } from "../../../ui/index.js";
import { hasPaidFeature } from "../../../lib/catalog.js";
import { asRecord, stringOf } from "../../../lib/doc.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { pricingFrom } from "../../editor/runProject.js";
import { useEditorComputed, usePricedProject } from "../computed.js";
import { useProject } from "../ProjectProvider.js";
import { PlanGate } from "../reports/chrome.js";
import { currencyOf, isBoqItem } from "../reports/reportData.js";
import { CAT_COLOR, MONGO_CAT, RATE_CATEGORIES, downloadCsv, nextResourceCode, parseCsv, raOf } from "./helpers.js";
import { useDatabank } from "./DatabankProvider.js";
import { convertConfirm, FxBanner } from "./FxBanner.js";

export function ResourcesScreen() {
  const auth = useAuth();
  const allowed = hasPaidFeature(auth.entitlements?.rateAnalysis);
  const { doc, meta, setPath } = useProject();
  const { boq } = useEditorComputed();
  const project = usePricedProject();
  const databank = useDatabank();
  const fileRef = useRef<HTMLInputElement>(null);
  const [adjPct, setAdjPct] = useState("");
  const [adjCat, setAdjCat] = useState("All");
  const [message, setMessage] = useState<string | null>(null);
  if (!allowed) {
    return (
      <PlanGate allowed={false} title="Resource databank">
        The resource databank is on the Professional plan.
      </PlanGate>
    );
  }

  const pricing = useMemo(() => (project ? pricingFrom(project) : null), [project]);
  const currency = currencyOf(doc, meta);
  const ra = raOf(doc);
  const ui = asRecord(doc?.ui);
  const query = stringOf(ui.resQ).toLowerCase();
  const catFilter = stringOf(ui.resCat, "All");
  const market = stringOf(ra.market, databank.priceBasis);
  const used = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!pricing) return counts;
    for (const row of boq?.items ?? []) {
      if (!isBoqItem(row)) continue;
      for (const line of analyse(row.code, pricing).rows) {
        counts[line.resourceCode] = (counts[line.resourceCode] ?? 0) + 1;
      }
    }
    return counts;
  }, [boq?.items, pricing]);

  async function onAdd() {
    const category = (catFilter !== "All" ? catFilter : "Material") as ResourceCategory;
    const code = nextResourceCode(databank.resources.map((row) => row.code), category);
    const created = await databank.create({
      code,
      category: MONGO_CAT[category],
      name: "New resource",
      unit: category === "Labour" || category === "Plant" ? "h" : "No.",
      rate: "0",
    });
    if (created) {
      setPath("ui.resQ", "");
      setMessage("Resource added – set its name and rate");
    }
  }

  async function onAdjust() {
    const percent = n(adjPct);
    if (!percent) {
      setMessage("Enter a percentage first");
      return;
    }
    const count = await databank.adjust(percent, adjCat);
    setMessage(`${count} prices adjusted by ${percent}%`);
  }

  async function onConvert() {
    const fx = n(ra.fx) || 1;
    if (!(fx > 0)) {
      setMessage("Enter an exchange rate first");
      return;
    }
    if (!convertConfirm(databank.resources.length, fx, currency)) return;
    await databank.convert(currency, fx);
    setPath("ra.cur", currency);
    setPath("ra.fx", 1);
    setMessage(`Databank converted to ${currency}`);
  }

  return (
    <div>
      <div className="pagehead">
        <h1>Resource databank</h1>
        <p>Labour, material, plant and subcontract prices used by every rate build-up. Change a price once and all rates, the bill and the bill of materials reprice.</p>
      </div>
      {databank.error ? <div className="alert">{databank.error}</div> : null}
      {message ? <div className="alert ok">{message}</div> : null}
      <div className="rtool">
        <div className="box" style={{ minWidth: 220, flex: 1, maxWidth: 320 }}>
          <input
            className="t"
            value={stringOf(ui.resQ)}
            placeholder="Search code or name"
            aria-label="Search resources"
            onChange={(event) => setPath("ui.resQ", event.target.value)}
          />
        </div>
        <div className="chips" role="group" aria-label="Category">
          {["All", ...RATE_CATEGORIES].map((cat) => (
            <button
              key={cat}
              className="chip"
              type="button"
              aria-pressed={catFilter === cat}
              onClick={() => setPath("ui.resCat", cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="sp" />
        <button className="btn sm" type="button" onClick={() => void onAdd()}>Add resource</button>
        <button
          className="btn sm"
          type="button"
          onClick={() => downloadCsv("resource_databank.csv", [
            ["code", "category", "name", "unit", "rate", "notes"],
            ...databank.resources.map((row) => [row.code, row.category, row.name, row.unit, row.rate, row.note ?? ""]),
          ])}
        >
          Export CSV
        </button>
        <button className="btn sm" type="button" onClick={() => fileRef.current?.click()}>Import CSV</button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              void (async () => {
                try {
                  const csv = String(reader.result ?? "");
                  parseCsv(csv);
                  const result = await databank.importCsv(csv);
                  setMessage(`Imported: ${result.added} added, ${result.updated} updated`);
                } catch {
                  setMessage("Could not read that CSV – use columns code, category, name, unit, rate, notes");
                }
              })();
            };
            reader.readAsText(file);
          }}
        />
      </div>
      <fieldset>
        <legend>Market and price adjustment <span className="hint">Use for location factors or inflation</span></legend>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
          <TextField label="Price basis" value={market} onChange={(value) => setPath("ra.market", value)} />
          <div className="f">
            <label htmlFor="adjCat">Category</label>
            <div className="box">
              <select id="adjCat" value={adjCat} onChange={(event) => setAdjCat(event.target.value)}>
                <option>All</option>
                {RATE_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
          <div className="f">
            <label htmlFor="adjPct">Adjust by</label>
            <div className="box">
              <input id="adjPct" inputMode="decimal" placeholder="e.g. 5 or -3" value={adjPct} onChange={(event) => setAdjPct(event.target.value)} />
              <span className="u">%</span>
            </div>
          </div>
          <div className="f" style={{ justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={() => void onAdjust()}>Apply adjustment</button>
          </div>
        </div>
      </fieldset>
      <FxBanner
        projectCurrency={currency}
        extra={
          databank.currency.toUpperCase() !== currency.toUpperCase() ? (
            <button className="btn sm" type="button" onClick={() => void onConvert()}>
              Convert databank to {currency}
            </button>
          ) : null
        }
      />
      <div className="scroll">
        <table className="dt restab">
          <thead>
            <tr>
              <th>Code</th>
              <th>Resource</th>
              <th>Category</th>
              <th>Unit</th>
              <th className="n">Rate ({(databank.currency || ra.cur || "USD").toUpperCase()})</th>
              <th>Notes</th>
              <th className="n">Used in</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {RATE_CATEGORIES.map((cat) => {
              if (catFilter !== "All" && catFilter !== cat) return null;
              const rows = databank.resources.filter((row) => {
                const value = row.category.toUpperCase();
                const matchCat = cat === "Labour" ? value === "LABOUR" || row.category === "Labour" : value === cat.toUpperCase() || row.category === cat;
                const matchQ = !query || `${row.code} ${row.name}`.toLowerCase().includes(query);
                return matchCat && matchQ;
              });
              if (!rows.length) return null;
              return (
                <CategoryTable
                  key={cat}
                  category={cat}
                  rows={rows}
                  used={used}
                  onPatch={databank.patch}
                  onDelete={(id, code, count) => {
                    const ok = window.confirm(count
                      ? `${code} is used in ${count} rate build-up(s). Those items will lose this cost. Delete?`
                      : `Delete ${code}?`);
                    if (!ok) return;
                    void databank.remove(id);
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryTable({
  category,
  rows,
  used,
  onPatch,
  onDelete,
}: {
  category: ResourceCategory;
  rows: { id: string; code: string; category: string; name: string; unit: string; rate: string; note: string }[];
  used: Record<string, number>;
  onPatch: (id: string, patch: Partial<{ code: string; category: string; name: string; unit: string; rate: string; note: string }>) => void;
  onDelete: (id: string, code: string, count: number) => void;
}) {
  return (
    <>
      <tr className="catrow">
        <td colSpan={8}><i style={{ background: CAT_COLOR[category] }} />{category} <span className="muted">{rows.length}</span></td>
      </tr>
      {rows.map((row) => (
        <tr key={row.id}>
          <td>
            <div className="box code">
              <input className="t" aria-label="Code" value={row.code} onChange={(event) => onPatch(row.id, { code: event.target.value })} />
            </div>
          </td>
          <td>
            <div className="box">
              <input className="t" aria-label="Name" value={row.name} onChange={(event) => onPatch(row.id, { name: event.target.value })} />
            </div>
          </td>
          <td>
            <div className="box">
              <select aria-label="Category" value={row.category} onChange={(event) => onPatch(row.id, { category: event.target.value })}>
                {RATE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat === "Labour" ? "LABOUR" : cat.toUpperCase()}>{cat}</option>
                ))}
              </select>
            </div>
          </td>
          <td>
            <div className="box unit">
              <input className="t" aria-label="Unit" value={row.unit} onChange={(event) => onPatch(row.id, { unit: event.target.value })} />
            </div>
          </td>
          <td>
            <div className="box rate">
              <NumberField compact value={row.rate} onChange={(value) => onPatch(row.id, { rate: value })} />
            </div>
          </td>
          <td>
            <div className="box">
              <input className="t" aria-label="Notes" value={row.note ?? ""} onChange={(event) => onPatch(row.id, { note: event.target.value })} />
            </div>
          </td>
          <td className="n">
            {used[row.code] ? `${used[row.code]} item${used[row.code] === 1 ? "" : "s"}` : <span className="muted">–</span>}
          </td>
          <td>
            <button className="x" type="button" aria-label={`Delete ${row.code}`} onClick={() => onDelete(row.id, row.code, used[row.code] ?? 0)}>×</button>
          </td>
        </tr>
      ))}
    </>
  );
}
