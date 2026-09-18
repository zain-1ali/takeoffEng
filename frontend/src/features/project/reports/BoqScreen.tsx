import { useNavigate, useParams } from "react-router-dom";
import { NumberField } from "../../../ui/index.js";
import { asRecord, stringOf } from "../../../lib/doc.js";
import { useProject } from "../ProjectProvider.js";
import { useEditorComputed } from "../computed.js";
import { Donut, Pareto, Waterfall } from "./charts.js";
import { ComputingNote, CoverPage, ReportHead, ReportToolbar, SignBlock, printReport } from "./chrome.js";
import {
  PAL,
  coverFields,
  currencyOf,
  groupBoq,
  localeOf,
  money,
  moneyOrDash,
  reportSettings,
  unitCost,
} from "./reportData.js";

export function BoqScreen() {
  const { doc, meta, setPath } = useProject();
  const { boq, result, totals, params, split, status, error } = useEditorComputed();
  const { id } = useParams();
  const navigate = useNavigate();
  const currency = currencyOf(doc, meta);
  const locale = localeOf(doc);
  const settings = reportSettings(doc, meta);
  const cover = coverFields(doc, meta);
  const rates = asRecord(doc?.rates);
  const bills = groupBoq(boq?.rows ?? []);
  const priced = boq?.items.filter((item) => item.rate > 0).length ?? 0;
  const uc = result && totals ? unitCost(doc ?? {}, result, totals.total) : null;
  const basis = `${cover.basis}, net quantities`;

  return (
    <div className="report">
      <ReportToolbar title="Bills of quantities">
        <label className="mini">
          Contingency
          <NumberField
            compact
            unit="%"
            step={0.5}
            value={stringOf(asRecord(doc?.report).cont, String(settings.contingency))}
            onChange={(value) => setPath("report.cont", value)}
          />
        </label>
        <label className="mini">
          {settings.taxName}
          <NumberField
            compact
            unit="%"
            step={0.5}
            value={stringOf(asRecord(doc?.report).vat, String(settings.tax))}
            onChange={(value) => setPath("report.vat", value)}
          />
        </label>
        <button className="btn sm" type="button" onClick={() => id && navigate(`/app/p/${id}/rates`)}>Rate analysis</button>
        <button className="btn sm" type="button" onClick={printReport}>Print or save PDF</button>
        <button className="btn sm" type="button" disabled title="Excel export ships in Phase 12">Download Excel</button>
      </ReportToolbar>
      <ComputingNote status={status} error={error} />
      <CoverPage title="Bills of quantities" doc={doc} meta={meta} params={params} />
      <section className="page sumpage">
        <div className="shead">
          <div>
            <div className="kicker">{cover.name}</div>
            <h1>Summary</h1>
          </div>
          <div className="stamp">
            <small>Total</small>
            <b>{moneyOrDash(totals?.total ?? 0, 0, locale)}</b>
            <small>{currency}</small>
          </div>
        </div>
        <div className="skpis">
          <div><small>Measured work</small><b>{money(totals?.subtotal ?? 0, 0, locale)}</b></div>
          <div><small>Bills</small><b>{boq?.bills.length ?? 0}</b></div>
          <div><small>Items priced</small><b>{priced} / {boq?.items.length ?? 0}</b></div>
          <div><small>{uc ? uc[1] : "Unit cost"}</small><b>{uc && totals?.total ? money(uc[0], 0, locale) : "–"}</b></div>
        </div>
        <table className="rt gst">
          <thead>
            <tr>
              <th>Bill</th>
              <th>Description</th>
              <th className="n">Items</th>
              <th className="n">Amount ({currency})</th>
              <th className="n">Share</th>
            </tr>
          </thead>
          <tbody>
            {(boq?.bills ?? []).map((bill, index) => (
              <tr key={bill.title}>
                <td className="item">{index + 1}</td>
                <td>{bill.title}</td>
                <td className="n">{bill.itemCount}</td>
                <td className="n">{money(bill.amount, 2, locale)}</td>
                <td className="n">{boq?.subtotal ? `${money((bill.amount / boq.subtotal) * 100, 1, locale)}%` : "–"}</td>
              </tr>
            ))}
            <tr className="btot">
              <td /><td>Subtotal – measured work</td><td /><td className="n">{money(totals?.subtotal ?? 0, 2, locale)}</td><td />
            </tr>
            <tr>
              <td /><td>Contingency ({money(settings.contingency, 1, locale)}%)</td><td /><td className="n">{money(totals?.contingency ?? 0, 2, locale)}</td><td />
            </tr>
            <tr>
              <td /><td>Subtotal including contingency</td><td /><td className="n">{money((totals?.subtotal ?? 0) + (totals?.contingency ?? 0), 2, locale)}</td><td />
            </tr>
            <tr>
              <td /><td>{settings.taxName} ({money(settings.tax, 1, locale)}%)</td><td /><td className="n">{money(totals?.tax ?? 0, 2, locale)}</td><td />
            </tr>
            <tr className="grand">
              <td /><td>Total carried to form of tender</td><td /><td className="n">{money(totals?.total ?? 0, 2, locale)}</td><td />
            </tr>
          </tbody>
        </table>
        <div className="sgrid">
          <div className="scard">
            <h3>Cost by bill</h3>
            <Donut
              data={(boq?.bills ?? []).map((bill, index) => ({
                label: bill.title,
                value: bill.amount,
                color: PAL[index % PAL.length],
                show: money(bill.amount, 0, locale),
              }))}
              center={money(boq?.subtotal ?? 0, 0, locale)}
              sub={currency}
            />
          </div>
          <div className="scard">
            <h3>Resource split</h3>
            <Donut data={split} center="Direct" sub="cost" />
          </div>
        </div>
        <div className="sgrid">
          <div className="scard">
            <h3>Cost build-up</h3>
            <Waterfall
              measured={totals?.subtotal ?? 0}
              contingency={totals?.contingency ?? 0}
              tax={totals?.tax ?? 0}
              total={totals?.total ?? 0}
              contingencyLabel={`Contingency ${money(settings.contingency, 1, locale)}%`}
              taxLabel={`${settings.taxName} ${money(settings.tax, 1, locale)}%`}
              currency={currency}
            />
          </div>
          <div className="scard">
            <h3>Top cost items</h3>
            <Pareto items={boq?.items ?? []} currency={currency} />
          </div>
        </div>
      </section>
      <div className="page">
        <ReportHead title="Bills of quantities" stamp={totals?.total ?? 0} currency={currency} basis={basis} doc={doc} meta={meta} />
        <div className="notes">
          Quantities are measured net from this take-off in accordance with {cover.basis}. Reinforcement comes from the bar schedule and is billed by diameter. Rates are built up from the resource databank and include labour, materials, plant, small tools, overheads and profit. All amounts are in {currency}.
        </div>
        {!bills.length ? <div className="empty" style={{ marginTop: 20 }}>No quantities yet. Add elements in the input steps.</div> : null}
        {bills.map((bill, index) => (
          <section className="bill" key={bill.title}>
            <h2>
              <span>Bill No. {index + 1} – {bill.title}</span>
              <small>{bill.rows.length} item{bill.rows.length === 1 ? "" : "s"}</small>
            </h2>
            <table className="rt">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Description</th>
                  <th className="n">Qty</th>
                  <th>Unit</th>
                  <th className="n">Rate</th>
                  <th className="n">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.rows.map((row) => {
                  const manual = stringOf(rates[row.code]);
                  return (
                    <tr key={row.code}>
                      <td className="item">{row.item}</td>
                      <td>
                        {row.desc}{" "}
                        <button className="cmt" type="button" disabled title="Comments ship in Phase 11" aria-label={`Comments on item ${row.item}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        </button>
                      </td>
                      <td className="n">{money(row.quantity, row.unit === "t" ? 3 : 2, locale)}</td>
                      <td>{row.unit}</td>
                      <td className="rate">
                        <input
                          inputMode="decimal"
                          className={manual ? "manual" : undefined}
                          value={manual}
                          placeholder={row.rate > 0 ? money(row.rate, 2, locale) : ""}
                          title={manual ? "Manual rate – clear to use the rate analysis" : "From rate analysis – type to override"}
                          aria-label={`Rate for item ${row.item}`}
                          onChange={(event) => setPath(`rates.${row.code}`, event.target.value)}
                        />
                      </td>
                      <td className="n">{row.amount ? money(row.amount, 2, locale) : "–"}</td>
                    </tr>
                  );
                })}
                <tr className="btot">
                  <td />
                  <td>Total Bill No. {index + 1} carried to summary</td>
                  <td /><td /><td />
                  <td className="n">{money(bill.rows.reduce((sum, row) => sum + row.amount, 0), 2, locale)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        ))}
        {bills.length ? <SignBlock third="Approved by" preparedBy={cover.by} /> : null}
      </div>
    </div>
  );
}
