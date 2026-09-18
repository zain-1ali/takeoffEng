import { n } from "../expression.js";
import { band, ceilSafe, kgPerM } from "../helpers.js";
import type {
  Bar,
  BeamType,
  MeasuredItem,
  NumericInput,
  PlacementStats,
  TypeStats,
} from "../types.js";
import type {
  BridgeBeamPart,
  BridgeSlabPart,
  BridgeWallPart,
  CivilComputeOptions,
  CivilComputeResult,
  CivilIdentified,
  CivilKind,
  CivilProject,
  CivilTypes,
} from "./civil-types.js";

export type * from "./civil-types.js";

const CONCRETE_CODES = new Set([
  "CBFT", "CPIER", "CABW", "CWING", "CBALL", "CPARA", "CGIRD",
  "CXHEAD", "CDIAPH", "CDECK", "CAPPR", "CDRN", "CBED", "CHW", "CAPR",
]);

const BRIDGE_WALL_CODES: Record<BridgeWallPart, string> = {
  "Abutment wall": "ABW",
  Wingwall: "WING",
  "Ballast wall": "BALL",
  Parapet: "PARA",
};

const BRIDGE_BEAM_CODES: Record<BridgeBeamPart, string> = {
  Girder: "GIRD",
  Crosshead: "XHEAD",
  Diaphragm: "DIAPH",
};

const BRIDGE_SLAB_CODES: Record<BridgeSlabPart, string> = {
  "Deck slab": "DECK",
  "Approach slab": "APPR",
};

interface MeasureContext {
  loc: string;
  lvl: number;
  el: string;
  pid: string;
  tid: string;
  grp?: string;
  member?: string;
  members?: number;
  markIndex?: number;
}

interface CivilApi {
  project: CivilProject;
  kinds: ReadonlySet<CivilKind>;
  items: MeasuredItem[];
  bars: Bar[];
  warn: string[];
  byPlacement: Record<string, PlacementStats>;
  byType: Record<string, TypeStats>;
  add: (
    context: MeasureContext,
    code: string,
    times: number,
    d1: number | null,
    d2: number | null,
    d3: number | null,
  ) => void;
  bar: (
    context: MeasureContext,
    shape: string,
    diameter: NumericInput,
    each: number,
    length: number,
  ) => void;
  resolve: <T extends CivilIdentified>(
    rows: readonly T[],
    typeId: string,
    label: string,
    usage?: NumericInput,
  ) => T | undefined;
  barsAcross: (width: number, spacing: NumericInput) => number;
  stock: (length: number, diameter: NumericInput) => number;
  links: (
    length: number,
    spacing: NumericInput,
    endSpacing: NumericInput,
    endZone: NumericInput,
  ) => number;
  checkSpacing: (label: string, ...values: NumericInput[]) => void;
  beamBars: (context: MeasureContext, type: BeamType, span: number) => void;
}

function visibleKinds(project: CivilProject): readonly CivilKind[] {
  return project.btype === "road"
    ? ["rpave", "rdrain", "rculv"]
    : ["bfoot", "bpier", "bwall", "bbeam", "bslab"];
}

