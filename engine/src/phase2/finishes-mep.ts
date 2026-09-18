import { n } from "../expression.js";
import type { Level, NumericInput, TypeStats } from "../types.js";
import type {
  CeilingFinishType,
  ElectricalGearType,
  ElectricalPointType,
  FinishesDefaults,
  FloorFinishType,
  MasonryType,
  MEPDefaults,
  Phase2ComputeOptions,
  Phase2IdFactory,
  Phase2LevelIndex,
  Phase2MeasureContext,
  PlumbingType,
  QuantityPlacement,
  SanitaryType,
  WallFinishType,
} from "./finishes-mep-types.js";

export type * from "./finishes-mep-types.js";

export const MASONRY_MATERIAL_CODES = {
  "Hollow concrete block": "HB",
  "Solid concrete block": "SB",
  "Burnt clay brick": "BR",
  Stone: "ST",
} as const;

export const PHASE2_KINDS = [
  "masonry", "wfin", "ffin", "cfin",
  "elec", "elecgear", "sanit", "plumb",
] as const;

export function sanitizeMark(mark: string): string {
  return String(mark || "X").replace(/[^A-Za-z0-9]/g, "") || "X";
}

function levelIndexOf(index: Phase2LevelIndex, id: string): number | undefined {
  if (typeof (index as { get?: unknown }).get === "function") {
    return (index as ReadonlyMap<string, number>).get(id);
  }
  return (index as Readonly<Record<string, number>>)[id];
}

function useType(byType: Record<string, TypeStats>, id: string): void {
  const stats = (byType[id] ??= { conc: 0, kg: 0, uses: 0 });
  stats.uses += 1;
}

function findType<T extends { id: string }>(
  values: readonly T[] | undefined,
  id: string,
): T | undefined {
  return values?.find((value) => value.id === id);
}

function levelFor(
  levels: readonly Level[],
  levelIndex: Phase2LevelIndex,
  id: string,
): { level: Level; index: number } | undefined {
  const index = levelIndexOf(levelIndex, id);
  const level = index === undefined ? undefined : levels[index];
  return level === undefined || index === undefined ? undefined : { level, index };
}

function wallFace(
  options: Phase2ComputeOptions,
  context: Phase2MeasureContext,
  finishId: string,
  length: number,
  height: number,
  openings: number,
  explicitArea?: number,
): void {
  const finish = findType(options.project.types.wfin, finishId);
  if (!finish) return;
  useType(options.byType, finish.id);
  const put = (code: string): void => {
    if (explicitArea !== undefined) {
      options.add(context, code, 1, explicitArea, null, null);
    } else {
      options.add(context, code, 1, length, height, null);
      if (openings > 0) options.add(context, code, -1, openings, null, null);
    }
  };
  if (finish.base !== "None" && n(finish.bt) > 0) {
    put(
      finish.base === "Gypsum skim"
        ? `SKIM${n(finish.bt)}`
        : `${finish.side === "External" ? "PLE" : "PLI"}${n(finish.bt)}`,
    );
  }
  if (finish.fin === "Emulsion paint" && n(finish.coats) > 0) {
    put(`PNTI${n(finish.coats)}`);
  } else if (finish.fin === "Weatherproof paint" && n(finish.coats) > 0) {
    put(`PNTX${n(finish.coats)}`);
  } else if (finish.fin === "Ceramic wall tiles") {
    put(`WTILE_${sanitizeMark(finish.mark)}`);
  } else if (finish.fin === "Stone cladding") {
    put(`CLAD_${sanitizeMark(finish.mark)}`);
  }
}

