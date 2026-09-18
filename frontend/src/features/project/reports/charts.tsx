import type { BoqItemRow } from "@takeoff/engine";
import { money, PAL, type ChartDatum } from "./reportData.js";

export type { ChartDatum } from "./reportData.js";

function short(value: string, max = 30): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function Donut({
  data,
  size = 180,
  center = "",
  sub = "",
}: {
  data: ChartDatum[];
  size?: number;
  center?: string;
  sub?: string;
}) {
  const slices = data.filter((row) => row.value > 0);
  const total = slices.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <div className="empty">No data yet</div>;
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart">
        {slices.map((row, index) => {
          const length = (row.value / total) * circumference;
          const dashOffset = -offset;
          offset += length;
          return (
            <circle
              key={row.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              style={{ stroke: row.color ?? PAL[index % PAL.length] }}
              strokeWidth="22"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            >
              <title>{`${row.label}: ${money((row.value / total) * 100, 1)}%`}</title>
            </circle>
          );
        })}
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" className="dc1">{center}</text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" className="dc2">{sub}</text>
      </svg>
      <ul className="legend">
        {slices.map((row, index) => (
          <li key={row.label}>
            <i style={{ background: row.color ?? PAL[index % PAL.length] }} />
            <span>{row.label}</span>
            <b>{money((row.value / total) * 100, 1)}%</b>
            {row.show ? <small>{row.show}</small> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({
  data,
  unit = "",
  digits = 1,
  color,
}: {
  data: ChartDatum[];
  unit?: string;
  digits?: number;
  color?: string;
}) {
  const rows = data.filter((row) => row.value > 0);
  const max = Math.max(1e-9, ...rows.map((row) => row.value));
  if (!rows.length) return <div className="empty">No data yet</div>;
  return (
    <>
      {rows.map((row) => (
        <div className="hbar" key={row.label}>
          <span title={row.label}>{short(row.label, 22)}</span>
          <div className="track">
            <div
              className="fill"
              style={{ width: `${(row.value / max) * 100}%`, background: color ?? row.color ?? "var(--ink)" }}
            />
          </div>
          <b>
            {money(row.value, digits)}
            {unit ? <> <small>{unit}</small></> : null}
          </b>
        </div>
      ))}
    </>
  );
}

export function VBars({
  data,
  unit = "",
  digits = 1,
  height = 190,
  color = "var(--ink)",
}: {
  data: ChartDatum[];
  unit?: string;
  digits?: number;
  height?: number;
  color?: string;
}) {
  const rows = data.filter((row) => row.value > 0);
  if (!rows.length) return <div className="empty">No data yet</div>;
  const width = Math.max(320, rows.length * 56);
  const max = Math.max(...rows.map((row) => row.value));
  const barWidth = Math.min(40, (width / rows.length) * 0.6);
  const top = 22;
  const base = height - 34;
  return (
    <svg className="vb" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Column chart">
      {[0, 0.5, 1].map((tick) => (
        <line
          key={tick}
          x1="0"
          x2={width}
          y1={base - (base - top) * tick}
          y2={base - (base - top) * tick}
          style={{ stroke: "var(--line)" }}
          strokeDasharray={tick ? "3 3" : undefined}
        />
      ))}
      {rows.map((row, index) => {
        const x = (index + 0.5) * width / rows.length;
        const barHeight = (base - top) * row.value / max;
        return (
          <g key={row.label}>
            <rect
              x={x - barWidth / 2}
              y={base - barHeight}
              width={barWidth}
              height={barHeight}
              rx="3"
              style={{ fill: row.color ?? color }}
            >
              <title>{`${row.label}: ${money(row.value, digits)} ${unit}`}</title>
            </rect>
            <text x={x} y={base - barHeight - 6} textAnchor="middle" className="vl">{money(row.value, digits)}</text>
            <text x={x} y={base + 16} textAnchor="middle" className="vx">{short(row.label, 10)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Pareto({ items, currency }: { items: readonly BoqItemRow[]; currency: string }) {
  const ranked = items.filter((item) => item.amount > 0).slice().sort((a, b) => b.amount - a.amount);
  const total = ranked.reduce((sum, item) => sum + item.amount, 0);
  const top = ranked.slice(0, 10);
  if (!top.length) return <div className="empty">Price the bill to see the top cost items</div>;
  const width = 640;
  const height = 250;
  const left = 40;
  const right = 40;
  const topPad = 18;
  const bottom = 60;
  const barWidth = (width - left - right) / top.length;
  let cumulative = 0;
  const points = top.map((item, index) => {
    cumulative += item.amount;
    return [left + barWidth * (index + 0.5), topPad + (height - topPad - bottom) * (1 - cumulative / total)] as const;
  });
  const shownShare = cumulative / total;
  return (
    <>
      <svg className="vb" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Top cost items">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={topPad + (height - topPad - bottom) * (1 - tick)}
              y2={topPad + (height - topPad - bottom) * (1 - tick)}
              style={{ stroke: "var(--line)" }}
              strokeDasharray="3 3"
            />
            <text
              x={width - right + 4}
              y={topPad + (height - topPad - bottom) * (1 - tick) + 4}
              className="vx"
              textAnchor="start"
            >
              {tick * 100}%
            </text>
          </g>
        ))}
        {top.map((item, index) => {
          const barHeight = (height - topPad - bottom) * item.amount / total;
          return (
            <g key={item.code}>
              <rect
                x={left + barWidth * index + barWidth * 0.15}
                y={height - bottom - barHeight}
                width={barWidth * 0.7}
                height={barHeight}
                rx="2"
                style={{ fill: "var(--steel)" }}
              >
                <title>{`${item.desc} – ${money(item.amount, 0)} ${currency}`}</title>
              </rect>
              <text x={left + barWidth * (index + 0.5)} y={height - bottom + 15} textAnchor="middle" className="vx">
                {item.item}
              </text>
            </g>
          );
        })}
        <polyline points={points.map((point) => point.join(",")).join(" ")} fill="none" style={{ stroke: "var(--ink)" }} strokeWidth="2" />
        {points.map((point, index) => (
          <circle key={top[index]!.code} cx={point[0]} cy={point[1]} r="3.5" style={{ fill: "var(--ink)" }} />
        ))}
        <text x={left} y={height - 14} className="vx" textAnchor="start">
          {`Top ${top.length} items = ${money(shownShare * 100, 1)}% of the bill · bars show share of total, line is cumulative`}
        </text>
      </svg>
      <ol className="toplist">
        {top.slice(0, 5).map((item) => (
          <li key={item.code}>
            <b>{item.item}</b> {short(item.desc, 70)}
            <span>{money(item.amount, 0)}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

export function Waterfall({
  measured,
  contingency,
  tax,
  total,
  contingencyLabel,
  taxLabel,
  currency,
}: {
  measured: number;
  contingency: number;
  tax: number;
  total: number;
  contingencyLabel: string;
  taxLabel: string;
  currency: string;
}) {
  if (!total) return <div className="empty">Price the bill to see the build-up</div>;
  const steps: [string, number, string][] = [
    ["Measured work", measured, "var(--ink)"],
    [contingencyLabel, contingency, "var(--hivis)"],
    [taxLabel, tax, "var(--core)"],
  ];
  const width = 520;
  const height = 210;
  const base = 170;
  const top = 20;
  const column = width / 4;
  let acc = 0;
  return (
    <svg className="vb" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Cost build-up">
      {steps.map(([label, value, fill], index) => {
        const y0 = base - (base - top) * acc / total;
        const barHeight = (base - top) * value / total;
        acc += value;
        return (
          <g key={label}>
            <rect
              x={column * index + column * 0.2}
              y={y0 - barHeight}
              width={column * 0.6}
              height={Math.max(barHeight, 1)}
              rx="2"
              style={{ fill }}
            />
            <text x={column * (index + 0.5)} y={y0 - barHeight - 6} textAnchor="middle" className="vl">
              {money(value, 0)}
            </text>
            <text x={column * (index + 0.5)} y={base + 16} textAnchor="middle" className="vx">{label}</text>
          </g>
        );
      })}
      <rect x={column * 3 + column * 0.2} y={top} width={column * 0.6} height={base - top} rx="2" style={{ fill: "var(--ok)" }} />
      <text x={column * 3.5} y={top - 6} textAnchor="middle" className="vl">{money(total, 0)}</text>
      <text x={column * 3.5} y={base + 16} textAnchor="middle" className="vx">{`Total ${currency}`}</text>
      <line x1="0" x2={width} y1={base} y2={base} style={{ stroke: "var(--ink)" }} />
    </svg>
  );
}

export function StackedBars({
  rows,
  diameters,
}: {
  rows: { label: string; total: number; parts: { dia: number; kg: number; color: string }[] }[];
  diameters: number[];
}) {
  if (!rows.length) return <div className="empty">No data yet</div>;
  const max = Math.max(1, ...rows.map((row) => row.total));
  return (
    <>
      {rows.map((row) => (
        <div className="stk" key={row.label}>
          <span>{row.label}</span>
          <div className="track">
            {row.parts.filter((part) => part.kg > 0).map((part) => (
              <i
                key={part.dia}
                style={{ width: `${(part.kg / max) * 100}%`, background: part.color }}
                title={`${part.dia} mm: ${money(part.kg, 0)} kg`}
              />
            ))}
          </div>
          <b>{money(row.total, 0)}</b>
        </div>
      ))}
      <ul className="legend inline">
        {diameters.map((dia, index) => (
          <li key={dia}>
            <i style={{ background: PAL[index % PAL.length] }} />
            {dia} mm
          </li>
        ))}
      </ul>
    </>
  );
}
