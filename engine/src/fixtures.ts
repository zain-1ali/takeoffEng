import type { StructuralProject } from "./types.js";

export function createMultiStoreyExample(): StructuralProject {
  const levels = [
    ["l0", "Ground floor", 4],
    ["l1", "First floor", 3.3],
    ["l2", "Second floor", 3.3],
    ["l3", "Third floor", 3.3],
    ["l4", "Fourth floor", 3.3],
    ["l5", "Fifth floor", 3.3],
  ].map(([id, name, height]) => ({
    id: String(id),
    name: String(name),
    h: Number(height),
    zone: 0.2,
  }));

  const types: StructuralProject["types"] = {
    pad: [
      { id: "F1", mark: "F1", L: 1.8, W: 1.8, D: 0.5, depth: 1.5, sb: 400, sd: 400, sh: 0.95, bxd: 12, bxs: 200, byd: 12, bys: 200, top: false, stn: 8, std: 16, stl: 2.2, lkd: 8, lks: 200 },
      { id: "F2", mark: "F2", L: 2.4, W: 2.4, D: 0.6, depth: 1.8, sb: 450, sd: 450, sh: 1.15, bxd: 16, bxs: 175, byd: 16, bys: 175, top: false, stn: 8, std: 20, stl: 2.6, lkd: 10, lks: 200 },
      { id: "F3", mark: "F3", L: 3, W: 3, D: 0.8, depth: 2, sb: 500, sd: 500, sh: 1.15, bxd: 16, bxs: 150, byd: 16, bys: 150, top: true, stn: 12, std: 20, stl: 2.8, lkd: 10, lks: 150 },
    ],
    strip: [
      { id: "SF1", mark: "SF1", B: 0.6, D: 0.25, depth: 0.9, td: 12, ts: 250, ln: 4, ld: 12 },
    ],
    gbeam: [
      { id: "GB1", mark: "GB1", b: 300, h: 600, botN: 3, botD: 16, topN: 3, topD: 16, extN: 0, extD: 16, extF: 0.25, sideN: 2, sideD: 12, lkd: 10, lks: 200, lksEnd: 150, ez: 0.6 },
    ],
    column: [
      { id: "C1", mark: "C1", b: 500, d: 500, nb: 12, dia: 20, lkd: 10, lks: 200, lksEnd: 100, ez: 0.6 },
      { id: "C2", mark: "C2", b: 450, d: 450, nb: 8, dia: 20, lkd: 10, lks: 200, lksEnd: 100, ez: 0.5 },
      { id: "C3", mark: "C3", b: 400, d: 400, nb: 8, dia: 16, lkd: 8, lks: 200, lksEnd: 100, ez: 0.5 },
      { id: "C4", mark: "C4", b: 300, d: 600, nb: 10, dia: 16, lkd: 8, lks: 200, lksEnd: 100, ez: 0.6 },
    ],
    beam: [
      { id: "B1", mark: "B1", b: 300, h: 600, botN: 4, botD: 20, topN: 2, topD: 16, extN: 2, extD: 20, extF: 0.25, sideN: 2, sideD: 12, lkd: 10, lks: 200, lksEnd: 100, ez: 0.9 },
      { id: "B2", mark: "B2", b: 250, h: 450, botN: 3, botD: 16, topN: 2, topD: 12, extN: 2, extD: 16, extF: 0.25, sideN: 0, sideD: 12, lkd: 8, lks: 200, lksEnd: 100, ez: 0.6 },
      { id: "B3", mark: "B3", b: 350, h: 700, botN: 5, botD: 25, topN: 3, topD: 20, extN: 3, extD: 25, extF: 0.3, sideN: 2, sideD: 12, lkd: 10, lks: 150, lksEnd: 100, ez: 1 },
    ],
    slab: [
      { id: "S1", mark: "S1", t: 200, bxd: 12, bxs: 200, byd: 12, bys: 200, topMode: "supports", txd: 12, txs: 200, tyd: 12, tys: 200 },
      { id: "S2", mark: "S2", t: 150, bxd: 10, bxs: 200, byd: 10, bys: 200, topMode: "supports", txd: 10, txs: 250, tyd: 10, tys: 250 },
    ],
    wall: [
      { id: "W1", mark: "W1", t: 200, faces: "2", vd: 12, vs: 200, hd: 10, hs: 200 },
    ],
    stair: [
      { id: "ST1", mark: "ST1", width: 1.2, going: 3, rise: 1.65, waist: 150, landing: 1.4, md: 12, ms: 150, dd: 10, ds: 250 },
    ],
  };

  const placements: StructuralProject["pl"] = {
    pad: [
      { id: "pf1", type: "F1", no: 4, ref: "Corners A1, A6, D1, D6" },
      { id: "pf2", type: "F2", no: 12, ref: "Edge columns" },
      { id: "pf3", type: "F3", no: 8, ref: "Internal B2–C5" },
    ],
    strip: [
      { id: "sf1", type: "SF1", len: 46, no: 1, ref: "Under ground floor walls" },
    ],
    gbeam: [
      { id: "gb1", type: "GB1", span: 5.5, no: 22, ref: "Grids 1–6 and A–D" },
    ],
    column: [],
    beam: [],
    slab: [],
    wall: [],
    stair: [],
  };

  levels.forEach((level, index) => {
    if (index < 3) {
      placements.column.push(
        { id: `c${index}-1`, level: level.id, type: "C1", no: 8, h: "", ref: "Internal B2–C5" },
        { id: `c${index}-2`, level: level.id, type: "C2", no: 12, h: "", ref: "Edge columns" },
        { id: `c${index}-3`, level: level.id, type: "C3", no: 4, h: "", ref: "Corners" },
      );
    } else {
      placements.column.push(
        { id: `c${index}-2`, level: level.id, type: "C2", no: 8, h: "", ref: "Internal B2–C5" },
        { id: `c${index}-3`, level: level.id, type: "C3", no: 16, h: "", ref: "Edge and corner" },
      );
    }
    if (index === 0) {
      placements.column.push(
        { id: "c0-4", level: level.id, type: "C4", no: 2, h: "", ref: "Entrance canopy" },
      );
    }
    placements.beam.push(
      { id: `b${index}-1`, level: level.id, type: "B1", span: 5.5, no: 16, ref: "Internal grids" },
      { id: `b${index}-2`, level: level.id, type: "B2", span: 5.6, no: 5, ref: "Secondary, bay 2–3" },
      { id: `b${index}-3`, level: level.id, type: "B3", span: 5.5, no: 6, ref: "Edge beams grid A and D" },
    );
    placements.slab.push(
      { id: `s${index}-1`, level: level.id, type: "S1", L: 6, W: 6, bw: 0.3, no: 10, less: 0, edge: 95, ref: "Office bays" },
      { id: `s${index}-2`, level: level.id, type: "S2", L: 6, W: 5, bw: 0.3, no: 5, less: index < 5 ? 12.4 : 6.8, edge: 0, ref: "Core and stair bays" },
    );
    placements.wall.push(
      { id: `w${index}`, level: level.id, type: "W1", len: 10.4, h: "", op: 2.42, ref: "Lift core" },
    );
    if (index < 5) {
      placements.stair.push(
        { id: `st${index}`, level: level.id, type: "ST1", flights: 4, landings: 4, ref: "Stairs 1 and 2" },
      );
    }
  });

  return {
    project: {
      name: "Six-storey office building – structural works",
      currency: "USD",
      numfmt: "en-GB",
    },
    btype: "multi",
    levels,
    types,
    pl: placements,
    sog: {
      area: 520, edge: 95, t: 150, hardcore: 200, sand: 50,
      dpm: true, mesh: "A193", topsoil: 150,
    },
    rules: {
      ws: 0.3, wsOn: true, supOn: true, attOn: true, blinding: 50,
      cF: 50, cC: 40, cB: 30, cS: 25, cW: 30,
      anchF: 12, anchB: 40, anchS: 20, lap: 50, hook: 24, stock: 12,
    },
    grades: {
      blind: "C15", found: "C25/30", frame: "C30/37",
      civil: "C25/30", bridge: "C35/45",
    },
  };
}
