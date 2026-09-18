import { useNavigate, useParams } from "react-router-dom";
import { DIAMETERS, n, type NumericInput } from "@takeoff/engine";
import { asList, asRecord } from "../../../lib/doc.js";
import { useProject } from "../ProjectProvider.js";
import { useEditorComputed } from "../computed.js";
import { Donut, HBars, Pareto, StackedBars, VBars, Waterfall } from "./charts.js";
import {
  CONC_CODES,
  PAL,
  TYPICAL_RANGE,
  btypeOf,
  coverFields,
  currencyOf,
  excavationBalance,
  excavationQty,
  isBomItem,
  localeOf,
  money,
  moneyOrDash,
  reportSettings,
  stageOf,
  typeLabel,
  unitCost,
} from "./reportData.js";

export function DashboardScreen() {
  const { doc, meta } = useProject();
  const { id } = useParams();
  const navigate = useNavigate();
  const { result, boq, bom, totals, split, status } = useEditorComputed();
  const cover = coverFields(doc, meta);
  const currency = currencyOf(doc, meta);
  const locale = localeOf(doc);
  const settings = reportSettings(doc, meta);
  const btype = btypeOf(doc, meta);
  const uc = result && totals ? unitCost(doc ?? {}, result, totals.total) : null;
  const priced = boq?.items.filter((item) => item.rate > 0).length ?? 0;
  const itemCount = boq?.items.length ?? 0;
  const balance = result ? excavationBalance(result) : 0;
  const conc: Record<string, number> = {};
  const formwork: Record<string, number> = {};
  const ratioConc: Record<string, number> = {};
  result?.items.forEach((item) => {
    if (CONC_CODES.has(item.code)) {
      conc[item.el] = (conc[item.el] ?? 0) + item.q;
      if (item.code !== "CSOG") ratioConc[item.el] = (ratioConc[item.el] ?? 0) + item.q;
    }
    if (/^F(?!STRIS|F_)/.test(item.code)) formwork[item.el] = (formwork[item.el] ?? 0) + item.q;
  });
  const bars = result?.bars ?? [];
  const dias = DIAMETERS.filter((dia) => bars.some((bar) => bar.dia === dia));
  const elements = [...new Set(bars.map((bar) => bar.el))];
  const stacked = elements.map((el) => {
    const parts = dias.map((dia, index) => ({
      dia,
      kg: bars.filter((bar) => bar.el === el && bar.dia === dia).reduce((sum, bar) => sum + bar.kg, 0),
      color: PAL[index % PAL.length]!,
    }));
    return { label: el, total: parts.reduce((sum, part) => sum + part.kg, 0), parts };
  });
  const materials = (bom ?? []).filter(isBomItem).slice().sort((a, b) => b.amount - a.amount);
  const ratioEls = [...new Set((result?.items ?? []).map((item) => item.el))].filter((el) => bars.some((bar) => bar.el === el));

  let special = null;
  if (btype === "multi" && result) {
    const levels = result.levels.map((level, index) => ({
      label: level.name,
      value: result.items.filter((item) => item.lvl === index && CONC_CODES.has(item.code)).reduce((sum, item) => sum + item.q, 0),
    }));
    special = (
      <div className="chart">
        <h3>Frame concrete by level (m³)</h3>
        <VBars data={levels} unit="m³" digits={1} color="var(--core)" />
      </div>
    );
  } else if (btype === "road") {
    const sections = asList(asRecord(doc?.pl).rpave).flatMap((row, index) => {
      const item = asRecord(row);
      const length = Math.abs(n(item.to as NumericInput) - n(item.from as NumericInput));
      return [
        { label: `Cut S${index + 1}`, value: length * n(item.cut as NumericInput), color: "var(--steel)" },
        { label: `Fill S${index + 1}`, value: length * n(item.fill as NumericInput), color: "var(--core)" },
      ];
    });
    special = (
      <div className="chart">
        <h3>Cut and fill intensity by section (m × avg depth)</h3>
        <VBars data={sections} digits={0} />
      </div>
    );
  } else if (btype === "bridge") {
    special = (
      <div className="chart">
        <h3>Reinforcement intensity (kg/m³)</h3>
        <HBars
          data={Object.keys(conc).map((el) => ({
            label: el,
            value: bars.filter((bar) => bar.el === el).reduce((sum, bar) => sum + bar.kg, 0) / Math.max(conc[el] ?? 0, 1e-9),
          })).filter((row) => Number.isFinite(row.value))}
          unit="kg/m³"
          digits={0}
          color="var(--steel)"
        />
      </div>
    );
  }

  return (
    <>
      <div className="pagehead dhead">
        <div>
          <div className="kicker">{stageOf(doc, meta)} · {typeLabel(btype)} · {currency}</div>
          <h1>Dashboard</h1>
          <p>{cover.name}{cover.location ? ` · ${cover.location}` : ""}</p>
        </div>
        <div className="dact">
          <button className="btn sm" type="button" onClick={() => id && navigate(`/app/p/${id}/boq`)}>
            Open bills of quantities
          </button>
          <button className="btn sm" type="button" onClick={() => id && navigate(`/app/p/${id}/rates`)}>
            Rate analysis
          </button>
        </div>
      </div>
      {status === "error" ? <div className="alert">Could not compute this take-off.</div> : null}
      <div className="kpis dk">
        <div className="kpi hero">
          <small>Total including contingency and {settings.taxName.toLowerCase()}</small>
          <b>{moneyOrDash(totals?.total ?? 0, 0, locale)}</b>
          <span>{currency}{uc && totals?.total ? ` · ${money(uc[0], 0, locale)} ${uc[1]}` : ""}</span>
        </div>
        <div className="kpi">
          <small>Measured work</small>
          <b>{money(totals?.subtotal ?? 0, 0, locale)}</b>
          <span>{priced} of {itemCount} items priced</span>
        </div>
        <div className="kpi">
          <small>Concrete</small>
          <b>{money(result?.concrete ?? 0, 1, locale)}</b>
          <span>m³</span>
        </div>
        <div className="kpi">
          <small>Reinforcement</small>
          <b>{money((result?.steelKg ?? 0) / 1000, 2, locale)}</b>
          <span>t · {money((result?.steelKg ?? 0) / Math.max(result?.concrete ?? 1, 1), 0, locale)} kg/m³</span>
        </div>
        <div className="kpi">
          <small>Formwork</small>
          <b>{money(result?.formwork ?? 0, 0, locale)}</b>
          <span>m²</span>
        </div>
        <div className="kpi">
          <small>Excavation</small>
          <b>{money(result ? excavationQty(result) : 0, 0, locale)}</b>
          <span>m³ · balance {money(balance, 2, locale)}</span>
        </div>
      </div>
      <div className="dgrid">
        <div className="chart">
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
        <div className="chart">
          <h3>Resource split of priced work</h3>
          <Donut data={split} center="Direct" sub="cost" />
        </div>
        <div className="chart wide">
          <h3>Top 10 cost items (Pareto)</h3>
          <Pareto items={boq?.items ?? []} currency={currency} />
        </div>
        <div className="chart">
          <h3>Cost build-up to total</h3>
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
        <div className="chart">
          <h3>Concrete by element (m³)</h3>
          <HBars data={Object.entries(conc).map(([label, value]) => ({ label, value }))} unit="m³" digits={1} />
        </div>
        <div className="chart">
          <h3>Reinforcement by diameter (t)</h3>
          <VBars
            data={dias.map((dia, index) => ({
              label: `${dia} mm`,
              value: bars.filter((bar) => bar.dia === dia).reduce((sum, bar) => sum + bar.kg, 0) / 1000,
              color: PAL[index % PAL.length],
            }))}
            unit="t"
            digits={2}
          />
        </div>
        <div className="chart">
          <h3>Formwork by element (m²)</h3>
          <HBars data={Object.entries(formwork).map(([label, value]) => ({ label, value }))} unit="m²" digits={0} color="var(--core)" />
        </div>
        {stacked.length ? (
          <div className="chart wide">
            <h3>Reinforcement by element and diameter (kg)</h3>
            <StackedBars rows={stacked} diameters={[...dias]} />
          </div>
        ) : null}
        <div className="chart">
          <h3>Largest materials by cost</h3>
          <HBars data={materials.slice(0, 8).map((row) => ({ label: row.material, value: row.amount }))} digits={0} color="var(--steel)" />
        </div>
        {special}
      </div>
      {ratioEls.length ? (
        <div className="chart">
          <h3>Reinforcement ratios</h3>
          <p className="muted" style={{ margin: "-6px 0 10px" }}>
            Ratios exclude the mesh-reinforced ground slab. Beam concrete is measured below the slab, so beam ratios read higher than full-section figures.
          </p>
          <div className="scroll" style={{ border: 0 }}>
            <table className="dt" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th>Element</th>
                  {dias.map((dia) => <th className="n" key={dia}>{dia} mm</th>)}
                  <th className="n">Total kg</th>
                  <th className="n">kg/m³</th>
                  <th>Typical range</th>
                </tr>
              </thead>
              <tbody>
                {ratioEls.map((el) => {
                  const kg = bars.filter((bar) => bar.el === el).reduce((sum, bar) => sum + bar.kg, 0);
                  const ratio = kg / Math.max(ratioConc[el] ?? 0, 1e-9);
                  const range = TYPICAL_RANGE[el];
                  const ok = !range || (ratio >= range[0] && ratio <= range[1]);
                  return (
                    <tr key={el}>
                      <td>{el}</td>
                      {dias.map((dia) => {
                        const value = bars.filter((bar) => bar.el === el && bar.dia === dia).reduce((sum, bar) => sum + bar.kg, 0);
                        return <td className="n" key={dia}>{value ? money(value, 0, locale) : "–"}</td>;
                      })}
                      <td className="n sq">{money(kg, 0, locale)}</td>
                      <td className="n">{conc[el] ? money(ratio, 0, locale) : "–"}</td>
                      <td>
                        {range ? (
                          <span className={`tag ${ok ? "ok" : "no"}`}>{ok ? "typical" : "check"} {range[0]}–{range[1]}</span>
                        ) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
}
