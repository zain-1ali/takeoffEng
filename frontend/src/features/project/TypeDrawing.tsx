import { ceilSafe, n, type NumericInput } from "@takeoff/engine";
import type { ReactNode } from "react";
import { asRecord, stringOf, type DocMap } from "../../lib/doc.js";
import { formatNumber } from "../../lib/format.js";

function nn(value: unknown): number {
  return n((value ?? 0) as NumericInput);
}

function css(name: string): string {
  if (typeof document === "undefined") {
    const fallback: Record<string, string> = {
      "--ink": "#18232e",
      "--conc": "#c3c7c9",
      "--steel": "#8a3f17",
      "--muted": "#5e6973",
      "--soil": "#c9b89a",
      "--soil-dark": "#a8946f",
      "--blind": "#8e9496",
      "--paper": "#f3f4f2",
      "--core": "#2f5d8a",
      "--hivis": "#e3a800",
      "--warn": "#b3261e",
      "--ok": "#2e6b3f",
    };
    return fallback[name] ?? "#18232e";
  }
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#18232e";
}

function txt(x: number, y: number, label: string, anchor: "start" | "middle" | "end" = "middle") {
  return (
    <text
      key={`${x}-${y}-${label}`}
      x={x}
      y={y}
      fontSize="11.5"
      textAnchor={anchor}
      fill={css("--ink")}
      fontFamily="Barlow Semi Condensed, Arial"
      fontWeight="600"
    >
      {label}
    </text>
  );
}

function wrap(width: number, height: number, label: string, children: ReactNode) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