function createApi(
  project: CivilProject,
  options: CivilComputeOptions,
): CivilApi {
  const items: MeasuredItem[] = [];
  const bars: Bar[] = [];
  const warn: string[] = [];
  const byPlacement: Record<string, PlacementStats> = {};
  const byType: Record<string, TypeStats> = {};

  const stat = (
    placementId: string,
    typeId: string,
    key: "conc" | "kg",
    value: number,
  ): void => {
    const placement = (byPlacement[placementId] ??= { conc: 0, kg: 0 });
    placement[key] += value;
    const type = (byType[typeId] ??= { conc: 0, kg: 0, uses: 0 });
    type[key] += value;
  };

  const add: CivilApi["add"] = (context, code, times, d1, d2, d3): void => {
    if (!Number.isFinite(times) || times === 0) return;
    const quantity = times * (d1 ?? 1) * (d2 ?? 1) * (d3 ?? 1);
    if (!Number.isFinite(quantity) || Math.abs(quantity) < 1e-9) return;
    items.push({
      loc: context.loc,
      lvl: context.lvl,
      el: context.el,
      tid: context.tid,
      code,
      times,
      d1,
      d2,
      d3,
      q: quantity,
    });
    if (CONCRETE_CODES.has(code)) {
      stat(context.pid, context.tid, "conc", quantity);
    }
  };

  const bar: CivilApi["bar"] = (
    context,
    shape,
    diameterInput,
    each,
    length,
  ): void => {
    const diameter = n(diameterInput);
    const members = context.members ?? 0;
    if (!diameter || !(each > 0) || !(length > 0) || !(members > 0)) return;
    context.markIndex = (context.markIndex ?? 0) + 1;
    const kg = members * each * length * kgPerM(diameter);
    const member = context.member ?? "";
    bars.push({
      loc: context.loc,
      lvl: context.lvl,
      el: context.el,
      member,
      mark: `${member}-${String(context.markIndex).padStart(2, "0")}`,
      shape,
      dia: diameter,
      members,
      each,
      len: length,
      total: members * each * length,
      kg,
    });
    add(context, `R${context.grp ?? ""}${diameter}`, members, length, each, kgPerM(diameter));
    stat(context.pid, context.tid, "kg", kg);
  };

  const barsAcross = (width: number, spacing: NumericInput): number => {
    const spacingM = n(spacing) / 1_000;
    return spacingM > 0 && width > 0 ? ceilSafe(width / spacingM) + 1 : 0;
  };

  const stock = (length: number, diameter: NumericInput): number => {
    const stockLength = n(project.rules.stock);
    if (!stockLength || length <= stockLength) return length;
    return length
      + (ceilSafe(length / stockLength) - 1)
      * n(project.rules.lap)
      * n(diameter)
      / 1_000;
  };

  const links: CivilApi["links"] = (
    length,
    spacingInput,
    endSpacingInput,
    endZoneInput,
  ): number => {
    const spacing = n(spacingInput) / 1_000;
    const endSpacing = n(endSpacingInput) / 1_000;
    const endZone = n(endZoneInput);
    if (!(spacing > 0) || !(length > 0)) return 0;
    if (endSpacing > 0 && endZone > 0 && length > 2 * endZone) {
      return 2 * ceilSafe(endZone / endSpacing)
        + ceilSafe((length - 2 * endZone) / spacing)
        + 1;
    }
    return ceilSafe(length / spacing) + 1;
  };

  const resolve: CivilApi["resolve"] = <T extends CivilIdentified>(
    rows: readonly T[],
    typeId: string,
    label: string,
    usage: NumericInput = 1,
  ): T | undefined => {
    const type = rows.find((candidate) => candidate.id === typeId);
    if (!type) {
      warn.push(`${label}: a row refers to a type that no longer exists.`);
      return undefined;
    }
    const stats = (byType[type.id] ??= { conc: 0, kg: 0, uses: 0 });
    stats.uses += n(usage) || 1;
    return type;
  };

  const checkSpacing = (label: string, ...values: NumericInput[]): void => {
    for (const value of values) {
      const spacing = n(value);
      if (spacing && (spacing < 50 || spacing > 450)) {
        warn.push(`${label}: spacing ${spacing} mm is outside 50–450 mm.`);
      }
    }
  };

  const beamBars: CivilApi["beamBars"] = (context, type, span): void => {
    const cover = n(project.rules.cB) / 1_000;
    const anchorage = n(project.rules.anchB);
    const width = n(type.b) / 1_000;
    const height = n(type.h) / 1_000;
    const mainLength = (diameter: NumericInput): number =>
      stock(span + 2 * anchorage * n(diameter) / 1_000, diameter);
    bar(context, "Straight + anchorage", type.botD, n(type.botN), mainLength(type.botD));
    bar(context, "Straight + anchorage", type.topD, n(type.topN), mainLength(type.topD));
    bar(
      context,
      "Straight + anchorage",
      type.extD,
      2 * n(type.extN),
      n(type.extF) * span + anchorage * n(type.extD) / 1_000,
    );
    bar(context, "Straight + anchorage", type.sideD, n(type.sideN), mainLength(type.sideD));
    bar(
      context,
      "Closed link",
      type.lkd,
      links(span, type.lks, type.lksEnd, type.ez),
      2 * ((width - 2 * cover) + (height - 2 * cover))
        + n(project.rules.hook) * n(type.lkd) / 1_000,
    );
    if (width - 2 * cover <= 0 || height - 2 * cover <= 0) {
      warn.push(`${type.mark}: section too small for cover.`);
    }
    checkSpacing(type.mark, type.lks);
  };

  return {
    project,
    kinds: new Set(options.kinds ?? visibleKinds(project)),
    items,
    bars,
    warn,
    byPlacement,
    byType,
    add,
    bar,
    resolve,
    barsAcross,
    stock,
    links,
    checkSpacing,
    beamBars,
  };
}

function chainage(value: NumericInput): string {
  const parsed = n(value);
  return `${Math.floor(parsed / 1_000)}+${String(Math.round(parsed % 1_000)).padStart(3, "0")}`;
}

