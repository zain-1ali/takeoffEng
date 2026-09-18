import { n } from "./expression.js";
import { band, ceilSafe, kgPerM, proppingBand } from "./helpers.js";
import type {
  Bar,
  BeamType,
  ComputeResult,
  Identified,
  Level,
  MeasuredItem,
  NumericInput,
  PlacementStats,
  StructuralProject,
  TypeStats,
} from "./types.js";

const CONCRETE_CODES = new Set([
  "CPAD", "CSTUB", "CSTRIP", "CGB", "CSOG", "CCOL", "CBEAM",
  "CSLAB", "CWALL", "CSTAIR",
]);

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

export function activeLevels(project: StructuralProject): Level[] {
  if (project.btype === "multi") return project.levels;
  if (project.btype === "single") return project.levels.slice(0, 1);
  return [];
}

export function compute(project: StructuralProject): ComputeResult {
  const items: MeasuredItem[] = [];
  const bars: Bar[] = [];
  const warnings: string[] = [];
  const byPlacement: Record<string, PlacementStats> = {};
  const byType: Record<string, TypeStats> = {};
  const rules = project.rules;
  const workingSpace = rules.wsOn ? n(rules.ws) : 0;
  const blinding = n(rules.blinding) / 1_000;
  const levels = activeLevels(project);
  const levelIndex = new Map(levels.map((level, index) => [level.id, index]));

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

  const add = (
    context: MeasureContext,
    code: string,
    times: number,
    d1: number | null,
    d2: number | null,
    d3: number | null,
  ): void => {
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

  const bar = (
    context: MeasureContext,
    shape: string,
    diameterInput: NumericInput,
    each: number,
    length: number,
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
    add(
      context,
      `R${context.grp ?? ""}${diameter}`,
      members,
      length,
      each,
      kgPerM(diameter),
    );
    stat(context.pid, context.tid, "kg", kg);
  };

  const barsAcross = (width: number, spacing: NumericInput): number => {
    const spacingM = n(spacing) / 1_000;
    return spacingM > 0 && width > 0 ? ceilSafe(width / spacingM) + 1 : 0;
  };

  const stock = (length: number, diameter: NumericInput): number => {
    const stockLength = n(rules.stock);
    if (!stockLength || length <= stockLength) return length;
    return (
      length +
      (ceilSafe(length / stockLength) - 1) *
        n(rules.lap) *
        n(diameter) /
        1_000
    );
  };

  const links = (
    length: number,
    spacing: NumericInput,
    endSpacing: NumericInput,
    endZoneInput: NumericInput,
  ): number => {
    const spacingM = n(spacing) / 1_000;
    const endSpacingM = n(endSpacing) / 1_000;
    const endZone = n(endZoneInput);
    if (!(spacingM > 0) || !(length > 0)) return 0;
    if (endSpacingM > 0 && endZone > 0 && length > 2 * endZone) {
      return (
        2 * ceilSafe(endZone / endSpacingM) +
        ceilSafe((length - 2 * endZone) / spacingM) +
        1
      );
    }
    return ceilSafe(length / spacingM) + 1;
  };

  const resolve = <T extends Identified>(
    types: readonly T[],
    typeId: string,
    label: string,
    usage: NumericInput = 1,
  ): T | undefined => {
    const type = types.find((candidate) => candidate.id === typeId);
    if (!type) {
      warnings.push(`${label}: a row refers to a type that no longer exists.`);
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
        warnings.push(
          `${label}: spacing ${spacing} mm is outside 50–450 mm.`,
        );
      }
    }
  };

  const beamBars = (
    context: MeasureContext,
    type: BeamType,
    span: number,
  ): void => {
    const cover = n(rules.cB) / 1_000;
    const anchorage = n(rules.anchB);
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
      2 * ((width - 2 * cover) + (height - 2 * cover)) +
        n(rules.hook) * n(type.lkd) / 1_000,
    );
    if (width - 2 * cover <= 0 || height - 2 * cover <= 0) {
      warnings.push(`${type.mark}: section too small for cover.`);
    }
    checkSpacing(type.mark, type.lks);
  };

  // Pad footings
  for (const placement of project.pl.pad) {
    const type = resolve(project.types.pad, placement.type, "Pad footings", placement.no);
    if (!type) continue;
    const count = n(placement.no);
    const length = n(type.L);
    const width = n(type.W);
    const depth = n(type.D);
    const formationDepth = n(type.depth);
    const stubWidth = n(type.sb) / 1_000;
    const stubDepth = n(type.sd) / 1_000;
    const stubHeight = n(type.sh);
    const context: MeasureContext = {
      loc: `Pad footings – ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1, el: "Foundations", pid: placement.id, tid: type.id,
      grp: "FND", member: type.mark, members: count,
    };
    const excavationLength = length + 2 * workingSpace;
    const excavationWidth = width + 2 * workingSpace;
    const depthBand = band(formationDepth);
    const padTop = formationDepth - blinding - depth;
    const stubBelowGround = Math.max(0, Math.min(stubHeight, padTop));
    if (padTop < 0) {
      warnings.push(`${type.mark}: top of footing is above ground – increase depth to formation.`);
    }
    if (stubWidth > length || stubDepth > width) {
      warnings.push(`${type.mark}: stub is larger than its pad footing.`);
    }
    add(context, `EXCP${depthBand}`, count, excavationLength, excavationWidth, formationDepth);
    if (rules.supOn) add(context, `SUP${depthBand}`, count, 2 * (excavationLength + excavationWidth), null, formationDepth);
    add(context, "LVL", count, excavationLength, excavationWidth, null);
    if (rules.attOn) add(context, "ATT", count, excavationLength, excavationWidth, null);
    add(context, "BLD", count, length, width, blinding);
    add(context, "CPAD", count, length, width, depth);
    add(context, "FPAD", count, 2 * (length + width), null, depth);
    add(context, "CSTUB", count, stubWidth, stubDepth, stubHeight);
    add(context, "FSTUB", count, 2 * (stubWidth + stubDepth), null, stubHeight);
    const displaced =
      length * width * (blinding + depth) +
      stubWidth * stubDepth * stubBelowGround;
    add(context, "BFL", count, excavationLength * excavationWidth * formationDepth - displaced, null, null);
    add(context, "DSP", count, displaced, null, null);
    const foundationCover = n(rules.cF) / 1_000;
    const anchorage = n(rules.anchF);
    const columnCover = n(rules.cC) / 1_000;
    const xCount = barsAcross(width - 2 * foundationCover, type.bxs);
    const yCount = barsAcross(length - 2 * foundationCover, type.bys);
    const xLength = length - 2 * foundationCover + 2 * anchorage * n(type.bxd) / 1_000;
    const yLength = width - 2 * foundationCover + 2 * anchorage * n(type.byd) / 1_000;
    bar(context, "Bent both ends", type.bxd, xCount, xLength);
    bar(context, "Bent both ends", type.byd, yCount, yLength);
    if (type.top) {
      bar(context, "Bent both ends (top)", type.bxd, xCount, xLength);
      bar(context, "Bent both ends (top)", type.byd, yCount, yLength);
    }
    bar(context, "L-bar starter", type.std, n(type.stn), n(type.stl));
    if (stubHeight > 0) {
      bar(
        context,
        "Closed link",
        type.lkd,
        ceilSafe(stubHeight / (n(type.lks) / 1_000 || 1e9)) + 1,
        2 * ((stubWidth - 2 * columnCover) + (stubDepth - 2 * columnCover)) +
          n(rules.hook) * n(type.lkd) / 1_000,
      );
    }
    checkSpacing(type.mark, type.bxs, type.bys, type.lks);
  }

  // Strip footings
  for (const placement of project.pl.strip) {
    const type = resolve(project.types.strip, placement.type, "Strip footings", placement.no);
    if (!type) continue;
    const count = n(placement.no) || 1;
    const length = n(placement.len);
    const width = n(type.B);
    const depth = n(type.D);
    const formationDepth = n(type.depth);
    const excavationWidth = width + 2 * workingSpace;
    const depthBand = band(formationDepth);
    const context: MeasureContext = {
      loc: `Strip footings – ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1, el: "Foundations", pid: placement.id, tid: type.id,
      grp: "FND", member: type.mark, members: count,
    };
    add(context, `EXCS${depthBand}`, count, length, excavationWidth, formationDepth);
    if (rules.supOn) add(context, `SUP${depthBand}`, count * 2, length, null, formationDepth);
    add(context, "LVL", count, length, excavationWidth, null);
    if (rules.attOn) add(context, "ATT", count, length, excavationWidth, null);
    add(context, "BLD", count, length, width, blinding);
    add(context, "CSTRIP", count, length, width, depth);
    add(context, "FSTRIP", count * 2, length, null, depth);
    const displaced = length * width * (blinding + depth);
    add(context, "BFL", count, length * excavationWidth * formationDepth - displaced, null, null);
    add(context, "DSP", count, displaced, null, null);
    const cover = n(rules.cF) / 1_000;
    bar(context, "Bent both ends", type.td, barsAcross(length - 2 * cover, type.ts), width - 2 * cover + 2 * n(rules.anchF) * n(type.td) / 1_000);
    bar(context, "Straight (lapped)", type.ld, n(type.ln), stock(length - 2 * cover, type.ld));
    checkSpacing(type.mark, type.ts);
  }

  // Ground beams
  for (const placement of project.pl.gbeam) {
    const type = resolve(project.types.gbeam, placement.type, "Ground beams", placement.no);
    if (!type) continue;
    const count = n(placement.no);
    const span = n(placement.span);
    const width = n(type.b) / 1_000;
    const height = n(type.h) / 1_000;
    const trenchWidth = width + 2 * workingSpace;
    const trenchDepth = height + blinding;
    const depthBand = band(trenchDepth);
    const context: MeasureContext = {
      loc: `Ground beams – ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: -1, el: "Foundations", pid: placement.id, tid: type.id,
      grp: "FND", member: type.mark, members: count,
    };
    add(context, `EXCT${depthBand}`, count, span, trenchWidth, trenchDepth);
    if (rules.supOn) add(context, `SUP${depthBand}`, count * 2, span, null, trenchDepth);
    add(context, "LVL", count, span, trenchWidth, null);
    if (rules.attOn) add(context, "ATT", count, span, trenchWidth, null);
    add(context, "BLD", count, span, width, blinding);
    add(context, "CGB", count, span, width, height);
    add(context, "FGB", count * 2, span, null, height);
    const displaced = span * width * (blinding + height);
    add(context, "BFL", count, span * trenchWidth * trenchDepth - displaced, null, null);
    add(context, "DSP", count, displaced, null, null);
    beamBars(context, type, span);
  }

  // Ground-bearing slab
  const slabArea = n(project.sog.area);
  const slabThickness = n(project.sog.t) / 1_000;
  if (slabArea > 0 && project.btype !== "road" && project.btype !== "bridge") {
    const context: MeasureContext = {
      loc: "Ground-bearing slab", lvl: -1, el: "Foundations",
      pid: "sog", tid: "sog",
    };
    if (n(project.sog.topsoil)) add(context, "TOP", 1, slabArea, null, null);
    add(context, "LVL", 1, slabArea, null, null);
    add(context, "HARD", 1, slabArea, null, n(project.sog.hardcore) / 1_000);
    add(context, "SAND", 1, slabArea, null, null);
    if (rules.attOn) add(context, "ATT", 1, slabArea, null, null);
    if (project.sog.dpm) add(context, "DPM", 1, slabArea, null, null);
    add(context, "CSOG", 1, slabArea, null, slabThickness);
    add(context, "FSOGE", 1, n(project.sog.edge), null, slabThickness);
    add(context, "MESH", 1, slabArea, null, null);
  }

  const getLevel = (id: string): { level: Level; index: number } | undefined => {
    const index = levelIndex.get(id);
    return index === undefined ? undefined : { level: levels[index]!, index };
  };

  // Columns
  for (const placement of project.pl.column) {
    const found = getLevel(placement.level);
    if (!found) continue;
    const type = resolve(project.types.column, placement.type, "Columns", placement.no);
    if (!type) continue;
    const count = n(placement.no);
    const width = n(type.b) / 1_000;
    const depth = n(type.d) / 1_000;
    const height = n(placement.h) > 0
      ? n(placement.h)
      : Math.max(0, n(found.level.h) - n(found.level.zone));
    const cover = n(rules.cC) / 1_000;
    const context: MeasureContext = {
      loc: `${found.level.name} – columns ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: found.index, el: "Columns", pid: placement.id, tid: type.id,
      grp: "COL", member: type.mark, members: count,
    };
    add(context, "CCOL", count, width, depth, height);
    add(context, "FCOL", count, 2 * (width + depth), null, height);
    bar(context, "Straight + lap", type.dia, n(type.nb), height + n(rules.lap) * n(type.dia) / 1_000);
    bar(context, "Closed link", type.lkd, links(height, type.lks, type.lksEnd, type.ez), 2 * ((width - 2 * cover) + (depth - 2 * cover)) + n(rules.hook) * n(type.lkd) / 1_000);
    if (n(type.nb) < 4) warnings.push(`${type.mark}: fewer than 4 main bars.`);
    checkSpacing(type.mark, type.lks);
  }

  // Beams
  for (const placement of project.pl.beam) {
    if (!placement.level) continue;
    const found = getLevel(placement.level);
    if (!found) continue;
    const type = resolve(project.types.beam, placement.type, "Beams", placement.no);
    if (!type) continue;
    const count = n(placement.no);
    const span = n(placement.span);
    const width = n(type.b) / 1_000;
    const downstand = Math.max(0, n(type.h) / 1_000 - n(found.level.zone));
    const context: MeasureContext = {
      loc: `${found.level.name} – beams ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: found.index, el: "Beams", pid: placement.id, tid: type.id,
      grp: "BEAM", member: type.mark, members: count,
    };
    add(context, "CBEAM", count, span, width, downstand);
    add(context, "FBSOF", count, span, width, null);
    add(context, "FBSID", count * 2, span, null, downstand);
    beamBars(context, type, span);
  }

  // Suspended slabs
  for (const placement of project.pl.slab) {
    const found = getLevel(placement.level);
    if (!found) continue;
    const type = resolve(project.types.slab, placement.type, "Slabs", placement.no);
    if (!type) continue;
    const count = n(placement.no);
    const length = n(placement.L);
    const width = n(placement.W);
    const supportWidth = n(placement.bw);
    const thickness = n(type.t) / 1_000;
    const cover = n(rules.cS) / 1_000;
    const anchorage = n(rules.anchS);
    const context: MeasureContext = {
      loc: `${found.level.name} – slab ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: found.index, el: "Slabs", pid: placement.id, tid: type.id,
      grp: "SLAB", member: type.mark, members: count,
    };
    add(context, "CSLAB", count, length, width, thickness);
    if (n(placement.less)) add(context, "CSLAB", -1, n(placement.less), null, thickness);
    const propBand = proppingBand(n(found.level.h) - thickness);
    add(context, `FSLAB${propBand}`, count, Math.max(0, length - supportWidth), Math.max(0, width - supportWidth), null);
    if (n(placement.less)) add(context, `FSLAB${propBand}`, -1, n(placement.less), null, null);
    add(context, "FSLABE", 1, n(placement.edge), null, thickness);
    const clear = (value: number): number => Math.max(0, value - supportWidth);
    bar(context, "Straight + anchorage", type.bxd, barsAcross(clear(width) - 2 * cover, type.bxs), stock(length + 2 * anchorage * n(type.bxd) / 1_000, type.bxd));
    bar(context, "Straight + anchorage", type.byd, barsAcross(clear(length) - 2 * cover, type.bys), stock(width + 2 * anchorage * n(type.byd) / 1_000, type.byd));
    if (type.topMode === "full") {
      bar(context, "Straight + anchorage (top)", type.txd, barsAcross(clear(width) - 2 * cover, type.txs), stock(length + 2 * anchorage * n(type.txd) / 1_000, type.txd));
      bar(context, "Straight + anchorage (top)", type.tyd, barsAcross(clear(length) - 2 * cover, type.tys), stock(width + 2 * anchorage * n(type.tyd) / 1_000, type.tyd));
    } else if (type.topMode === "supports") {
      bar(context, "Top over supports, bent", type.txd, 2 * barsAcross(clear(width) - 2 * cover, type.txs), 0.25 * clear(length) + supportWidth / 2 + anchorage * n(type.txd) / 1_000);
      bar(context, "Top over supports, bent", type.tyd, 2 * barsAcross(clear(length) - 2 * cover, type.tys), 0.25 * clear(width) + supportWidth / 2 + anchorage * n(type.tyd) / 1_000);
    }
    checkSpacing(type.mark, type.bxs, type.bys);
  }

  // Reinforced concrete walls
  for (const placement of project.pl.wall) {
    const found = getLevel(placement.level);
    if (!found) continue;
    const type = resolve(project.types.wall, placement.type, "Walls");
    if (!type) continue;
    const length = n(placement.len);
    const height = n(placement.h) > 0 ? n(placement.h) : n(found.level.h);
    const thickness = n(type.t) / 1_000;
    const faces = n(type.faces) || 2;
    const cover = n(rules.cW) / 1_000;
    const context: MeasureContext = {
      loc: `${found.level.name} – walls ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: found.index, el: "Walls", pid: placement.id, tid: type.id,
      grp: "WALL", member: type.mark, members: 1,
    };
    if (n(placement.op) > length * height) {
      warnings.push(`${type.mark}: openings are larger than the wall area.`);
    }
    add(context, "CWALL", 1, length, height, thickness);
    if (n(placement.op)) add(context, "CWALL", -1, n(placement.op), null, thickness);
    add(context, "FWALL", 2, length, height, null);
    if (n(placement.op)) add(context, "FWALL", -2, n(placement.op), null, null);
    bar(context, "Straight + lap", type.vd, faces * barsAcross(length - 2 * cover, type.vs), height + n(rules.lap) * n(type.vd) / 1_000);
    bar(context, "Straight + anchorage", type.hd, faces * barsAcross(height - 2 * cover, type.hs), stock(length + 2 * n(rules.anchS) * n(type.hd) / 1_000, type.hd));
    checkSpacing(type.mark, type.vs, type.hs);
  }

  // Stairs
  for (const placement of project.pl.stair) {
    const found = getLevel(placement.level);
    if (!found) continue;
    const type = resolve(project.types.stair, placement.type, "Staircases");
    if (!type) continue;
    const flights = n(placement.flights);
    const landings = n(placement.landings);
    const width = n(type.width);
    const going = n(type.going);
    const rise = n(type.rise);
    const waist = n(type.waist) / 1_000;
    const landing = n(type.landing);
    const cover = n(rules.cS) / 1_000;
    const anchorage = n(rules.anchS);
    const risers = Math.max(1, ceilSafe(rise / 0.175));
    const incline = Math.sqrt(going * going + rise * rise);
    const flightConcrete = incline * waist + rise * going / (2 * risers);
    const base = {
      loc: `${found.level.name} – stairs ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
      lvl: found.index, el: "Stairs", pid: placement.id, tid: type.id,
      grp: "STAIR",
    };
    const flightContext: MeasureContext = { ...base, member: `${type.mark}F`, members: flights };
    const landingContext: MeasureContext = { ...base, member: `${type.mark}L`, members: landings };
    add(flightContext, "CSTAIR", flights, width, flightConcrete, null);
    add(landingContext, "CSTAIR", landings, width, landing, waist);
    add(flightContext, "FSTSOF", flights, width, incline, null);
    add(landingContext, "FSTSOF", landings, width, landing, null);
    add(flightContext, "FSTRIS", flights, risers, width, null);
    add(flightContext, "FSTSTR", flights, flightConcrete, null, null);
    bar(flightContext, "Cranked main bar", type.md, barsAcross(width - 2 * cover, type.ms), incline + 2 * anchorage * n(type.md) / 1_000);
    bar(flightContext, "Straight", type.dd, barsAcross(incline, type.ds), width - 2 * cover);
    bar(landingContext, "Straight + anchorage", type.md, barsAcross(width - 2 * cover, type.ms), landing + 2 * anchorage * n(type.md) / 1_000);
    bar(landingContext, "Straight", type.dd, barsAcross(landing, type.ds), width - 2 * cover);
  }

  const totals: Record<string, number> = {};
  for (const item of items) totals[item.code] = (totals[item.code] ?? 0) + item.q;
  const concrete = Object.entries(totals)
    .filter(([code]) => CONCRETE_CODES.has(code))
    .reduce((sum, [, quantity]) => sum + quantity, 0);
  const steelKg = bars.reduce((sum, item) => sum + item.kg, 0);
  const formwork = Object.entries(totals)
    .filter(([code]) => /^F(?!STRIS|F_)/.test(code))
    .reduce((sum, [, quantity]) => sum + quantity, 0);
  const floorArea = project.btype === "foundation"
    ? slabArea
    : project.pl.slab.reduce((sum, placement) => {
        if (!levelIndex.has(placement.level)) return sum;
        return sum + n(placement.no) * n(placement.L) * n(placement.W) - n(placement.less);
      }, 0) + slabArea;

  for (const group of Object.values(project.types)) {
    for (const type of group) byType[type.id] ??= { conc: 0, kg: 0, uses: 0 };
  }

  return {
    items,
    bars,
    warn: [...new Set(warnings)],
    tot: totals,
    concrete,
    steelKg,
    formwork,
    byPlacement,
    byType,
    floorArea,
    levels,
  };
}
