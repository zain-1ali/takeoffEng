import { useState } from "react";
import { DEFAULT_MATERIAL_FACTORS } from "@takeoff/engine";
import { NumberField, Switch } from "../../../ui/index.js";
import { hasPaidFeature } from "../../../lib/catalog.js";
import { asRecord, stringOf } from "../../../lib/doc.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { useProject } from "../ProjectProvider.js";
import { useEditorComputed } from "../computed.js";
import { DEFAULT_MIXES } from "../schema.js";
import { Donut, HBars } from "./charts.js";
import { ComputingNote, CoverPage, PlanGate, ReportHead, ReportToolbar, SignBlock, printReport } from "./chrome.js";
import {
  coverFields,
  currencyOf,
  groupBom,
  isBomItem,
  localeOf,
  money,
  moneyOrDash,
} from "./reportData.js";

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

export function BomScreen() {
  const auth = useAuth();
  const allowed = hasPaidFeature(auth.entitlements?.bom);
  const { doc, meta, setPath } = useProject();
  const { bom, params, status, error } = useEditorComputed();
  const [factorsOpen, setFactorsOpen] = useState(false);
  if (!allowed) {
    return (
      <PlanGate allowed={false} title="Bill of materials">
        The bill of materials is on the Professional plan.
      </PlanGate>
    );
  }
  const currency = currencyOf(doc, meta);
  const locale = localeOf(doc);
  const cover = coverFields(doc, meta);
  const mat = { ...DEFAULT_MATERIAL_FACTORS, ...asRecord(doc?.mat) } as Record<string, unknown>;
  const mix = { ...DEFAULT_MIXES, ...asRecord(doc?.mix) } as Record<string, { cem: number; sand: number; agg: number }>;
  const mrates = asRecord(doc?.mrates);
  const sections = groupBom(bom ?? []);
  const items = (bom ?? []).filter(isBomItem);
  const total = items.reduce((sum, row) => sum + row.amount, 0);
  const ranked = items.slice().sort((a, b) => b.amount - a.amount);

  return (
    <div className="report">
      <ReportToolbar title="Bill of materials">
        <Switch
          label="Ready-mix concrete"
          checked={Boolean(mat.readymix)}
          onChange={(checked) => setPath("mat.readymix", checked)}
        />
        <button className="btn sm" type="button" onClick={() => setFactorsOpen((open) => !open)}>
          {factorsOpen ? "Hide" : "Edit"} material factors
        </button>
        <button className="btn sm" type="button" onClick={printReport}>Print or save PDF</button>
      </ReportToolbar>
      {factorsOpen ? (
        <fieldset className="no-print">
          <legend>Material factors <span className="hint">Edit to match your mix designs and site practice</span></legend>
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
                {Object.keys(mix).sort((a, b) => Number(a) - Number(b)).map((grade) => (
                  <tr key={grade}>
                    <td><b>C{grade}</b> and above</td>
                    {(["cem", "sand", "agg"] as const).map((key) => (
                      <td key={key} style={{ padding: "4px 8px" }}>
                        <NumberField
                          compact
                          value={stringOf(mix[grade]?.[key])}
                          onChange={(value) => setPath(`mix.${grade}.${key}`, value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid">
            {FACTOR_FIELDS.map(([key, label, unit]) => (
              <NumberField
                key={key}
                label={label}
                unit={unit}
                value={stringOf(mat[key])}
                onChange={(value) => setPath(`mat.${key}`, value)}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
      <ComputingNote status={status} error={error} />
      <CoverPage title="Bill of materials" doc={doc} meta={meta} params={params} />
      <section className="page sumpage">
        <div className="shead">
          <div>
            <div className="kicker">{cover.name}</div>
            <h1>Materials summary</h1>
          </div>
          <div className="stamp">
            <small>Total</small>
            <b>{moneyOrDash(total, 0, locale)}</b>
            <small>{currency}</small>
          </div>
        </div>
        <table className="rt gst">
          <thead>
            <tr>
              <th>No.</th>
              <th>Material group</th>
              <th className="n">Lines</th>
              <th className="n">Amount ({currency})</th>
              <th className="n">Share</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, index) => {
              const amount = section.rows.reduce((sum, row) => sum + row.amount, 0);
              return (
                <tr key={section.title}>
                  <td className="item">{index + 1}</td>
                  <td>{section.title}</td>
                  <td className="n">{section.rows.length}</td>
                  <td className="n">{money(amount, 2, locale)}</td>
                  <td className="n">{total ? `${money((amount / total) * 100, 1, locale)}%` : "–"}</td>
                </tr>
              );
            })}
            <tr className="grand">
              <td /><td>Total materials</td><td /><td className="n">{money(total, 2, locale)}</td><td />
            </tr>
          </tbody>
        </table>
        <div className="sgrid">
          <div className="scard">
            <h3>Cost by material group</h3>
            <Donut
              data={sections.map((section) => ({
                label: section.title,
                value: section.rows.reduce((sum, row) => sum + row.amount, 0),
                show: money(section.rows.reduce((sum, row) => sum + row.amount, 0), 0, locale),
              }))}
              center={money(total, 0, locale)}
              sub={currency}
            />
          </div>
          <div className="scard">
            <h3>Ten largest materials</h3>
            <HBars data={ranked.slice(0, 10).map((row) => ({ label: row.material, value: row.amount }))} digits={0} color="var(--steel)" />
          </div>
        </div>
      </section>
      <div className="page">
        <ReportHead title="Bill of materials" stamp={total} currency={currency} basis="Order qty = net × (1 + waste)" doc={doc} meta={meta} />
        <div className="notes">
          Materials are derived from the measured work using the material factors. {Boolean(mat.readymix) ? "Concrete is listed as ready-mix." : "Concrete is broken down into cement, sand and aggregate for site batching."} Check mix designs, laps and formwork reuse against the specification before ordering.
        </div>
        {!sections.length ? <div className="empty" style={{ marginTop: 20 }}>No materials yet.</div> : null}
        {sections.map((section, index) => (
          <section className="bill" key={section.title}>
            <h2>
              <span>{index + 1}. {section.title}</span>
              <small>{section.rows.length} line{section.rows.length === 1 ? "" : "s"}</small>
            </h2>
            <table className="rt">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Specification and basis</th>
                  <th>Unit</th>
                  <th className="n">Net</th>
                  <th className="n">Waste</th>
                  <th className="n">Order qty</th>
                  <th className="n">Unit price</th>
                  <th className="n">Amount</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row) => {
                  const manual = stringOf(mrates[row.code]);
                  return (
                    <tr key={row.code}>
                      <td><b>{row.material}</b></td>
                      <td style={{ color: "var(--muted)" }}>{row.specification}</td>
                      <td>{row.unit}</td>
                      <td className="n">{money(row.net, row.displayDecimals, locale)}</td>
                      <td className="n">{money(row.waste, 0, locale)}%</td>
                      <td className="n"><b>{money(row.order, row.orderDecimals, locale)}</b></td>
                      <td className="rate">
                        <input
                          inputMode="decimal"
                          className={manual ? "manual" : undefined}
                          value={manual}
                          placeholder={row.rate ? money(row.rate, 2, locale) : ""}
                          title={manual ? "Manual price" : "From resource databank – type to override"}
                          aria-label={`Unit price ${row.material}`}
                          onChange={(event) => setPath(`mrates.${row.code}`, event.target.value)}
                        />
                      </td>
                      <td className="n">{row.amount ? money(row.amount, 2, locale) : "–"}</td>
                    </tr>
                  );
                })}
                <tr className="btot">
                  <td colSpan={7}>Total – {section.title}</td>
                  <td className="n">{money(section.rows.reduce((sum, row) => sum + row.amount, 0), 2, locale)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}
        {sections.length ? (
          <section className="bill">
            <table className="rt">
              <tbody>
                <tr className="grand">
                  <td>Total materials ({currency})</td>
                  <td className="n">{money(total, 2, locale)}</td>
                </tr>
              </tbody>
            </table>
            <SignBlock third="Procurement" preparedBy={cover.by} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