function measureRoadPavement(api: CivilApi): void {
  if (!api.kinds.has("rpave")) return;
  let cut = 0;
  let fill = 0;
  let totalLength = 0;
  for (const placement of api.project.pl.rpave) {
    const type = api.resolve(
      api.project.types.rpave,
      placement.type,
      "Road sections",
    );
    if (!type) continue;
    const length = Math.abs(n(placement.to) - n(placement.from));
    const carriageway = n(type.cw);
    const shoulder = n(type.sw);
    const formationWidth = carriageway + 2 * shoulder;
    const cutDepth = n(placement.cut);
    const fillHeight = n(placement.fill);
    totalLength += length;
    if (!length) {
      api.warn.push(`Road row ${chainage(placement.from)}: from and to chainages are the same.`);
    }
    const context: MeasureContext = {
      loc: `Ch ${chainage(placement.from)} – ${chainage(placement.to)} · ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: "Earthworks",
      pid: placement.id,
      tid: type.id,
    };
    const topWidth = formationWidth
      + 2 * n(type.cs) * cutDepth
      + 2 * n(type.fs) * fillHeight;
    api.add(context, "CLR", 1, length, n(type.reserve), null);
    api.add(context, "TOPR", 1, length, topWidth, n(type.top) / 1_000);
    if (cutDepth > 0) {
      const area = cutDepth * (formationWidth + n(type.cs) * cutDepth);
      api.add(context, "RCUT", 1, length, area, null);
      cut += length * area;
    }
    if (fillHeight > 0) {
      const area = fillHeight * (formationWidth + n(type.fs) * fillHeight);
      api.add(context, "RFILL", 1, length, area, null);
      fill += length * area;
    }
    api.add(context, "SGC", 1, length, formationWidth, null);
    const pavement = { ...context, el: "Pavement" };
    if (n(type.cap)) {
      api.add(pavement, `CAP${String(type.cap)}`, 1, length, formationWidth, n(type.cap) / 1_000);
    }
    if (n(type.subb)) {
      api.add(pavement, `SUBB${String(type.subb)}`, 1, length, formationWidth, n(type.subb) / 1_000);
    }
    if (n(type.base)) {
      api.add(pavement, `BASE${String(type.base)}`, 1, length, formationWidth, n(type.base) / 1_000);
    }
    if (n(type.base) && (n(type.acw) || n(type.acb))) {
      api.add(pavement, "PRIME", 1, length, carriageway, null);
    }
    if (n(type.acb)) {
      api.add(pavement, `ACB${String(type.acb)}`, 1, length, carriageway, null);
      if (n(type.acw)) api.add(pavement, "TACK", 1, length, carriageway, null);
    }
    if (n(type.acw)) {
      api.add(pavement, `ACW${String(type.acw)}`, 1, length, carriageway, null);
    }
    if (type.sds && shoulder) {
      api.add(pavement, "SDS", 2, length, shoulder, null);
    }
  }
  const balance: MeasureContext = {
    loc: "Road earthworks balance",
    lvl: -1,
    el: "Earthworks",
    pid: "rbal",
    tid: "rbal",
  };
  api.add(balance, "RCUTFILL", 1, Math.min(cut, fill), null, null);
  api.add(balance, "RBORROW", 1, Math.max(0, fill - cut), null, null);
  api.add(balance, "RSPOIL", 1, Math.max(0, cut - fill), null, null);
  const furniture: MeasureContext = {
    loc: "Road furniture and markings",
    lvl: -1,
    el: "Furniture",
    pid: "rfurn",
    tid: "rfurn",
  };
  const road = api.project.road;
  api.add(furniture, "KERB", 1, n(road.kerb), null, null);
  api.add(furniture, "RMARK", n(road.lines), totalLength, null, null);
  api.add(furniture, "RSIGN", 1, n(road.signs), null, null);
  api.add(furniture, "GRAIL", 1, n(road.grail), null, null);
  api.add(furniture, "RSTUD", 1, n(road.studs), null, null);
  api.add(furniture, "KMP", 1, n(road.kmp), null, null);
}

function measureRoadDrains(api: CivilApi): void {
  if (!api.kinds.has("rdrain")) return;
  for (const placement of api.project.pl.rdrain) {
    const type = api.resolve(
      api.project.types.rdrain,
      placement.type,
      "Side drains",
    );
    if (!type) continue;
    const length = n(placement.len) * (n(placement.sides) || 1);
    const width = n(type.b);
    const depth = n(type.d);
    const slope = n(type.s);
    const lining = n(type.t) / 1_000;
    const context: MeasureContext = {
      loc: `Side drains ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: "Drainage",
      pid: placement.id,
      tid: type.id,
    };
    const area = depth * (width + slope * depth);
    api.add(context, "EXCD", 1, length, area, null);
    api.add(context, "DSP", 1, length, area, null);
    if (type.lined && lining) {
      const perimeter = width + 2 * Math.sqrt(depth * depth + (slope * depth) ** 2);
      api.add(context, "CDRN", 1, length, perimeter, lining);
      if (type.mesh) api.add(context, "MESHD", 1, length, perimeter, null);
    }
  }
}

