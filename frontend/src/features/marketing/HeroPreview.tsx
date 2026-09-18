import { createCompleteBuildingExample } from "@takeoff/engine";
import { useMemo } from "react";
import { useComputed } from "../editor/useComputed.js";
import { formatNumber } from "../../lib/format.js";

export function HeroPreview() {
  const project = useMemo(() => createCompleteBuildingExample(), []);
  const computed = useComputed(project);
  const bills = (computed.boq?.bills ?? []).slice(0, 5);
  const top = [...(computed.boq?.items ?? [])].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const total = computed.totals?.total ?? 0;
  const billSum = bills.reduce((sum, bill) => sum + bill.amount, 0) || 1;
  let acc = 0;
  const stops = bills.map((bill, index) => {
    const start = (acc / billSum) * 360;
    acc += bill.amount;
    const end = (acc / billSum) * 360;
    const color = ["#18232e", "#2f5d8a", "#8a3f17", "#e3a800", "#2e6b3f"][index] ?? "#5e6973";
    return `${color} ${start}deg ${end}deg`;
  });

  return (
    <div className="lhshot" aria-label="Live preview from the example project">
      <div className="shotbar">
        <i /><i /><i />
        <span>{project.project.name}</span>
      </div>
      <div className="shotkpis">
        <div className="dark">
          <small>Total incl. contingency</small>
          <b>{formatNumber(total, 0)}</b>
          <span>USD</span>
        </div>
        <div>
          <small>Concrete</small>
          <b>{formatNumber(computed.totals?.concrete ?? 0, 0)} m³</b>
        </div>
        <div>
          <small>Steel</small>
          <b>{formatNumber((computed.totals?.steelKg ?? 0) / 1000, 1)} t</b>
        </div>
      </div>
      <div className="shotgrid">
        <div className="shotcard">
          <h4>Cost by bill</h4>
          <div
            className="donut"
            style={{ background: `conic-gradient(${stops.join(", ") || "#cdd1cc 0 360deg"})` }}
            aria-hidden="true"
          />
        </div>
        <div className="shotcard">
          <h4>Top items</h4>
          {top.map((row) => (
            <div className="hbar" key={row.code}>
              <span>
                {row.desc}
                <i style={{ width: `${Math.min(100, (row.amount / (top[0]?.amount || 1)) * 100)}%` }} />
              </span>
              <b>{formatNumber(row.amount, 0)}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="shotfoot">
        Live from the example multi-storey project
        {computed.status !== "ready" ? " · computing…" : ""}
      </div>
    </div>
  );
}
