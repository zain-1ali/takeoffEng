import { useMemo } from "react";
import { analyse } from "@takeoff/engine";
import { useProject } from "../ProjectProvider.js";
import { usePricedProject } from "../computed.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { useEditorComputed } from "../computed.js";
import { pricingFrom } from "../../editor/runProject.js";
import { ComputingNote, CoverPage, PlanGate, ReportHead, ReportToolbar, SignBlock, printReport } from "./chrome.js";
import {
  coverFields,
  currencyOf,
  groupBoq,
  localeOf,
  money,
  moneyOrDash,
} from "./reportData.js";
import { raOf } from "../pricing/helpers.js";
import { useOptionalDatabank } from "../pricing/DatabankProvider.js";

export function RaReportScreen() {
  const auth = useAuth();
  const allowed = Boolean(auth.entitlements?.rateAnalysis);
  const { doc, meta } = useProject();
  const { boq, params, status, error } = useEditorComputed();
  const project = usePricedProject();
  const databank = useOptionalDatabank();
  const pricing = useMemo(() => (project ? pricingFrom(project) : null), [project]);
  if (!allowed) {
    return (
      <PlanGate allowed={false} title="Rate analysis report">
        Rate analysis reports are on the Professional plan.
      </PlanGate>
    );
  }
  const currency = currencyOf(doc, meta);
  const locale = localeOf(doc);
  const cover = coverFields(doc, meta);
  const bills = groupBoq(boq?.rows ?? []);
  const total = boq?.subtotal ?? 0;
  const ra = raOf(doc);
  const market = ra.market || databank?.priceBasis || "Indicative starter prices – replace with your local rates";
  const tools = ra.tools ?? 3;
  const oh = ra.oh ?? 10;
  const profit = ra.profit ?? 10;

  return (
    <div className="report">
      <ReportToolbar title="Rate analysis report">
        <span className="muted">{market}</span>
        <button className="btn sm" type="button" onClick={printReport}>Print or save PDF</button>
      </ReportToolbar>
      <ComputingNote status={status} error={error} />
      <CoverPage title="Rate analysis" doc={doc} meta={meta} params={params} />
      <div className="page">
        <ReportHead title="Rate analysis" stamp={total} currency={currency} basis="Resource databank build-ups" doc={doc} meta={meta} />
        <div className="notes">
          Rates are built up from {databank?.resources.length ?? 0} resources ({market}). Small tools {String(tools)}% of labour, overheads {String(oh)}% and profit {String(profit)}% are applied to each item. Items marked manual use the rate typed into the bill.
        </div>
        {bills.map((bill, index) => (
          <div key={bill.title}>
            <h2 className="rasec">Bill No. {index + 1} – {bill.title}</h2>
            {bill.rows.map((row) => {
              const analysis = pricing ? analyse(row.code, pricing) : null;
              const manual = row.manualRate != null;
              return (
                <section className="rablock" key={row.code}>
                  <div className="rabh">
                    <span className="li">{row.item}</span>
                    <span className="ld">
                      {row.desc}
                      <small>
                        {analysis?.family ?? ""} · {money(row.quantity, row.unit === "t" ? 3 : 2, locale)} {row.unit}
                        {manual ? " · manual rate in bill" : ""}
                      </small>
                    </span>
                    <span className="lr">
                      {money(row.rate, 2, locale)}{" "}
                      <small>/{row.unit}{manual ? " manual" : ""}</small>
                    </span>
                  </div>
                  {analysis ? (
                    <table className="rt">
                      <thead>
                        <tr>
                          <th>Resource</th>
                          <th>Unit</th>
                          <th className="n">Qty</th>
                          <th className="n">Rate</th>
                          <th className="n">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.rows.map((line) => (
                          <tr key={`${line.resourceCode}-${line.index}`}>
                            <td>{line.resourceCode} – {line.resource?.name ?? "missing"}</td>
                            <td>{line.resource?.unit ?? ""}</td>
                            <td className="n">{money(line.quantity, line.quantity < 1 ? 4 : 2, locale)}</td>
                            <td className="n">{line.resource ? money(line.resource.rate, 2, locale) : "–"}</td>
                            <td className="n">{money(line.cost, 2, locale)}</td>
                          </tr>
                        ))}
                        <tr className="btot">
                          <td colSpan={4}>
                            Direct {money(analysis.direct, 2, locale)} · tools {money(analysis.tools, 2, locale)} · OH {money(analysis.overheads, 2, locale)} · profit {money(analysis.profit, 2, locale)}
                          </td>
                          <td className="n">{money(analysis.rate, 2, locale)}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : null}
                </section>
              );
            })}
          </div>
        ))}
        <section className="bill">
          <table className="rt">
            <tbody>
              <tr className="grand">
                <td>Bill value from rates ({currency})</td>
                <td className="n">{moneyOrDash(total, 2, locale)}</td>
              </tr>
            </tbody>
          </table>
          <SignBlock third="Approved by" preparedBy={cover.by} />
        </section>
      </div>
    </div>
  );
}