function measureRoadCulverts(api: CivilApi): void {
  if (!api.kinds.has("rculv")) return;
  const workingSpace = api.project.rules.wsOn ? n(api.project.rules.ws) : 0;
  for (const placement of api.project.pl.rculv) {
    const type = api.resolve(
      api.project.types.rculv,
      placement.type,
      "Culverts",
      placement.no,
    );
    if (!type) continue;
    const count = n(placement.no);
    const length = n(placement.len);
    const lines = n(placement.lines) || 1;
    const diameter = n(type.dia) / 1_000;
    const depth = n(placement.depth);
    const bedWidth = lines * (diameter + 0.3) + 0.3;
    const trenchWidth = bedWidth + 2 * workingSpace;
    const bedding = n(type.bed) / 1_000;
    const context: MeasureContext = {
      loc: `Culverts ${type.mark}, ${lines} × ${String(type.dia)} mm${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: "Culverts",
      pid: placement.id,
      tid: type.id,
      grp: "CULV",
      member: type.mark,
      members: 2 * count,
    };
    api.add(context, `EXCC${band(depth)}`, count, length, trenchWidth, depth);
    api.add(context, "CBED", count, length, bedWidth, bedding);
    api.add(context, `PIPE${String(type.dia)}`, count * lines, length, null, null);
    const displacement = length * bedWidth * bedding
      + lines * length * Math.PI * (diameter + 0.1) ** 2 / 4;
    api.add(context, "BFL", count, length * trenchWidth * depth - displacement, null, null);
    api.add(context, "DSP", count, displacement, null, null);
    const headwallWidth = n(type.hwW);
    const headwallHeight = n(type.hwH);
    const headwallThickness = n(type.hwT) / 1_000;
    const cover = n(api.project.rules.cW) / 1_000;
    api.add(context, "CHW", 2 * count, headwallWidth, headwallHeight, headwallThickness);
    api.add(context, "FHW", 4 * count, headwallWidth, headwallHeight, null);
    api.bar(
      context,
      "Straight + lap",
      type.vd,
      2 * api.barsAcross(headwallWidth - 2 * cover, type.vs),
      headwallHeight + n(api.project.rules.lap) * n(type.vd) / 1_000,
    );
    api.bar(
      context,
      "Straight + anchorage",
      type.hd,
      2 * api.barsAcross(headwallHeight - 2 * cover, type.hs),
      headwallWidth - 2 * cover
        + 2 * n(api.project.rules.anchS) * n(type.hd) / 1_000,
    );
    api.add(context, "CAPR", 2 * count, n(type.apL), n(type.apW), n(type.apT) / 1_000);
    api.add(context, "MESHD", 2 * count, n(type.apL), n(type.apW), null);
  }
}

function measureBridgeFootings(api: CivilApi): void {
  if (!api.kinds.has("bfoot")) return;
  const rules = api.project.rules;
  const workingSpace = rules.wsOn ? n(rules.ws) : 0;
  const blinding = n(rules.blinding) / 1_000;
  for (const placement of api.project.pl.bfoot) {
    const type = api.resolve(
      api.project.types.bfoot,
      placement.type,
      "Bridge footings",
      placement.no,
    );
    if (!type) continue;
    const count = n(placement.no);
    const length = n(type.L);
    const width = n(type.W);
    const footingDepth = n(type.D);
    const formationDepth = n(type.depth);
    const excavationLength = length + 2 * workingSpace;
    const excavationWidth = width + 2 * workingSpace;
    const context: MeasureContext = {
      loc: `${placement.part || "Bridge"} footings – ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: "Foundations",
      pid: placement.id,
      tid: type.id,
      grp: "BFND",
      member: type.mark,
      members: count,
    };
    api.add(context, `EXCB${band(formationDepth)}`, count, excavationLength, excavationWidth, formationDepth);
    if (rules.supOn) {
      api.add(context, `SUP${band(formationDepth)}`, count, 2 * (excavationLength + excavationWidth), null, formationDepth);
    }
    api.add(context, "LVL", count, excavationLength, excavationWidth, null);
    api.add(context, "BLD", count, length, width, blinding);
    api.add(context, "CBFT", count, length, width, footingDepth);
    api.add(context, "FBFT", count, 2 * (length + width), null, footingDepth);
    const displacement = length * width * (blinding + footingDepth);
    api.add(context, "BFL", count, excavationLength * excavationWidth * formationDepth - displacement, null, null);
    api.add(context, "DSP", count, displacement, null, null);
    const cover = n(rules.cF) / 1_000;
    const anchorage = n(rules.anchF);
    const xCount = api.barsAcross(width - 2 * cover, type.bxs);
    const yCount = api.barsAcross(length - 2 * cover, type.bys);
    const xLength = length - 2 * cover + 2 * anchorage * n(type.bxd) / 1_000;
    const yLength = width - 2 * cover + 2 * anchorage * n(type.byd) / 1_000;
    api.bar(context, "Bent both ends", type.bxd, xCount, xLength);
    api.bar(context, "Bent both ends", type.byd, yCount, yLength);
    if (type.top) {
      api.bar(context, "Bent both ends (top)", type.bxd, xCount, xLength);
      api.bar(context, "Bent both ends (top)", type.byd, yCount, yLength);
    }
    api.bar(context, "L-bar starter", type.std, n(type.stn), n(type.stl));
    api.checkSpacing(type.mark, type.bxs, type.bys);
  }
}