export function TypeDrawing({ kind, type, rules }: { kind: string; type: DocMap | null; rules: DocMap }) {
  if (!type) return <p className="text-muted">Select a type to see the section.</p>;
  const mapped = ({ bfoot: "pad", bpier: "column", bbeam: "beam", bslab: "slab", bwall: "wall" } as Record<string, string>)[kind] ?? kind;
  const ink = css("--ink");
  const conc = css("--conc");
  const steel = css("--steel");
  const soil = css("--soil");
  const paper = css("--paper");
  const W = 320;
  const mark = stringOf(type.mark, "type");

  if (mapped === "column" || mapped === "beam" || mapped === "gbeam") {
    const isCol = mapped === "column";
    const bw = nn(type.b);
    const bh = nn(isCol ? type.d : type.h);
    if (!bw || !bh) return null;
    const s = Math.min(220 / bw, 220 / bh);
    const x0 = (W - bw * s) / 2;
    const y0 = 26;
    const cover = nn(isCol ? rules.cC : rules.cB) * s;
    const lk = Math.max(nn(type.lkd) * s, 1.4);
    const ins = cover + lk;
    const L = x0 + ins;
    const R = x0 + bw * s - ins;
    const T = y0 + ins;
    const B = y0 + bh * s - ins;
    const dots: ReactNode[] = [];
    if (isCol) {
      const N = Math.max(4, nn(type.nb));
      const r = Math.max(nn(type.dia) * s / 2, 2.5);
      const extra = N - 4;
      const perSideB = Math.ceil(extra * bw / (2 * (bw + bh)));
      const perSideD = Math.floor((extra - 2 * perSideB) / 2);
      const pts: [number, number][] = [[L + r, T + r], [R - r, T + r], [R - r, B - r], [L + r, B - r]];
      for (let i = 1; i <= perSideB; i += 1) {
        const x = L + r + (R - L - 2 * r) * i / (perSideB + 1);
        pts.push([x, T + r], [x, B - r]);
      }
      for (let i = 1; i <= perSideD; i += 1) {
        const y = T + r + (B - T - 2 * r) * i / (perSideD + 1);
        pts.push([L + r, y], [R - r, y]);
      }
      const left = N - pts.length;
      for (let i = 0; i < left; i += 1) pts.push([L + r + (R - L - 2 * r) * (i + 1) / (left + 1), (T + B) / 2]);
      pts.forEach(([x, y], i) => dots.push(<circle key={i} cx={x} cy={y} r={r} fill={steel} />));
    } else {
      const row = (count: unknown, dia: unknown, y: number, key: string) => {
        const N = nn(count);
        if (!N) return;
        const r = Math.max(nn(dia) * s / 2, 2.5);
        for (let i = 0; i < N; i += 1) {
          const x = N === 1 ? (L + R) / 2 : L + r + (R - L - 2 * r) * i / (N - 1);
          dots.push(<circle key={`${key}-${i}`} cx={x} cy={y} r={r} fill={steel} />);
        }
      };
      row(type.topN, type.topD, T + Math.max(nn(type.topD) * s / 2, 2.5), "top");
      row(type.botN, type.botD, B - Math.max(nn(type.botD) * s / 2, 2.5), "bot");
    }
    const caption = isCol
      ? `${type.b} × ${type.d} mm · ${type.nb} Y${type.dia}`
      : `${type.b} × ${type.h} mm · ${type.botN}Y${type.botD} btm`;
    return wrap(W, y0 + bh * s + 36, `Section through ${mark}`, (
      <>
        <rect x={x0} y={y0} width={bw * s} height={bh * s} fill={conc} stroke={ink} strokeWidth="1.2" />
        <rect x={x0 + cover} y={y0 + cover} width={bw * s - 2 * cover} height={bh * s - 2 * cover} rx={lk * 2} fill="none" stroke={steel} strokeWidth={lk} />
        {dots}
        {txt(W / 2, y0 + bh * s + 20, caption)}
      </>
    ));
  }

  if (mapped === "pad") {
    const L = nn(type.L);
    const H = nn(type.depth);
    const D = nn(type.D);
    const ws = rules.wsOn ? nn(rules.ws) : 0;
    const eL = L + 2 * ws;
    const G = nn(rules.blinding) / 1000;
    const sb = nn(type.sb) / 1000;
    const sh = nn(type.sh);
    const s = Math.min(260 / Math.max(eL, 0.5), 190 / Math.max(H, 0.5));
    const cx = W / 2;
    const gy = 24;
    const X = (m: number) => cx + m * s;
    const Y = (m: number) => gy + m * s;
    const top = H - G - D;
    const c = nn(rules.cF) / 1000;
    return wrap(W, Y(H) + 24, `Section through ${mark}`, (
      <>
        <rect x="0" y={gy} width={W} height={H * s + 20} fill={soil} opacity="0.5" />
        <rect x={X(-eL / 2)} y={gy} width={eL * s} height={H * s} fill={paper} stroke={css("--soil-dark")} strokeDasharray="4 3" />
        <rect x={X(-L / 2)} y={Y(H - G)} width={L * s} height={Math.max(G * s, 2)} fill={css("--blind")} />
        <rect x={X(-L / 2)} y={Y(top)} width={L * s} height={D * s} fill={conc} stroke={ink} />
        <rect x={X(-sb / 2)} y={Y(top - sh)} width={sb * s} height={sh * s} fill={conc} stroke={ink} />
        <line x1={X(-L / 2 + c)} y1={Y(H - G - c)} x2={X(L / 2 - c)} y2={Y(H - G - c)} stroke={steel} strokeWidth="2.2" />
        <line x1="0" y1={gy} x2={W} y2={gy} stroke={ink} strokeWidth="1.4" />
        {txt(8, gy - 8, "EGL", "start")}
        {txt(W / 2, Y(H) + 16, `${formatNumber(L, 2)} × ${formatNumber(nn(type.W), 2)} × ${formatNumber(D, 2)} m`)}
      </>
    ));
  }

  if (mapped === "strip") {
    const B = nn(type.B);
    const D = nn(type.D);
    if (!B || !D) return null;
    const s = Math.min(240 / B, 150 / D);
    const x0 = (W - B * s) / 2;
    const y0 = 20;
    const c = nn(rules.cF) * s / 1000;
    const N = nn(type.ln);
    const r = Math.max(nn(type.ld) * s / 2000, 3);
    const dots = Array.from({ length: Math.max(0, N) }, (_, i) => (
      <circle
        key={i}
        cx={x0 + c + r + (B * s - 2 * c - 2 * r) * (N === 1 ? 0.5 : i / Math.max(N - 1, 1))}
        cy={y0 + D * s - c - r - 2}
        r={r}
        fill={steel}
      />
    ));
    return wrap(W, y0 + D * s + 30, `Section through ${mark}`, (
      <>
        <rect x={x0} y={y0} width={B * s} height={D * s} fill={conc} stroke={ink} />
        <line x1={x0 + c} y1={y0 + D * s - c} x2={x0 + B * s - c} y2={y0 + D * s - c} stroke={steel} strokeWidth="2.4" />
        {dots}
        {txt(W / 2, y0 + D * s + 20, `${formatNumber(B, 2)} × ${formatNumber(D, 2)} m`)}
      </>
    ));
  }

  if (mapped === "slab" || mapped === "wall") {
    const th = nn(type.t) / 1000;
    const len = 1;
    const s = 280 / len;
    const y0 = 30;
    const x0 = 20;
    const hh = th * s * 1.6;
    const c = nn(mapped === "slab" ? rules.cS : rules.cW) / 1000 * s * 1.6;
    const label = mapped === "slab"
      ? `${type.t} mm · B: Y${type.bxd}@${type.bxs}`
      : `${type.t} mm · ${type.faces} layer · V Y${type.vd}@${type.vs}`;
    return wrap(W, y0 + hh + 30, `Section through ${mark}`, (
      <>
        <rect x={x0} y={y0} width={len * s} height={hh} fill={conc} stroke={ink} />
        {mapped === "slab" ? (
          <line x1={x0} y1={y0 + hh - c - 4} x2={x0 + len * s} y2={y0 + hh - c - 4} stroke={steel} strokeWidth="1.6" />
        ) : (
          <circle cx={x0 + 12} cy={y0 + c + 6} r="3" fill={steel} />
        )}
        {txt(W / 2, y0 + hh + 20, label)}
      </>
    ));
  }

  if (mapped === "stair") {
    const go = nn(type.going);
    const ri = nn(type.rise);
    const la = nn(type.landing);
    const s = Math.min(260 / (go + la || 1), 170 / Math.max(ri, 0.5));
    const x0 = 24;
    const yb = 24 + ri * s;
    const nR = Math.max(1, ceilSafe(ri / 0.175));
    let d = `M${x0} ${yb}`;
    for (let i = 0; i < nR; i += 1) {
      const x = x0 + go * s * i / nR;
      const y = yb - ri * s * (i + 1) / nR;
      d += ` L${x} ${y} L${x + go * s / nR} ${y}`;
    }
    d += ` L${x0 + (go + la) * s} ${yb - ri * s}`;
    const wa = nn(type.waist) / 1000 * s;
    d += ` L${x0 + (go + la) * s} ${yb - ri * s + wa} L${x0 + go * s} ${yb - ri * s + wa} L${x0} ${yb + wa * 1.2} Z`;
    return wrap(W, yb + 40, `Section through ${mark}`, (
      <>
        <path d={d} fill={conc} stroke={ink} />
        {txt(W / 2, yb + 30, `${nR} risers · going ${formatNumber(go, 2)} m`)}
      </>
    ));
  }

  if (mapped === "roof") {
    const ink = css("--ink");
    const conc = css("--conc");
    const steel = css("--steel");
    const core = css("--core");
    const hv = css("--hivis");
    const form = stringOf(type.form);
    if (form === "Flat concrete slab") {
      const f = Math.max(6, nn(type.falls) * 0.25);
      return wrap(W, 150, "Flat roof build-up", (
        <>
          <rect x="20" y="80" width="280" height="36" fill={conc} stroke={ink} />
          <path d={`M20 80 L300 80 L300 ${80 - f * 1.8} L20 ${80 - f * 0.4} Z`} fill={hv} opacity=".6" stroke={ink} strokeWidth=".5" />
          <path d={`M20 ${80 - f * 0.4 - 4} L300 ${80 - f * 1.8 - 4} L300 ${80 - f * 1.8} L20 ${80 - f * 0.4} Z`} fill={ink} />
          <rect x="286" y={50 - f} width="14" height={30 + f} fill={conc} stroke={ink} />
          {txt(160, 134, `${stringOf(type.cover)} · screed to falls ${formatNumber(nn(type.falls), 0)} mm avg`)}
          {stringOf(type.ins) && stringOf(type.ins) !== "None" ? txt(160, 148, stringOf(type.ins)) : null}
        </>
      ));
    }
    const pitch = Math.min(60, Math.max(0, nn(type.pitch))) * Math.PI / 180;
    const span = 220;
    const mono = form === "Mono-pitch";
    const rise = (mono ? span : span / 2) * Math.tan(pitch);
    const base = 40 + Math.min(110, rise) + 10;
    const x0 = 50;
    const x1 = x0 + span;
    const xm = mono ? x1 : x0 + span / 2;
    const yTop = base - Math.min(110, rise);
    const ov = Math.min(30, nn(type.overhang) * 40);
    const coverKind = /tile/i.test(stringOf(type.cover)) ? "#B5633E" : core;
    const structStroke = stringOf(type.struct) === "Steel trusses" ? steel : "#9A6B3F";
    const purlins = [];
    for (let i = 1; i < 6; i += 1) {
      const x = x0 + span * i / 6;
      const yy = mono
        ? base - (x - x0) * Math.tan(pitch)
        : (x <= xm ? base - (x - x0) * Math.tan(pitch) : base - (x1 - x) * Math.tan(pitch));
      purlins.push(
        <line key={i} x1={x} y1={base} x2={x} y2={Math.max(yTop, yy)} stroke={structStroke} strokeWidth="1.5" />,
      );
    }
    const leftEaveY = base + ov * Math.tan(pitch);
    const rightEaveY = base + ov * Math.tan(pitch);
    const points = mono
      ? `${x0 - ov},${leftEaveY} ${xm},${yTop}`
      : `${x0 - ov},${leftEaveY} ${xm},${yTop} ${x1 + ov},${rightEaveY}`;
    return wrap(W, base + 84, "Roof section", (
      <>
        <rect x={x0 - 6} y={base} width="12" height="40" fill={conc} stroke={ink} />
        <rect x={x1 - 6} y={base} width="12" height="40" fill={conc} stroke={ink} />
        <polyline points={points} fill="none" stroke={coverKind} strokeWidth="5" strokeLinejoin="round" />
        <line x1={x0} y1={base} x2={x1} y2={base} stroke={structStroke} strokeWidth="3" />
        {purlins}
        {type.gutter ? (
          <>
            <rect x={x0 - ov - 10} y={leftEaveY - 2} width="10" height="8" fill={ink} />
            {mono ? null : <rect x={x1 + ov} y={rightEaveY - 2} width="10" height="8" fill={ink} />}
          </>
        ) : null}
        {txt(xm, yTop - 8, `${formatNumber(nn(type.pitch), 1)}°`)}
        {txt(160, base + 60, `${form} · ${stringOf(type.cover)}`)}
        {txt(160, base + 76, `${stringOf(type.struct)}${nn(type.ts) ? ` at ${formatNumber(nn(type.ts), 1)} m` : ""} · purlins ${formatNumber(nn(type.ps), 0)} mm`)}
      </>
    ));
  }

  return (
    <p className="text-muted">
      {stringOf(asRecord(type).mark, "This type")} has no dedicated drawing yet.
    </p>
  );
}