/** Ports the prototype's computeFinishes function, including its module gate. */
export function computeFinishes(options: Phase2ComputeOptions): void {
  if (!options.kinds.includes("masonry")) return;
  const { project } = options;

  for (const placement of project.pl.masonry ?? []) {
    const found = levelFor(options.levels, options.levelIndex, placement.level);
    if (!found) continue;
    const type = findType(project.types.masonry, placement.type);
    if (!type) {
      options.warn.push("Masonry: a row refers to a type that no longer exists.");
      continue;
    }
    useType(options.byType, type.id);
    const length = n(placement.len);
    const height = n(placement.h) > 0
      ? n(placement.h)
      : Math.max(0, n(found.level.h) - n(found.level.zone));
    const openings = n(placement.op);
    const external = placement.pos !== "Internal";
    const material = MASONRY_MATERIAL_CODES[type.mat] ?? "HB";
    const context: Phase2MeasureContext = {
      loc: `${found.level.name} – masonry ${type.mark} ${external ? "external" : "internal"}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: found.index,
      el: "Masonry",
      pid: placement.id,
      tid: type.id,
      grp: "LINT",
      member: `${type.mark}L`,
      members: n(placement.opn),
    };
    if (openings > length * height) {
      options.warn.push(
        `${type.mark} on ${found.level.name}: openings are larger than the wall area.`,
      );
    }
    const code = `MAS${material}${n(type.t)}${external ? "E" : "I"}`;
    options.add(context, code, 1, length, height, null);
    if (openings > 0) options.add(context, code, -1, openings, null, null);

    const course = (n(type.uH) + n(type.joint)) / 1_000;
    if (n(type.bfc) > 0 && course > 0) {
      options.add(
        context,
        "BFORCE",
        Math.floor(height / course / n(type.bfc)),
        length,
        null,
        null,
      );
    }
    if (type.dpc && found.index === 0) {
      options.add(context, `DPC${n(type.t)}`, 1, length, null, null);
    }

    const openingCount = n(placement.opn);
    if (openingCount > 0 && n(placement.opw) > 0 && n(type.lh) > 0) {
      const lintelLength = n(placement.opw) + 2 * n(type.bear);
      const width = n(type.t) / 1_000;
      const lintelHeight = n(type.lh) / 1_000;
      options.add(context, "CLINT", openingCount, lintelLength, width, lintelHeight);
      options.add(
        context,
        "FLINT",
        openingCount,
        lintelLength,
        width + 2 * lintelHeight,
        null,
      );
      options.bar(context, "Straight + anchorage", type.lbar, 2, lintelLength + 0.25);
      options.bar(
        context,
        "Straight",
        Math.max(8, n(type.lbar) - 2),
        2,
        lintelLength - 0.05,
      );
      options.bar(
        context,
        "Closed link",
        type.llk,
        options.nB(lintelLength - 0.05, 200),
        2 * ((width - 0.05) + (lintelHeight - 0.05)) + 0.2,
      );
    }
    wallFace(options, context, placement.f1, length, height, openings);
    wallFace(options, context, placement.f2, length, height, openings);
  }

  for (const placement of project.pl.wfin ?? []) {
    const found = levelFor(options.levels, options.levelIndex, placement.level);
    if (!found) continue;
    const finish = findType(project.types.wfin, placement.type);
    if (!finish) continue;
    wallFace(
      options,
      {
        loc: `${found.level.name} – wall finish ${finish.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
        lvl: found.index,
        el: "Finishes",
        pid: placement.id,
        tid: finish.id,
      },
      finish.id,
      0,
      0,
      0,
      n(placement.area),
    );
  }

  for (const placement of project.pl.ffin ?? []) {
    const found = levelFor(options.levels, options.levelIndex, placement.level);
    if (!found) continue;
    const floor = findType(project.types.ffin, placement.type);
    const count = n(placement.no) || 1;
    const area = n(placement.area);
    const context: Phase2MeasureContext = {
      loc: `${found.level.name} – ${placement.room || "room"} finishes`,
      lvl: found.index,
      el: "Finishes",
      pid: placement.id,
      tid: floor?.id ?? "x",
    };
    if (floor) {
      useType(options.byType, floor.id);
      if (n(floor.screed) > 0) {
        options.add(context, `SCR${n(floor.screed)}`, count, area, null, null);
      }
      options.add(
        context,
        floor.fin === "Power-floated concrete"
          ? "PFLOAT"
          : `FF_${sanitizeMark(floor.mark)}`,
        count,
        area,
        null,
        null,
      );
      if (floor.skm !== "None" && n(floor.skh) > 0) {
        options.add(
          context,
          `SK_${sanitizeMark(floor.mark)}`,
          count,
          Math.max(0, n(placement.perim) - n(placement.doors)),
          null,
          null,
        );
      }
    }

    const ceiling = findType(project.types.cfin, placement.cf);
    if (!ceiling) continue;
    useType(options.byType, ceiling.id);
    if (ceiling.kind === "Plaster and paint to soffit") {
      if (n(ceiling.bt) > 0) {
        options.add(context, `CPL${n(ceiling.bt)}`, count, area, null, null);
      }
      if (n(ceiling.coats) > 0) {
        options.add(context, `CPNT${n(ceiling.coats)}`, count, area, null, null);
      }
    } else if (ceiling.kind === "Paint to fair-faced soffit") {
      if (n(ceiling.coats) > 0) {
        options.add(context, `CPNT${n(ceiling.coats)}`, count, area, null, null);
      }
    } else {
      options.add(
        context,
        `CSUS_${sanitizeMark(ceiling.mark)}`,
        count,
        area,
        null,
        null,
      );
      if (
        ceiling.kind === "Gypsum board suspended ceiling" &&
        n(ceiling.coats) > 0
      ) {
        options.add(context, `CPNT${n(ceiling.coats)}`, count, area, null, null);
      }
    }
  }
}