function measureBridgePiers(api: CivilApi): void {
  if (!api.kinds.has("bpier")) return;
  for (const placement of api.project.pl.bpier) {
    const type = api.resolve(
      api.project.types.bpier,
      placement.type,
      "Pier columns",
      placement.no,
    );
    if (!type) continue;
    const count = n(placement.no);
    const width = n(type.b) / 1_000;
    const depth = n(type.d) / 1_000;
    const height = n(placement.h);
    const cover = n(api.project.rules.cC) / 1_000;
    const context: MeasureContext = {
      loc: `Pier columns ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: "Piers",
      pid: placement.id,
      tid: type.id,
      grp: "PIER",
      member: type.mark,
      members: count,
    };
    api.add(context, "CPIER", count, width, depth, height);
    api.add(context, "FPIER", count, 2 * (width + depth), null, height);
    api.bar(
      context,
      "Straight + lap",
      type.dia,
      n(type.nb),
      api.stock(height + n(api.project.rules.lap) * n(type.dia) / 1_000, type.dia),
    );
    api.bar(
      context,
      "Closed link",
      type.lkd,
      api.links(height, type.lks, type.lksEnd, type.ez),
      2 * ((width - 2 * cover) + (depth - 2 * cover))
        + n(api.project.rules.hook) * n(type.lkd) / 1_000,
    );
    api.checkSpacing(type.mark, type.lks);
  }
}

function measureBridgeWalls(api: CivilApi): void {
  if (!api.kinds.has("bwall")) return;
  for (const placement of api.project.pl.bwall) {
    const type = api.resolve(
      api.project.types.bwall,
      placement.type,
      "Abutments & walls",
      placement.no,
    );
    if (!type) continue;
    const count = n(placement.no) || 1;
    const length = n(placement.len);
    const height = n(placement.h);
    const thickness = n(type.t) / 1_000;
    const faces = n(type.faces) || 2;
    const cover = n(api.project.rules.cW) / 1_000;
    const partCode = BRIDGE_WALL_CODES[placement.part] ?? "ABW";
    const parapet = partCode === "PARA";
    const context: MeasureContext = {
      loc: `${placement.part || "Wall"} ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: parapet ? "Parapets" : "Abutments & walls",
      pid: placement.id,
      tid: type.id,
      grp: parapet ? "PARA" : "ABUT",
      member: type.mark,
      members: count,
    };
    api.add(context, `C${partCode}`, count, length, height, thickness);
    api.add(context, `F${partCode}`, count * 2, length, height, null);
    api.bar(
      context,
      "Straight + lap",
      type.vd,
      faces * api.barsAcross(length - 2 * cover, type.vs),
      height + n(api.project.rules.lap) * n(type.vd) / 1_000,
    );
    api.bar(
      context,
      "Straight + anchorage",
      type.hd,
      faces * api.barsAcross(height - 2 * cover, type.hs),
      api.stock(
        length + 2 * n(api.project.rules.anchS) * n(type.hd) / 1_000,
        type.hd,
      ),
    );
    api.checkSpacing(type.mark, type.vs, type.hs);
  }
}

function measureBridgeBeams(api: CivilApi): void {
  if (!api.kinds.has("bbeam")) return;
  for (const placement of api.project.pl.bbeam) {
    const type = api.resolve(
      api.project.types.bbeam,
      placement.type,
      "Girders & crossheads",
      placement.no,
    );
    if (!type) continue;
    const count = n(placement.no);
    const span = n(placement.span);
    const width = n(type.b) / 1_000;
    const height = n(type.h) / 1_000;
    const partCode = BRIDGE_BEAM_CODES[placement.part] ?? "GIRD";
    const crosshead = partCode === "XHEAD";
    const context: MeasureContext = {
      loc: `${placement.part || "Beam"} ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: crosshead ? "Piers" : "Deck",
      pid: placement.id,
      tid: type.id,
      grp: crosshead ? "PIER" : "DECK",
      member: type.mark,
      members: count,
    };
    api.add(context, `C${partCode}`, count, span, width, height);
    api.add(context, `F${partCode}`, count, span, width, null);
    api.add(context, `F${partCode}`, count * 2, span, null, height);
    api.beamBars(context, type, span);
  }
}

function measureBridgeSlabs(api: CivilApi): void {
  if (!api.kinds.has("bslab")) return;
  for (const placement of api.project.pl.bslab) {
    const type = api.resolve(
      api.project.types.bslab,
      placement.type,
      "Deck & approach slabs",
      placement.no,
    );
    if (!type) continue;
    const count = n(placement.no);
    const length = n(placement.L);
    const width = n(placement.W);
    const thickness = n(type.t) / 1_000;
    const cover = n(api.project.rules.cS) / 1_000;
    const anchorage = n(api.project.rules.anchS);
    const partCode = BRIDGE_SLAB_CODES[placement.part] ?? "DECK";
    const context: MeasureContext = {
      loc: `${placement.part || "Slab"} ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1,
      el: "Deck",
      pid: placement.id,
      tid: type.id,
      grp: "DECK",
      member: type.mark,
      members: count,
    };
    api.add(context, `C${partCode}`, count, length, width, thickness);
    if (partCode === "DECK") {
      api.add(context, "FDECK", count, length, width, null);
    }
    api.add(context, `F${partCode}E`, count, 2 * (length + width), null, thickness);
    api.bar(
      context,
      "Straight + anchorage",
      type.bxd,
      api.barsAcross(width - 2 * cover, type.bxs),
      api.stock(length + 2 * anchorage * n(type.bxd) / 1_000, type.bxd),
    );
    api.bar(
      context,
      "Straight + anchorage",
      type.byd,
      api.barsAcross(length - 2 * cover, type.bys),
      api.stock(width + 2 * anchorage * n(type.byd) / 1_000, type.byd),
    );
    if (type.topMode === "full") {
      api.bar(
        context,
        "Straight + anchorage (top)",
        type.txd,
        api.barsAcross(width - 2 * cover, type.txs),
        api.stock(length + 2 * anchorage * n(type.txd) / 1_000, type.txd),
      );
      api.bar(
        context,
        "Straight + anchorage (top)",
        type.tyd,
        api.barsAcross(length - 2 * cover, type.tys),
        api.stock(width + 2 * anchorage * n(type.tyd) / 1_000, type.tyd),
      );
    } else if (type.topMode === "supports") {
      api.bar(
        context,
        "Top over supports, bent",
        type.txd,
        2 * api.barsAcross(width - 2 * cover, type.txs),
        0.25 * length + anchorage * n(type.txd) / 1_000,
      );
      api.bar(
        context,
        "Top over supports, bent",
        type.tyd,
        2 * api.barsAcross(length - 2 * cover, type.tys),
        0.25 * width + anchorage * n(type.tyd) / 1_000,
      );
    }
    api.checkSpacing(type.mark, type.bxs, type.bys);
  }
}

