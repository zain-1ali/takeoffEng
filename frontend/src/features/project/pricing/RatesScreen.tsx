import { useMemo, useState } from "react";
import { analyse, n, stdRecipe, type ResourceCategory } from "@takeoff/engine";
import { NumberField } from "../../../ui/index.js";
import { hasPaidFeature } from "../../../lib/catalog.js";
import { asRecord, stringOf } from "../../../lib/doc.js";
import { formatNumber } from "../../../lib/format.js";
import { CommentButton } from "../../collab/CommentButton.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { pricingFrom } from "../../editor/runProject.js";
import { useEditorComputed, usePricedProject } from "../computed.js";
import { useProject } from "../ProjectProvider.js";
import { PlanGate } from "../reports/chrome.js";
import { currencyOf, localeOf, money } from "../reports/reportData.js";
import { CostBar } from "./CostBar.js";
import { useDatabank } from "./DatabankProvider.js";
import { FxBanner } from "./FxBanner.js";
import { CAT_COLOR, RATE_CATEGORIES, cloneLines, raOf, type RaLine } from "./helpers.js";

export function RatesScreen() {
  const auth = useAuth();
  const allowed = hasPaidFeature(auth.entitlements?.rateAnalysis);
  const { doc, meta, setPath, replaceDoc } = useProject();
  const { boq, split, status } = useEditorComputed();
  const project = usePricedProject();
  const databank = useDatabank();
  const [addCode, setAddCode] = useState("");
  if (!allowed) {
    return (
      <PlanGate allowed={false} title="Rate analysis">
        Rate analysis is on the Professional plan.
      </PlanGate>
    );
  }

  const pricing = useMemo(() => (project ? pricingFrom(project) : null), [project]);
  const currency = currencyOf(doc, meta);
  const locale = localeOf(doc);
  const ra = raOf(doc);
  const rates = asRecord(doc?.rates);
  const ui = asRecord(doc?.ui);
  const query = stringOf(ui.raQ).toLowerCase();
  const items = boq?.items ?? [];
  const selected = stringOf(ui.raSel, items[0]?.code ?? "");
  const item = items.find((row) => row.code === selected) ?? items[0];
  const analysis = item && pricing ? analyse(item.code, pricing) : null;
  const priced = items.filter((row) => row.rate > 0).length;
  const billValue = items.reduce((sum, row) => sum + row.amount, 0);
  const taxName = stringOf(asRecord(doc?.report).taxName, meta?.taxName ?? "tax");

  const splitCats = {
    Labour: split.find((row) => row.label === "Labour")?.value ?? 0,
    Material: split.find((row) => row.label === "Material")?.value ?? 0,
    Plant: split.find((row) => row.label === "Plant")?.value ?? 0,
    Subcontract: split.find((row) => row.label === "Subcontract")?.value ?? 0,
  };

  function patchCustom(code: string, mutate: (lines: RaLine[]) => RaLine[]) {
    if (!doc || !pricing) return;
    const existing = ra.custom[code]?.lines;
    const lines = cloneLines(existing ?? stdRecipe(code, pricing).lines);
    const next = structuredClone(doc);
    const nextRa = asRecord(next.ra);
    next.ra = nextRa;
    const custom = asRecord(nextRa.custom);
    nextRa.custom = custom;
    custom[code] = { lines: mutate(lines) };
    replaceDoc(next);
  }

  const grouped = boq?.rows ?? [];

  return (
    <div>
      <div className="pagehead">
        <h1>Rate analysis</h1>
        <p>
          Every item in the bill is built up from the resource databank: labour, materials and plant per unit, plus small tools, overheads and profit. Edit any build-up; the bill, grand summary and reports update straight away.
        </p>
      </div>
      <div className="rakpis">
        <div className="kpi">
          <small>Items priced</small>
          <b>{priced} / {items.length}</b>
          <div className="meter"><span style={{ width: `${items.length ? (priced / items.length) * 100 : 0}%` }} /></div>
        </div>
        <div className="kpi">
          <small>Bill value before contingency and {taxName}</small>
          <b>{money(billValue, 0, locale)}</b>
          <span>{currency}</span>
        </div>
        <div className="kpi wide">
          <small>Direct cost split (analysed items)</small>
          <CostBar categories={splitCats} />
        </div>
        <div className="kpi raset">
          <small>Applied to every build-up</small>
          <div className="rasets">
            <label className="mini">
              Small tools
              <NumberField compact unit="% lab" step={0.5} value={stringOf(ra.tools, "3")} onChange={(value) => setPath("ra.tools", value)} />
            </label>
            <label className="mini">
              Overheads
              <NumberField compact unit="%" step={0.5} value={stringOf(ra.oh, "10")} onChange={(value) => setPath("ra.oh", value)} />
            </label>
            <label className="mini">
              Profit
              <NumberField compact unit="%" step={0.5} value={stringOf(ra.profit, "10")} onChange={(value) => setPath("ra.profit", value)} />
            </label>
          </div>
        </div>
      </div>
      <FxBanner projectCurrency={currency} />
      {status === "error" ? <div className="alert">Could not price this project.</div> : null}
      <div className="ra2">
        <aside className="ralist">
          <div className="rasearch">
            <div className="box">
              <input
                className="t"
                value={stringOf(ui.raQ)}
                placeholder="Search items"
                aria-label="Search items"
                onChange={(event) => setPath("ui.raQ", event.target.value)}
              />
            </div>
          </div>
          <div id="raList">
            {grouped.map((row, index) => {
              if (!("code" in row)) {
                return <div className="rlsec" key={`sec-${index}`}>{row.sec}</div>;
              }
              if (query && !`${row.item} ${row.desc} ${row.code}`.toLowerCase().includes(query)) return null;
              const source = rates[row.code] != null && rates[row.code] !== "" ? "manual" : ra.custom[row.code] ? "custom" : "std";
              return (
                <button
                  key={row.code}
                  className="rli"
                  type="button"
                  aria-current={row.code === (item?.code ?? selected)}
                  onClick={() => setPath("ui.raSel", row.code)}
                >
                  <span className="li">{row.item}</span>
                  <span className="ld">
                    {row.desc}
                    <small>{formatNumber(row.quantity, row.unit === "t" ? 3 : 2, locale)} {row.unit}</small>
                  </span>
                  <span className="lr">
                    <b>{row.rate > 0 ? money(row.rate, 2, locale) : "–"}</b>
                    <em className={`badge ${source}`}>
                      {source === "manual" ? "Manual" : source === "custom" ? "Edited" : "Standard"}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="radetail">
          {!item || !analysis || !pricing ? (
            <div className="empty">Choose an item on the left.</div>
          ) : (
            <>
              <div className="rdhead">
                <div>
                  <div className="kicker">Item {item.item} · {analysis.family} · {item.code}</div>
                  <h2>
                    {item.desc}{" "}
                    <CommentButton code={item.code} item={item.item} desc={item.desc} />
                  </h2>
                  <div className="rdq">
                    {formatNumber(item.quantity, item.unit === "t" ? 3 : 2, locale)} {item.unit} × {money(item.rate, 2, locale)} = <b>{money(item.amount, 2, locale)} {currency}</b>
                  </div>
                </div>
                <div className="rdrate">
                  <small>Analysed rate per {item.unit}</small>
                  <b>{money(analysis.rate, 2, locale)}</b>
                  <small>{currency}</small>
                </div>
              </div>
              {rates[item.code] != null && rates[item.code] !== "" ? (
                <div className="alert warnish">
                  A manual rate of <b>{money(n(String(rates[item.code])), 2, locale)}</b> is typed into the bill and overrides this analysis.{" "}
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => {
                      const next = structuredClone(doc ?? {});
                      const nextRates = asRecord(next.rates);
                      delete nextRates[item.code];
                      next.rates = nextRates;
                      replaceDoc(next);
                    }}
                  >
                    Use analysed rate
                  </button>
                </div>
              ) : null}
              {analysis.missing.length ? (
                <div className="alert">Resources not in the databank: {analysis.missing.join(", ")}. Pick a replacement below.</div>
              ) : null}
              {analysis.note ? <p className="rdnote">{analysis.note}</p> : null}
              <div className="scroll">
                <table className="dt ratable">
                  <thead>
                    <tr>
                      <th>Resource</th>
                      <th>Unit</th>
                      <th className="n">Qty per {item.unit}</th>
                      <th className="n">Rate</th>
                      <th className="n">Cost</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {RATE_CATEGORIES.map((cat) => {
                      const rows = analysis.rows.filter((row) => (row.resource?.category ?? "Material") === cat);
                      if (!rows.length) return null;
                      return (
                        <CategoryRows
                          key={cat}
                          category={cat}
                          rows={rows}
                          locale={locale}
                          resources={databank.resources}
                          rawQty={(index) => String(ra.custom[item.code]?.lines?.[index]?.quantity ?? analysis.rows[index]?.quantity ?? "")}
                          onResource={(index, code) => patchCustom(item.code, (lines) => lines.map((line, i) => (
                            i === index ? { ...line, resourceCode: code, note: "" } : line
                          )))}
                          onQty={(index, qty) => patchCustom(item.code, (lines) => lines.map((line, i) => (
                            i === index ? { ...line, quantity: qty } : line
                          )))}
                          onRemove={(index) => patchCustom(item.code, (lines) => lines.filter((_, i) => i !== index))}
                        />
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="tl">Small tools ({formatNumber(n(ra.tools), 1, locale)}% of labour)</td>
                      <td className="n">{money(analysis.tools, 2, locale)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="tl"><b>Direct cost</b></td>
                      <td className="n"><b>{money(analysis.direct, 2, locale)}</b></td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="tl">Overheads ({formatNumber(n(ra.oh), 1, locale)}%)</td>
                      <td className="n">{money(analysis.overheads, 2, locale)}</td>
                      <td></td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="tl">Profit ({formatNumber(n(ra.profit), 1, locale)}%)</td>
                      <td className="n">{money(analysis.profit, 2, locale)}</td>
                      <td></td>
                    </tr>
                    <tr className="grand">
                      <td colSpan={4} className="tl">Rate per {item.unit}</td>
                      <td className="n">{money(analysis.rate, 2, locale)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="rdtools">
                <div className="box addres">
                  <select aria-label="Resource to add" value={addCode || databank.resources[0]?.code || ""} onChange={(event) => setAddCode(event.target.value)}>
                    <ResourceOptions resources={databank.resources} />
                  </select>
                </div>
                <button
                  className="btn sm primary"
                  type="button"
                  onClick={() => {
                    const code = addCode || databank.resources[0]?.code;
                    if (!code) return;
                    patchCustom(item.code, (lines) => [...lines, { resourceCode: code, quantity: 1, note: "" }]);
                  }}
                >
                  Add resource
                </button>
                <span className="sp" />
                {analysis.custom ? (
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => {
                      const next = structuredClone(doc ?? {});
                      const nextRa = asRecord(next.ra);
                      const custom = asRecord(nextRa.custom);
                      delete custom[item.code];
                      nextRa.custom = custom;
                      next.ra = nextRa;
                      replaceDoc(next);
                    }}
                  >
                    Reset to standard build-up
                  </button>
                ) : (
                  <span className="muted">Standard build-up – edits are saved for this item</span>
                )}
              </div>
              <div style={{ marginTop: 14 }}>
                <CostBar categories={analysis.categories} tools={analysis.tools} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function ResourceOptions({ resources }: { resources: { code: string; category: string; name: string; unit: string }[] }) {
  return (
    <>
      {RATE_CATEGORIES.map((cat) => {
        const grouped = resources.filter((row) => {
          const value = row.category.toUpperCase();
          if (cat === "Labour") return value === "LABOUR" || row.category === "Labour";
          return value === cat.toUpperCase() || row.category === cat;
        });
        if (!grouped.length) return null;
        return (
          <optgroup key={cat} label={cat}>
            {grouped.map((row) => (
              <option key={row.code} value={row.code}>{row.code} – {row.name} ({row.unit})</option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

function CategoryRows({
  category,
  rows,
  locale,
  resources,
  rawQty,
  onResource,
  onQty,
  onRemove,
}: {
  category: ResourceCategory;
  rows: ReturnType<typeof analyse>["rows"];
  locale: string;
  resources: { code: string; category: string; name: string; unit: string }[];
  rawQty: (index: number) => string;
  onResource: (index: number, code: string) => void;
  onQty: (index: number, qty: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <>
      <tr className="catrow">
        <td colSpan={6}><i style={{ background: CAT_COLOR[category] }} />{category}</td>
      </tr>
      {rows.map((row) => (
        <tr key={row.index}>
          <td>
            <div className="box">
              <select aria-label="Resource" value={row.resourceCode} onChange={(event) => onResource(row.index, event.target.value)}>
                <ResourceOptions resources={resources} />
              </select>
            </div>
            {row.note ? <small className="lnote">{row.note}</small> : null}
          </td>
          <td>{row.resource?.unit ?? "?"}</td>
          <td className="n">
            <div className="qbox">
              <NumberField compact value={rawQty(row.index)} onChange={(value) => onQty(row.index, value)} />
            </div>
          </td>
          <td className="n">{row.resource ? money(row.resource.rate, 2, locale) : "–"}</td>
          <td className="n"><b>{money(row.cost, 2, locale)}</b></td>
          <td>
            <button className="x" type="button" aria-label="Remove line" onClick={() => onRemove(row.index)}>×</button>
          </td>
        </tr>
      ))}
      <tr className="sub">
        <td colSpan={4} style={{ textAlign: "right" }}>{category} subtotal</td>
        <td className="n">{money(rows.reduce((sum, row) => sum + row.cost, 0), 2, locale)}</td>
        <td></td>
      </tr>
    </>
  );
}