type MEPType = ElectricalPointType | ElectricalGearType | SanitaryType | PlumbingType;
type MEPPlacement =
  | { id: string; level: string; type: string; ref?: string; no: NumericInput }
  | QuantityPlacement;

function eachMEP<T extends MEPType, P extends MEPPlacement>(
  options: Phase2ComputeOptions,
  values: readonly T[] | undefined,
  placements: readonly P[] | undefined,
  label: string,
  element: "Electrical" | "Plumbing",
  callback: (type: T, placement: P, context: Phase2MeasureContext) => void,
): void {
  for (const placement of placements ?? []) {
    const found = levelFor(options.levels, options.levelIndex, placement.level);
    if (!found) continue;
    const type = findType(values, placement.type);
    if (!type) {
      options.warn.push(`${label}: a row refers to a type that no longer exists.`);
      continue;
    }
    useType(options.byType, type.id);
    callback(type, placement, {
      loc: `${found.level.name} – ${element.toLowerCase()} ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: found.index,
      el: element,
      pid: placement.id,
      tid: type.id,
    });
  }
}

/** Ports the prototype's computeMEP function, including its module gate. */
export function computeMEP(options: Phase2ComputeOptions): void {
  if (!options.kinds.includes("elec")) return;
  const { project } = options;
  eachMEP(
    options,
    project.types.elec,
    project.pl.elec,
    "Electrical points",
    "Electrical",
    (type, placement, context) =>
      options.add(context, `EL_${sanitizeMark(type.mark)}`, n(placement.no), null, null, null),
  );
  eachMEP(
    options,
    project.types.elecgear,
    project.pl.elecgear,
    "Electrical distribution",
    "Electrical",
    (type, placement, context) =>
      options.add(context, `EG_${sanitizeMark(type.mark)}`, 1, n(placement.qty), null, null),
  );
  eachMEP(
    options,
    project.types.sanit,
    project.pl.sanit,
    "Sanitary fittings",
    "Plumbing",
    (type, placement, context) => {
      const count = n(placement.no);
      options.add(context, `SF_${sanitizeMark(type.mark)}`, count, null, null, null);
      if (type.cold && n(type.srun)) {
        options.add(context, `PPRC${type.sdia}`, count, n(type.srun), null, null);
      }
      if (type.hot && n(type.srun)) {
        options.add(context, `PPRH${type.sdia}`, count, n(type.srun), null, null);
      }
      if (n(type.wrun)) {
        options.add(context, `WST${type.wdia}`, count, n(type.wrun), null, null);
      }
    },
  );
  eachMEP(
    options,
    project.types.plumb,
    project.pl.plumb,
    "Plumbing pipework & plant",
    "Plumbing",
    (type, placement, context) =>
      options.add(context, `PL_${sanitizeMark(type.mark)}`, 1, n(placement.qty), null, null),
  );
}

function identified<T extends object>(
  id: Phase2IdFactory,
  value: T,
): T & { id: string } {
  return { id: id(), ...value };
}

/** Creates the exact finish/masonry seed data used by finDefaultsEnsure. */
export function createFinishesDefaults(
  levels: readonly Level[],
  id: Phase2IdFactory,
): FinishesDefaults {
  const masonry: MasonryType[] = [
    identified(id, { mark: "MW1", mat: "Hollow concrete block", t: 200, uL: 400, uH: 200, joint: 10, mortar: "1:4", bfc: 3, dpc: true, lh: 200, bear: 0.15, lbar: 12, llk: 8 }),
    identified(id, { mark: "MW2", mat: "Hollow concrete block", t: 150, uL: 400, uH: 200, joint: 10, mortar: "1:4", bfc: 3, dpc: true, lh: 200, bear: 0.15, lbar: 12, llk: 8 }),
    identified(id, { mark: "MW3", mat: "Solid concrete block", t: 100, uL: 400, uH: 200, joint: 10, mortar: "1:4", bfc: 4, dpc: true, lh: 150, bear: 0.15, lbar: 10, llk: 8 }),
    identified(id, { mark: "MW4", mat: "Burnt clay brick", t: 230, uL: 230, uH: 75, joint: 10, mortar: "1:4", bfc: 4, dpc: true, lh: 225, bear: 0.2, lbar: 12, llk: 8 }),
  ];
  const wfin: WallFinishType[] = [
    identified(id, { mark: "WF1", side: "Internal", base: "Cement-sand plaster", bt: 15, fin: "Emulsion paint", coats: 3, tile: "" }),
    identified(id, { mark: "WF2", side: "External", base: "Cement-sand render", bt: 20, fin: "Weatherproof paint", coats: 3, tile: "" }),
    identified(id, { mark: "WF3", side: "Internal", base: "Cement-sand plaster", bt: 12, fin: "Ceramic wall tiles", coats: 0, tile: "300 × 600 mm" }),
    identified(id, { mark: "WF4", side: "External", base: "Cement-sand render", bt: 15, fin: "Stone cladding", coats: 0, tile: "600 × 300 mm" }),
  ];
  const ffin: FloorFinishType[] = [
    identified(id, { mark: "FF1", screed: 40, fin: "Porcelain tiles", tile: "600 × 600 mm", skm: "Matching tile", skh: 100 }),
    identified(id, { mark: "FF2", screed: 50, fin: "Ceramic tiles", tile: "300 × 300 mm anti-slip", skm: "Matching tile", skh: 100 }),
    identified(id, { mark: "FF3", screed: 0, fin: "Power-floated concrete", tile: "", skm: "None", skh: 0 }),
    identified(id, { mark: "FF4", screed: 40, fin: "Vinyl sheet", tile: "2.0 mm", skm: "PVC", skh: 100 }),
  ];
  const cfin: CeilingFinishType[] = [
    identified(id, { mark: "CF1", kind: "Gypsum board suspended ceiling", bt: 0, coats: 2, drop: 300 }),
    identified(id, { mark: "CF2", kind: "Plaster and paint to soffit", bt: 12, coats: 3, drop: 0 }),
    identified(id, { mark: "CF3", kind: "Mineral fibre tile suspended ceiling", bt: 0, coats: 0, drop: 400 }),
  ];
  const placements: FinishesDefaults["placements"] = {
    masonry: [],
    wfin: [],
    ffin: [],
  };
  for (const level of levels) {
    placements.masonry.push(
      { id: id(), level: level.id, type: masonry[0]!.id, pos: "External", len: 94, h: "", op: 48, opn: 24, opw: 1.5, f1: wfin[0]!.id, f2: wfin[1]!.id, ref: "Perimeter walls" },
      { id: id(), level: level.id, type: masonry[1]!.id, pos: "Internal", len: 60, h: "", op: 8, opn: 8, opw: 0.9, f1: wfin[0]!.id, f2: wfin[0]!.id, ref: "Office and corridor partitions" },
      { id: id(), level: level.id, type: masonry[2]!.id, pos: "Internal", len: 24, h: "", op: 4, opn: 6, opw: 0.8, f1: wfin[2]!.id, f2: wfin[0]!.id, ref: "Toilet partitions" },
    );
    placements.wfin.push(
      { id: id(), level: level.id, type: wfin[0]!.id, area: 180, ref: "Concrete columns and core walls, internal faces" },
      { id: id(), level: level.id, type: wfin[1]!.id, area: 140, ref: "Exposed beams and slab edges, external" },
    );
    placements.ffin.push(
      { id: id(), level: level.id, room: "Offices", type: ffin[0]!.id, cf: cfin[0]!.id, area: 380, perim: 160, doors: 12, no: 1, ref: "" },
      { id: id(), level: level.id, room: "Corridors and lobby", type: ffin[0]!.id, cf: cfin[1]!.id, area: 90, perim: 110, doors: 14, no: 1, ref: "" },
      { id: id(), level: level.id, room: "Toilets", type: ffin[1]!.id, cf: cfin[2]!.id, area: 36, perim: 60, doors: 6, no: 1, ref: "Wet areas" },
      { id: id(), level: level.id, room: "Plant room and stores", type: ffin[2]!.id, cf: cfin[1]!.id, area: 14, perim: 16, doors: 2, no: 1, ref: "" },
    );
  }
  const ground = levels[0];
  if (ground) {
    placements.masonry.push({
      id: id(), level: ground.id, type: masonry[3]!.id, pos: "External",
      len: 30, h: 1.2, op: 0, opn: 0, opw: 0,
      f1: wfin[1]!.id, f2: wfin[3]!.id, ref: "Brick plinth to entrance terrace",
    });
  }
  return { types: { masonry, wfin, ffin, cfin }, placements };
}

/** Creates the exact electrical/plumbing seed data used by mepDefaultsEnsure. */
export function createMEPDefaults(
  levels: readonly Level[],
  id: Phase2IdFactory,
): MEPDefaults {
  const elec: ElectricalPointType[] = [
    identified(id, { mark: "LP1", cat: "Lighting point – LED panel", desc: "600 × 600 mm recessed, 40 W", cable: "1.5 mm² twin & earth", conduit: "20 mm PVC conduit", run: 8 }),
    identified(id, { mark: "DL1", cat: "Lighting point – downlight", desc: "Recessed LED, 18 W", cable: "1.5 mm² twin & earth", conduit: "20 mm PVC conduit", run: 6 }),
    identified(id, { mark: "BT1", cat: "Lighting point – batten", desc: "1200 mm LED batten", cable: "1.5 mm² twin & earth", conduit: "Surface trunking", run: 6 }),
    identified(id, { mark: "EX1", cat: "Lighting point – exterior", desc: "Wall bulkhead IP65", cable: "1.5 mm² twin & earth", conduit: "20 mm PVC conduit", run: 10 }),
    identified(id, { mark: "EM1", cat: "Emergency light", desc: "Maintained, 3 h", cable: "1.5 mm² twin & earth", conduit: "20 mm PVC conduit", run: 8 }),
    identified(id, { mark: "SW1", cat: "Switch – one gang", desc: "", cable: "1.5 mm² twin & earth", conduit: "20 mm PVC conduit", run: 4 }),
    identified(id, { mark: "SW2", cat: "Switch – two gang", desc: "", cable: "1.5 mm² twin & earth", conduit: "20 mm PVC conduit", run: 4 }),
    identified(id, { mark: "SO1", cat: "Socket outlet – twin 13 A", desc: "Ring circuit", cable: "2.5 mm² twin & earth", conduit: "20 mm PVC conduit", run: 7 }),
    identified(id, { mark: "PW1", cat: "Power outlet – 20 A (AC or cooker)", desc: "Radial to split AC unit", cable: "4 mm² twin & earth", conduit: "25 mm PVC conduit", run: 12 }),
    identified(id, { mark: "DA1", cat: "Data outlet Cat6", desc: "Single RJ45", cable: "Cat6 data", conduit: "20 mm PVC conduit", run: 25 }),
    identified(id, { mark: "SD1", cat: "Smoke detector", desc: "Optical, addressable", cable: "Fire-resistant 1.5 mm²", conduit: "20 mm PVC conduit", run: 10 }),
    identified(id, { mark: "MCP1", cat: "Manual call point", desc: "", cable: "Fire-resistant 1.5 mm²", conduit: "20 mm PVC conduit", run: 10 }),
  ];
  const elecgear: ElectricalGearType[] = [
    identified(id, { mark: "DB", item: "Distribution board", spec: "TPN 12-way with MCBs and RCD", unit: "No." }),
    identified(id, { mark: "MSB", item: "Main switchboard", spec: "400 A incomer with MCCB outgoings", unit: "item" }),
    identified(id, { mark: "SMC", item: "Sub-main cable", spec: "4-core 16 mm² armoured, riser to floor boards", unit: "m" }),
    identified(id, { mark: "TRAY", item: "Cable tray", spec: "150 mm perforated, ceiling void", unit: "m" }),
    identified(id, { mark: "EARTH", item: "Earthing system", spec: "Rods, bars and bonding", unit: "item" }),
    identified(id, { mark: "LPS", item: "Lightning protection", spec: "Air terminals, down conductors and earth pits", unit: "item" }),
    identified(id, { mark: "ATS", item: "Changeover switch", spec: "100 A generator changeover", unit: "No." }),
  ];
  const sanit: SanitaryType[] = [
    identified(id, { mark: "WC1", fx: "WC suite", spec: "Close-coupled, vitreous china", cold: true, hot: false, sdia: "20", srun: 3, wdia: "110", wrun: 2 }),
    identified(id, { mark: "WHB1", fx: "Wash hand basin", spec: "Pedestal basin with mixer", cold: true, hot: true, sdia: "20", srun: 3, wdia: "40", wrun: 2 }),
    identified(id, { mark: "UR1", fx: "Urinal", spec: "Wall-hung with sensor flush", cold: true, hot: false, sdia: "20", srun: 3, wdia: "50", wrun: 2 }),
    identified(id, { mark: "SH1", fx: "Shower", spec: "Tray with thermostatic mixer", cold: true, hot: true, sdia: "20", srun: 4, wdia: "50", wrun: 2.5 }),
    identified(id, { mark: "KS1", fx: "Kitchen sink", spec: "Single bowl stainless steel with mixer", cold: true, hot: true, sdia: "20", srun: 4, wdia: "40", wrun: 3 }),
    identified(id, { mark: "FD1", fx: "Floor drain", spec: "100 mm with stainless grating", cold: false, hot: false, sdia: "20", srun: 0, wdia: "50", wrun: 2 }),
  ];
  const plumb: PlumbingType[] = [
    identified(id, { mark: "CWR", item: "Cold water riser", size: "PPR 50 mm", unit: "m" }),
    identified(id, { mark: "HWR", item: "Hot water riser", size: "PPR 32 mm", unit: "m" }),
    identified(id, { mark: "SVP", item: "Soil and vent stack", size: "uPVC 110 mm", unit: "m" }),
    identified(id, { mark: "RWP", item: "Rainwater downpipe", size: "uPVC 100 mm", unit: "m" }),
    identified(id, { mark: "UGD", item: "Underground drain pipe", size: "uPVC 150 mm", unit: "m" }),
    identified(id, { mark: "TANK", item: "Water storage tank", size: "5,000 l", unit: "No." }),
    identified(id, { mark: "PUMP", item: "Booster pump set", size: "3 m³/h at 4 bar", unit: "No." }),
    identified(id, { mark: "WH", item: "Water heater", size: "100 l electric", unit: "No." }),
    identified(id, { mark: "IC", item: "Inspection chamber", size: "600 × 900 mm", unit: "No." }),
    identified(id, { mark: "FHR", item: "Fire hose reel", size: "30 m, 19 mm hose", unit: "No." }),
    identified(id, { mark: "GV", item: "Gate valve", size: "50 mm", unit: "No." }),
  ];
  const placements: MEPDefaults["placements"] = {
    elec: [], elecgear: [], sanit: [], plumb: [],
  };
  levels.forEach((level, index) => {
    const top = index === levels.length - 1;
    const ground = index === 0;
    const height = Math.round(n(level.h) * 10) / 10;
    const ep = (type: ElectricalPointType, no: number, ref: string): void => {
      placements.elec.push({ id: id(), level: level.id, type: type.id, no, ref });
    };
    [[0, 40, "Offices"], [1, 30, "Corridors, lobby and toilets"], [2, 6, "Plant room and stores"], [4, 10, "Escape routes"], [5, 24, "All rooms"], [6, 10, "Offices"], [7, 60, "Offices and corridors"], [8, 12, "Split AC units"], [9, 40, "Workstations"], [10, 20, "All rooms"], [11, 4, "Exits"]].forEach(([i, no, ref]) => ep(elec[i as number]!, no as number, ref as string));
    if (ground) ep(elec[3]!, 8, "Entrance and perimeter");
    const gear = (type: ElectricalGearType, qty: number, ref: string): void => {
      placements.elecgear.push({ id: id(), level: level.id, type: type.id, qty, ref });
    };
    gear(elecgear[0]!, 2, "Floor distribution boards");
    gear(elecgear[2]!, 45, "Riser to floor boards");
    gear(elecgear[3]!, 60, "Ceiling void");
    if (ground) {
      gear(elecgear[1]!, 1, "Main switch room");
      gear(elecgear[4]!, 1, "Building earthing");
      gear(elecgear[6]!, 1, "Generator changeover");
    }
    if (top) gear(elecgear[5]!, 1, "Roof");
    const fixture = (type: SanitaryType, no: number, ref: string): void => {
      placements.sanit.push({ id: id(), level: level.id, type: type.id, no, ref });
    };
    [[0, 6, "Toilets"], [1, 6, "Toilets"], [2, 3, "Male toilets"], [3, 1, "Accessible shower"], [4, 1, "Tea point"], [5, 4, "Toilets"]].forEach(([i, no, ref]) => fixture(sanit[i as number]!, no as number, ref as string));
    const pipe = (type: PlumbingType, qty: number, ref: string): void => {
      placements.plumb.push({ id: id(), level: level.id, type: type.id, qty, ref });
    };
    pipe(plumb[0]!, height, "Main riser");
    pipe(plumb[1]!, height, "Hot water riser");
    pipe(plumb[2]!, Math.round(height * 2 * 10) / 10, "Two stacks");
    pipe(plumb[3]!, Math.round(height * 4 * 10) / 10, "Four downpipes");
    pipe(plumb[9]!, 2, "Stair lobbies");
    pipe(plumb[7]!, 1, "Tea point");
    if (ground) {
      pipe(plumb[4]!, 120, "Site drainage to sewer");
      pipe(plumb[8]!, 8, "Drainage runs");
      pipe(plumb[5]!, 4, "Tank stand");
      pipe(plumb[6]!, 1, "Pump room");
      pipe(plumb[10]!, 6, "Mains and tank outlets");
    }
  });
  return { types: { elec, elecgear, sanit, plumb }, placements };
}