function measureBridgeAccessories(api: CivilApi): void {
  if (api.project.btype !== "bridge") return;
  const context: MeasureContext = {
    loc: "Bearings, joints and deck finishes",
    lvl: -1,
    el: "Accessories",
    pid: "bacc",
    tid: "bacc",
  };
  const accessories = api.project.bacc;
  api.add(context, "BRG", 1, n(accessories.bearings), null, null);
  api.add(context, "EJ", 1, n(accessories.joints), null, null);
  api.add(context, "WPF", 1, n(accessories.wp), null, null);
  api.add(context, "SURF", 1, n(accessories.surf), null, null);
  api.add(context, "SPOUT", 1, n(accessories.spouts), null, null);
  api.add(context, "HRAIL", 1, n(accessories.rail), null, null);
  api.add(context, "BFGR", 1, n(accessories.backfill), null, null);
}

/**
 * Computes civil quantities without relying on the building compute closure.
 * The returned fields can be copied directly into a ComputeResult. `floorArea`
 * is zero and `levels` is empty because civil projects have no active levels.
 */
export function computeCivil(
  project: CivilProject,
  options: CivilComputeOptions = {},
): CivilComputeResult {
  const api = createApi(project, options);
  measureRoadPavement(api);
  measureRoadDrains(api);
  measureRoadCulverts(api);
  measureBridgeFootings(api);
  measureBridgePiers(api);
  measureBridgeWalls(api);
  measureBridgeBeams(api);
  measureBridgeSlabs(api);
  measureBridgeAccessories(api);

  const totals: Record<string, number> = {};
  for (const item of api.items) {
    totals[item.code] = (totals[item.code] ?? 0) + item.q;
  }
  const concrete = Object.entries(totals)
    .filter(([code]) => CONCRETE_CODES.has(code))
    .reduce((sum, [, quantity]) => sum + quantity, 0);
  const steelKg = api.bars.reduce((sum, item) => sum + item.kg, 0);
  const formwork = Object.entries(totals)
    .filter(([code]) => /^F(?!STRIS|F_)/.test(code))
    .reduce((sum, [, quantity]) => sum + quantity, 0);
  return {
    items: api.items,
    bars: api.bars,
    warn: api.warn,
    tot: totals,
    concrete,
    steelKg,
    formwork,
    byPlacement: api.byPlacement,
    byType: api.byType,
    floorArea: 0,
    levels: [],
  };
}

const DEFAULT_RULES: CivilProject["rules"] = {
  ws: 0.3,
  wsOn: true,
  supOn: true,
  attOn: true,
  blinding: 50,
  cF: 50,
  cC: 40,
  cB: 30,
  cS: 25,
  cW: 30,
  anchF: 12,
  anchB: 40,
  anchS: 20,
  lap: 50,
  hook: 24,
  stock: 12,
};

const DEFAULT_GRADES: CivilProject["grades"] = {
  blind: "C15",
  found: "C25/30",
  frame: "C30/37",
  civil: "C25/30",
  bridge: "C35/45",
};

function emptyTypes(): CivilTypes {
  return {
    pad: [],
    strip: [],
    gbeam: [],
    column: [],
    beam: [],
    slab: [],
    wall: [],
    stair: [],
    rpave: [],
    rdrain: [],
    rculv: [],
    bfoot: [],
    bpier: [],
    bwall: [],
    bbeam: [],
    bslab: [],
  };
}

const EMPTY_GROUND_SLAB: CivilProject["sog"] = {
  area: 0,
  edge: 0,
  t: 0,
  hardcore: 0,
  sand: 0,
  dpm: false,
  mesh: "A193",
  topsoil: 0,
};

/**
 * Deterministic seed matching the prototype's complete 2.0 km road example.
 */
export function createRoadDefaults(): CivilProject {
  const types = emptyTypes();
  types.rpave = [
    { id: "road-type-rt1", mark: "RT1", cw: 7, sw: 1.5, reserve: 20, acw: 50, acb: 0, dens: 2.35, sds: true, base: 150, subb: 200, cap: 150, cs: 1, fs: 2, top: 150 },
    { id: "road-type-rt2", mark: "RT2", cw: 7, sw: 2, reserve: 20, acw: 50, acb: 60, dens: 2.35, sds: false, base: 200, subb: 200, cap: 300, cs: 1, fs: 2, top: 150 },
  ];
  types.rdrain = [
    { id: "road-drain-dr1", mark: "DR1", b: 0.6, d: 0.6, s: 0.5, lined: true, t: 100, mesh: true },
    { id: "road-drain-dr2", mark: "DR2", b: 0.5, d: 0.5, s: 1, lined: false, t: 0, mesh: false },
  ];
  types.rculv = [
    { id: "road-culvert-cv1", mark: "CV1", dia: 900, bed: 150, hwW: 3.2, hwH: 1.8, hwT: 300, vd: 12, vs: 200, hd: 12, hs: 200, apL: 2, apW: 3.2, apT: 150 },
    { id: "road-culvert-cv2", mark: "CV2", dia: 600, bed: 150, hwW: 2, hwH: 1.4, hwT: 250, vd: 12, vs: 250, hd: 10, hs: 250, apL: 1.5, apW: 2, apT: 150 },
  ];
  return {
    project: {
      name: "2.0 km road",
      currency: "USD",
      numfmt: "en-GB",
    },
    btype: "road",
    levels: [],
    types,
    pl: {
      pad: [],
      strip: [],
      gbeam: [],
      column: [],
      beam: [],
      slab: [],
      wall: [],
      stair: [],
      rpave: [
        { id: "road-section-1", type: "road-type-rt1", from: 0, to: 600, cut: 0.8, fill: 0, ref: "Rural section in cut" },
        { id: "road-section-2", type: "road-type-rt1", from: 600, to: 1_200, cut: 0, fill: 1.2, ref: "Embankment over valley" },
        { id: "road-section-3", type: "road-type-rt2", from: 1_200, to: 2_000, cut: 0.4, fill: 0.3, ref: "Urban section with kerbs" },
      ],
      rdrain: [
        { id: "road-drain-placement-1", type: "road-drain-dr1", len: 800, sides: 2, ref: "Ch 1+200 – 2+000" },
        { id: "road-drain-placement-2", type: "road-drain-dr2", len: 1_200, sides: 2, ref: "Ch 0+000 – 1+200" },
      ],
      rculv: [
        { id: "road-culvert-placement-1", type: "road-culvert-cv1", len: 12, lines: 2, no: 3, depth: 1.8, ref: "Ch 0+350, 0+820, 1+050" },
        { id: "road-culvert-placement-2", type: "road-culvert-cv2", len: 10, lines: 1, no: 5, depth: 1.4, ref: "Minor crossings" },
      ],
      bfoot: [],
      bpier: [],
      bwall: [],
      bbeam: [],
      bslab: [],
    },
    sog: { ...EMPTY_GROUND_SLAB },
    rules: { ...DEFAULT_RULES },
    grades: { ...DEFAULT_GRADES },
    road: { kerb: 1_600, lines: 3, signs: 24, grail: 300, studs: 400, kmp: 3 },
    bacc: { bearings: 0, joints: 0, wp: 0, surf: 0, surfT: 0, spouts: 0, rail: 0, backfill: 0 },
  };
}

/**
 * Deterministic seed matching the prototype's 15 + 20 + 15 m bridge example.
 */
export function createBridgeDefaults(): CivilProject {
  const types = emptyTypes();
  types.bfoot = [
    { id: "bridge-foot-af1", mark: "AF1", L: 11.5, W: 4, D: 1, depth: 2.5, bxd: 20, bxs: 150, byd: 20, bys: 150, top: true, stn: 0, std: 20, stl: 2.5 },
    { id: "bridge-foot-pf1", mark: "PF1", L: 4.5, W: 4.5, D: 1.2, depth: 3, bxd: 25, bxs: 150, byd: 25, bys: 150, top: true, stn: 20, std: 25, stl: 3.2 },
  ];
  types.bpier = [
    { id: "bridge-pier-p1", mark: "P1", b: 900, d: 900, nb: 20, dia: 25, lkd: 12, lks: 200, lksEnd: 100, ez: 1 },
  ];
  types.bwall = [
    { id: "bridge-wall-aw1", mark: "AW1", t: 600, faces: "2", vd: 20, vs: 150, hd: 16, hs: 200 },
    { id: "bridge-wall-ww1", mark: "WW1", t: 400, faces: "2", vd: 16, vs: 200, hd: 12, hs: 200 },
    { id: "bridge-wall-pa1", mark: "PA1", t: 250, faces: "2", vd: 12, vs: 200, hd: 10, hs: 200 },
  ];
  types.bbeam = [
    { id: "bridge-beam-g1", mark: "G1", b: 400, h: 1_200, botN: 8, botD: 25, topN: 4, topD: 16, extN: 0, extD: 16, extF: 0.25, sideN: 6, sideD: 12, lkd: 12, lks: 150, lksEnd: 100, ez: 2 },
    { id: "bridge-beam-xh1", mark: "XH1", b: 1_200, h: 1_200, botN: 8, botD: 25, topN: 8, topD: 25, extN: 4, extD: 25, extF: 0.3, sideN: 6, sideD: 16, lkd: 12, lks: 150, lksEnd: 100, ez: 1.5 },
    { id: "bridge-beam-d1", mark: "D1", b: 300, h: 900, botN: 4, botD: 16, topN: 4, topD: 16, extN: 0, extD: 16, extF: 0.25, sideN: 4, sideD: 12, lkd: 10, lks: 200, lksEnd: 0, ez: 0 },
  ];
  types.bslab = [
    { id: "bridge-slab-ds1", mark: "DS1", t: 220, bxd: 16, bxs: 150, byd: 12, bys: 200, topMode: "full", txd: 12, txs: 200, tyd: 12, tys: 200 },
    { id: "bridge-slab-as1", mark: "AS1", t: 300, bxd: 16, bxs: 200, byd: 16, bys: 200, topMode: "full", txd: 12, txs: 250, tyd: 12, tys: 250 },
  ];
  return {
    project: {
      name: "Three-span concrete bridge",
      currency: "USD",
      numfmt: "en-GB",
    },
    btype: "bridge",
    levels: [],
    types,
    pl: {
      pad: [],
      strip: [],
      gbeam: [],
      column: [],
      beam: [],
      slab: [],
      wall: [],
      stair: [],
      rpave: [],
      rdrain: [],
      rculv: [],
      bfoot: [
        { id: "bridge-foot-placement-1", type: "bridge-foot-af1", part: "Abutment", no: 2, ref: "Abutments A1 and A2" },
        { id: "bridge-foot-placement-2", type: "bridge-foot-pf1", part: "Pier", no: 4, ref: "Piers P1 and P2, two columns each" },
      ],
      bpier: [
        { id: "bridge-pier-placement-1", type: "bridge-pier-p1", h: 6, no: 4, ref: "Piers P1 and P2" },
      ],
      bwall: [
        { id: "bridge-wall-placement-1", type: "bridge-wall-aw1", part: "Abutment wall", len: 10.5, h: 4.5, no: 2, ref: "A1 and A2" },
        { id: "bridge-wall-placement-2", type: "bridge-wall-ww1", part: "Wingwall", len: 4, h: 3.5, no: 4, ref: "All corners" },
        { id: "bridge-wall-placement-3", type: "bridge-wall-pa1", part: "Parapet", len: 50, h: 1, no: 2, ref: "Both edges" },
      ],
      bbeam: [
        { id: "bridge-beam-placement-1", type: "bridge-beam-g1", part: "Girder", span: 15, no: 5, ref: "Span 1" },
        { id: "bridge-beam-placement-2", type: "bridge-beam-g1", part: "Girder", span: 20, no: 5, ref: "Span 2" },
        { id: "bridge-beam-placement-3", type: "bridge-beam-g1", part: "Girder", span: 15, no: 5, ref: "Span 3" },
        { id: "bridge-beam-placement-4", type: "bridge-beam-xh1", part: "Crosshead", span: 9, no: 2, ref: "Piers P1 and P2" },
        { id: "bridge-beam-placement-5", type: "bridge-beam-d1", part: "Diaphragm", span: 8.4, no: 8, ref: "Span ends and midspans" },
      ],
      bslab: [
        { id: "bridge-slab-placement-1", type: "bridge-slab-ds1", part: "Deck slab", L: 50, W: 10.5, no: 1, ref: "Full deck" },
        { id: "bridge-slab-placement-2", type: "bridge-slab-as1", part: "Approach slab", L: 6, W: 10.5, no: 2, ref: "Both approaches" },
      ],
    },
    sog: { ...EMPTY_GROUND_SLAB },
    rules: { ...DEFAULT_RULES },
    grades: { ...DEFAULT_GRADES },
    road: { kerb: 0, lines: 0, signs: 0, grail: 0, studs: 0, kmp: 0 },
    bacc: { bearings: 30, joints: 21, wp: 525, surf: 420, surfT: 50, spouts: 12, rail: 0, backfill: 180 },
  };
}

export const roadDefaults = createRoadDefaults;
export const bridgeDefaults = createBridgeDefaults;
