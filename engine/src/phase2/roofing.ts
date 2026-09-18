import { n } from "../expression.js";
import { ceilSafe } from "../helpers.js";
import type {
  RoofAdd,
  RoofCatalogueEntry,
  RoofCatalogueUnit,
  RoofGeometryReadouts,
  RoofLine,
  RoofLineGeometry,
  RoofOpeningKind,
  RoofPlane,
  RoofPlaneGeometry,
  RoofResource,
  RoofingComputeEnvironment,
  RoofingComputeResult,
  RoofingProjectLike,
  RoofPlacement,
  RoofType,
  RoofX,
} from "./roofing-types.js";

export type * from "./roofing-types.js";

export const ROOF_FORMS = [
  "Pitched – hip",
  "Pitched – gable",
  "Mono-pitch",
  "Flat concrete slab",
] as const;

export const ROOF_COVERS = {
  "Pre-painted IT4 iron sheets": { resource: "R01", factor: 1.12, kind: "sheet" },
  "Galvanised corrugated iron sheets": { resource: "R02", factor: 1.15, kind: "sheet" },
  "Stone-coated steel tiles": { resource: "R05", factor: 1.10, kind: "tile" },
  "Clay roof tiles": { resource: "R03", factor: 1.05, kind: "tile" },
  "Concrete roof tiles": { resource: "R04", factor: 1.05, kind: "tile" },
  "Torch-on bituminous membrane": { resource: "R06", factor: 1.15, kind: "flat" },
  "Liquid-applied waterproofing": { resource: "R07", factor: 1.8, kind: "flat" },
} as const;

export const ROOF_INSULATION_RESOURCES = {
  "None": "",
  "Foil-backed insulation": "R16",
  "Glass wool 50 mm": "R17",
  "Rigid PIR board 50 mm": "R18",
} as const;

export const ROOF_LINE_KINDS = [
  "Ridge",
  "Hip",
  "Valley",
  "Verge / barge",
  "Eaves",
  "Abutment – wall",
  "Abutment – chimney",
  "Parapet / box gutter",
] as const;

export const ROOF_OPENING_KINDS = [
  "Skylight / roof light",
  "Dormer",
  "Roof hatch",
  "Vent / pipe penetration",
] as const;

const OPENING_CODES: Record<RoofOpeningKind, string> = {
  "Skylight / roof light": "SKYL",
  "Dormer": "DORM",
  "Roof hatch": "HATCH",
  "Vent / pipe penetration": "VENT",
};

export const ROOF_RESOURCES: readonly RoofResource[] = [
  { code: "R01", cat: "Material", name: "Pre-painted IT4 iron sheet 0.4 mm", unit: "m²", rate: 7.5 },
  { code: "R02", cat: "Material", name: "Galvanised corrugated iron sheet 28 gauge", unit: "m²", rate: 5.5 },
  { code: "R03", cat: "Material", name: "Clay roof tiles", unit: "m²", rate: 14 },
  { code: "R04", cat: "Material", name: "Concrete roof tiles", unit: "m²", rate: 10 },
  { code: "R05", cat: "Material", name: "Stone-coated steel roof tiles", unit: "m²", rate: 16 },
  { code: "R06", cat: "Material", name: "Torch-on bituminous membrane 4 mm", unit: "m²", rate: 7.5 },
  { code: "R07", cat: "Material", name: "Liquid-applied waterproofing", unit: "kg", rate: 6 },
  { code: "R08", cat: "Material", name: "Ridge and hip capping", unit: "m", rate: 4 },
  { code: "R09", cat: "Material", name: "Roofing screws, washers and sealant", unit: "m²", rate: 0.6 },
  { code: "R10", cat: "Material", name: "Treated timber 50 × 150 mm for trusses", unit: "m", rate: 2.2 },
  { code: "R11", cat: "Material", name: "Truss nail-plate connector set", unit: "No.", rate: 14 },
  { code: "R12", cat: "Material", name: "Treated timber purlin 50 × 75 mm", unit: "m", rate: 1.1 },
  { code: "R13", cat: "Material", name: "Treated timber wall plate 100 × 75 mm", unit: "m", rate: 2 },
  { code: "R14", cat: "Subcontract", name: "Structural steel roof trusses, fabricated and primed", unit: "t", rate: 1900 },
  { code: "R15", cat: "Material", name: "Cold-formed steel C-purlin 150 mm", unit: "m", rate: 6.5 },
  { code: "R16", cat: "Material", name: "Foil-backed roof insulation", unit: "m²", rate: 1.8 },
  { code: "R17", cat: "Material", name: "Glass wool insulation 50 mm", unit: "m²", rate: 3.2 },
  { code: "R18", cat: "Material", name: "Rigid PIR insulation board 50 mm", unit: "m²", rate: 9 },
  { code: "R19", cat: "Material", name: "Treated fascia board 25 × 225 mm", unit: "m", rate: 3.2 },
  { code: "R20", cat: "Material", name: "PVC eaves gutter 150 mm with brackets", unit: "m", rate: 5.5 },
  { code: "R21", cat: "Material", name: "Truss hurricane straps and bolts", unit: "No.", rate: 3 },
  { code: "R22", cat: "Material", name: "Roofing underlay felt", unit: "m²", rate: 1.2 },
  { code: "R23", cat: "Material", name: "Treated tile batten 38 × 50 mm", unit: "m", rate: 0.6 },
  { code: "R24", cat: "Material", name: "Pre-painted valley gutter, 600 mm girth", unit: "m", rate: 7.5 },
  { code: "R25", cat: "Material", name: "GRP valley trough for tiled roofs", unit: "m", rate: 9 },
  { code: "R26", cat: "Material", name: "Pre-painted verge / barge flashing", unit: "m", rate: 4 },
  { code: "R27", cat: "Material", name: "Dry verge units", unit: "m", rate: 6 },
  { code: "R28", cat: "Material", name: "Pre-painted apron and step flashing", unit: "m", rate: 4.5 },
  { code: "R29", cat: "Material", name: "Flashing sealant and fixings", unit: "m", rate: 0.8 },
  { code: "R30", cat: "Material", name: "Box gutter 600 mm girth with outlets", unit: "m", rate: 22 },
  { code: "R31", cat: "Material", name: "Polycarbonate roof light with upstand kerb", unit: "m²", rate: 45 },
  { code: "R32", cat: "Material", name: "Insulated roof access hatch with kerb", unit: "No.", rate: 180 },
  { code: "R33", cat: "Material", name: "Pipe and vent flashing collar", unit: "No.", rate: 12 },
] as const;

export function sanitiseRoofMark(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, "") || "X";
}

function pitchDegrees(value: RoofPlane["pitch"], type?: RoofType): number {
  const raw = value === "" || value === null || value === undefined
    ? n(type?.pitch)
    : n(value);
  return Math.min(75, Math.max(0, raw));
}

function roofType(project: RoofingProjectLike, id: string): RoofType | undefined {
  return project.types.roof?.find((type) => type.id === id);
}

export function roofPlaneGeometry(
  plane: RoofPlane,
  type?: RoofType,
): RoofPlaneGeometry {
  const a = n(plane.a);
  const b = n(plane.b);
  const h = n(plane.h);
  const count = n(plane.no) || 1;
  const pitch = pitchDegrees(plane.pitch, type);
  const radians = pitch * Math.PI / 180;
  const slopeFactor = 1 / Math.cos(radians);
  const planArea = plane.shape === "Rectangle"
    ? a * h
    : plane.shape === "Trapezium"
      ? (a + b) / 2 * h
      : a * h / 2;
  const averagePurlinLength = plane.shape === "Rectangle"
    ? a
    : plane.shape === "Trapezium"
      ? (a + b) / 2
      : a / 2;
  return {
    type,
    count,
    planArea,
    slopeFactor,
    slopeArea: planArea * slopeFactor,
    rafterLength: h * slopeFactor,
    averagePurlinLength,
    pitch,
  };
}

export function roofLineGeometry(
  line: RoofLine,
  type?: RoofType,
): RoofLineGeometry {
  const count = n(line.no) || 1;
  const length = n(line.len);
  const p1 = pitchDegrees(line.p1, type) * Math.PI / 180;
  const p2 = (line.p2 === "" || line.p2 === null || line.p2 === undefined
    ? pitchDegrees(line.p1, type)
    : pitchDegrees(line.p2, type)) * Math.PI / 180;
  let trueLength = length;
  if (line.on === "Plan" && (line.kind === "Hip" || line.kind === "Valley")) {
    const cotangent1 = Math.tan(p1) > 0 ? 1 / Math.tan(p1) : 1e9;
    const cotangent2 = Math.tan(p2) > 0 ? 1 / Math.tan(p2) : 1e9;
    const rise = length / Math.sqrt(
      cotangent1 * cotangent1 + cotangent2 * cotangent2,
    );
    trueLength = Math.sqrt(length * length + rise * rise);
  } else if (line.on === "Plan" && line.kind === "Verge / barge") {
    trueLength = length / Math.cos(p1);
  }
  return { type, count, trueLength, totalLength: trueLength * count };
}

const emptyReadouts = (): RoofGeometryReadouts => ({
  planArea: 0,
  slopeArea: 0,
  ridgesAndHips: 0,
  valleys: 0,
  openingsDeducted: 0,
  scheduledSteelKg: 0,
});

export function roofGeometryReadouts(project: RoofingProjectLike): RoofGeometryReadouts {
  const result = emptyReadouts();
  const roofx = project.roofx;
  if (!roofx) return result;
  for (const plane of roofx.planes) {
    const geometry = roofPlaneGeometry(plane, roofType(project, plane.roof));
    const sign = plane.less ? -1 : 1;
    result.planArea += geometry.planArea * geometry.count * sign;
    result.slopeArea += (
      geometry.type?.form === "Flat concrete slab"
        ? geometry.planArea
        : geometry.slopeArea
    ) * geometry.count * sign;
  }
  for (const line of roofx.lines) {
    const geometry = roofLineGeometry(line, roofType(project, line.roof));
    if (line.kind === "Ridge" || line.kind === "Hip") {
      result.ridgesAndHips += geometry.totalLength;
    } else if (line.kind === "Valley") {
      result.valleys += geometry.totalLength;
    }
  }
  for (const opening of roofx.openings) {
    const area = n(opening.w) * n(opening.l);
    if (area > 1) result.openingsDeducted += area * (n(opening.no) || 1);
  }
  for (const truss of roofx.trusses) {
    if (truss.type !== "Timber truss") {
      result.scheduledSteelKg += n(truss.no) * n(truss.wt);
    }
  }
  return result;
}

function integration(environment: RoofingComputeEnvironment): {
  project: RoofingProjectLike;
  add: RoofAdd;
  topLevel: number;
  enabled: boolean;
  warning: (message: string) => void;
  useType: (id: string) => void;
} {
  const levels = environment.levels ?? environment.project.levels ?? [];
  return {
    project: environment.project,
    add: environment.add,
    topLevel: levels.length - 1,
    enabled: environment.kinds === undefined || environment.kinds.includes("roof"),
    warning: (message): void => {
      if (environment.warn && !environment.warn.includes(message)) {
        environment.warn.push(message);
      }
      environment.onWarning?.(message);
    },
    useType: (id): void => {
      if (!environment.byType) return;
      const stats = (environment.byType[id] ??= { conc: 0, kg: 0, uses: 0 });
      stats.uses += 1;
    },
  };
}

export function replacedRoofTypeIds(project: RoofingProjectLike): ReadonlySet<string> {
  return new Set(
    (project.roofx?.trusses ?? [])
      .map((truss) => truss.replaces ?? "")
      .filter((id) => id.length > 0),
  );
}

export function computeRoof(
  environment: RoofingComputeEnvironment,
): RoofingComputeResult {
  const api = integration(environment);
  const mode = api.project.roofMode ?? "simple";
  const result: RoofingComputeResult = {
    mode,
    measured: false,
    topLevel: api.topLevel,
    readouts: emptyReadouts(),
  };
  if (!api.enabled || mode !== "simple") return result;
  result.measured = true;
  const replaced = replacedRoofTypeIds(api.project);
  for (const placement of api.project.pl.roof ?? []) {
    measureSimplePlacement(api, placement, replaced);
  }
  return result;
}

function measureSimplePlacement(
  api: ReturnType<typeof integration>,
  placement: RoofPlacement,
  replaced: ReadonlySet<string>,
): void {
  const type = roofType(api.project, placement.type);
  if (!type) {
    api.warning("Roofing: a row refers to a type that no longer exists.");
    return;
  }
  api.useType(type.id);
  const mark = sanitiseRoofMark(type.mark);
  const count = n(placement.no) || 1;
  const length = n(placement.L);
  const width = n(placement.W);
  if (!(length > 0 && width > 0)) return;
  const context = {
    loc: `Roof – ${type.mark}${placement.ref ? ` – ${placement.ref}` : ""}`,
    lvl: api.topLevel,
    el: "Roofing" as const,
    pid: placement.id,
    tid: type.id,
  };
  if (type.form === "Flat concrete slab") {
    if (n(type.falls) > 0) {
      api.add(context, `RFSCR${n(type.falls)}`, count, length, width, null);
    }
    api.add(context, `RFMEM_${mark}`, count, length, width, null);
    api.add(context, `RFMEM_${mark}`, count, 2 * (length + width), 0.3, null);
    if (ROOF_INSULATION_RESOURCES[type.ins]) {
      api.add(context, `RFINS_${mark}`, count, length, width, null);
    }
    if (ROOF_COVERS[type.cover].kind !== "flat") {
      api.warning(`${type.mark}: a flat roof normally takes a membrane or liquid waterproofing.`);
    }
    return;
  }
  const overhang = n(type.overhang);
  const pitchedLength = length + 2 * overhang;
  const pitchedWidth = width + 2 * overhang;
  const pitch = Math.min(75, Math.max(0, n(type.pitch))) * Math.PI / 180;
  const factor = 1 / Math.cos(pitch);
  const mono = type.form === "Mono-pitch";
  const hip = type.form === "Pitched – hip";
  if (n(type.pitch) < 5) {
    api.warning(`${type.mark}: pitch below 5° – check the covering manufacturer's minimum.`);
  }
  const rise = (mono ? pitchedWidth : pitchedWidth / 2) * Math.tan(pitch);
  api.add(context, `RFCOV_${mark}`, count, pitchedLength, pitchedWidth, factor);
  if (hip) {
    api.add(context, `RFRIDGE_${mark}`, count, Math.max(0, pitchedLength - pitchedWidth), null, null);
    api.add(context, `RFRIDGE_${mark}`, 4 * count, Math.sqrt(2 * (pitchedWidth / 2) ** 2 + rise ** 2), null, null);
  } else {
    api.add(context, `RFRIDGE_${mark}`, count, pitchedLength, null, null);
  }
  const trussCount = n(type.ts) > 0
    ? Math.floor(length / n(type.ts) + 1e-9) + 1
    : 0;
  if (trussCount && !replaced.has(type.id)) {
    if (type.struct === "Timber trusses") {
      api.add(context, `RFTRUSS_${mark}_S${Math.round(width * 10)}`, count * trussCount, null, null, null);
    } else if (type.struct === "Steel trusses") {
      api.add(context, `RFSTEEL_${mark}`, count * trussCount, width, 10 + 0.6 * width, null);
    }
  }
  const slope = (mono ? pitchedWidth : pitchedWidth / 2) * factor;
  const purlinRows = n(type.ps) > 0
    ? ceilSafe(slope / (n(type.ps) / 1_000)) + 1
    : 0;
  if (purlinRows && type.struct !== "None – concrete slab") {
    api.add(context, `RFPURL_${mark}`, count, purlinRows * (mono ? 1 : 2), pitchedLength, null);
  }
  if (type.struct === "Timber trusses") {
    api.add(context, "RFPLATE", count, 2, length, null);
  }
  if (ROOF_INSULATION_RESOURCES[type.ins]) {
    api.add(context, `RFINS_${mark}`, count, pitchedLength, pitchedWidth, factor);
  }
  if (type.fascia) {
    if (hip) {
      api.add(context, "RFFASC", count, 2 * (pitchedLength + pitchedWidth), null, null);
    } else {
      api.add(context, "RFFASC", count, 2, pitchedLength, null);
      api.add(context, "RFFASC", count, mono ? 2 : 4, slope, null);
    }
  }
  if (type.gutter) {
    api.add(
      context,
      "RFGUT",
      count,
      hip ? 2 * (pitchedLength + pitchedWidth) : mono ? pitchedLength : 2 * pitchedLength,
      null,
      null,
    );
  }
}

export function computeRoofx(
  environment: RoofingComputeEnvironment,
): RoofingComputeResult {
  const api = integration(environment);
  const mode = api.project.roofMode ?? "simple";
  const readouts = roofGeometryReadouts(api.project);
  const result: RoofingComputeResult = {
    mode,
    measured: false,
    topLevel: api.topLevel,
    readouts,
  };
  if (!api.enabled || mode !== "complex" || !api.project.roofx) return result;
  result.measured = true;
  const roofx = api.project.roofx;
  for (const row of [...roofx.planes, ...roofx.lines, ...roofx.openings]) {
    if (row.roof) api.useType(row.roof);
  }
  measureComplexPlanes(api, roofx);
  measureComplexLines(api, roofx);
  measureComplexOpenings(api, roofx);
  measureScheduledTrusses(api, roofx);
  return result;
}

function complexContext(
  api: ReturnType<typeof integration>,
  what: string,
  ref: string | undefined,
  id: string,
  typeId: string,
) {
  return {
    loc: `Complex roof – ${what}${ref ? ` – ${ref}` : ""}`,
    lvl: api.topLevel,
    el: "Roofing" as const,
    pid: id,
    tid: typeId,
  };
}

function measureComplexPlanes(api: ReturnType<typeof integration>, roofx: RoofX): void {
  for (const plane of roofx.planes) {
    const type = roofType(api.project, plane.roof);
    const geometry = roofPlaneGeometry(plane, type);
    if (!type) {
      api.warning("Complex roof: a plane has no roof type.");
      continue;
    }
    if (!(geometry.planArea > 0)) continue;
    const context = complexContext(api, "planes", plane.ref, plane.id, type.id);
    const mark = sanitiseRoofMark(type.mark);
    const signedCount = (plane.less ? -1 : 1) * geometry.count;
    if (type.form === "Flat concrete slab") {
      if (n(type.falls) > 0) {
        api.add(context, `RFSCR${n(type.falls)}`, signedCount, geometry.planArea, null, null);
      }
      api.add(context, `RFMEM_${mark}`, signedCount, geometry.planArea, null, null);
      if (ROOF_INSULATION_RESOURCES[type.ins]) {
        api.add(context, `RFINS_${mark}`, signedCount, geometry.planArea, null, null);
      }
      continue;
    }
    api.add(context, `RFCOV_${mark}`, signedCount, geometry.planArea, geometry.slopeFactor, null);
    if (ROOF_INSULATION_RESOURCES[type.ins]) {
      api.add(context, `RFINS_${mark}`, signedCount, geometry.planArea, geometry.slopeFactor, null);
    }
    if (type.struct !== "None – concrete slab" && n(type.ps) > 0) {
      const rows = ceilSafe(geometry.rafterLength / (n(type.ps) / 1_000)) + 1;
      api.add(context, `RFPURL_${mark}`, signedCount, rows, geometry.averagePurlinLength, null);
    }
  }
}

function measureComplexLines(api: ReturnType<typeof integration>, roofx: RoofX): void {
  for (const line of roofx.lines) {
    const type = roofType(api.project, line.roof);
    const geometry = roofLineGeometry(line, type);
    if (!type || !(geometry.trueLength > 0)) continue;
    const context = complexContext(api, "lines", line.ref, line.id, type.id);
    const mark = sanitiseRoofMark(type.mark);
    if (line.kind === "Ridge" || line.kind === "Hip") {
      api.add(context, `RFRIDGE_${mark}`, geometry.count, geometry.trueLength, null, null);
    } else if (line.kind === "Valley") {
      api.add(context, `RFVAL_${mark}`, geometry.count, geometry.trueLength, null, null);
    } else if (line.kind === "Verge / barge") {
      api.add(context, `RFVERGE_${mark}`, geometry.count, geometry.trueLength, null, null);
      if (type.fascia) api.add(context, "RFFASC", geometry.count, geometry.trueLength, null, null);
    } else if (line.kind === "Eaves") {
      if (type.gutter) api.add(context, "RFGUT", geometry.count, geometry.trueLength, null, null);
      if (type.fascia) api.add(context, "RFFASC", geometry.count, geometry.trueLength, null, null);
    } else if (line.kind === "Abutment – wall") {
      api.add(context, "RFABUT", geometry.count, geometry.trueLength, null, null);
    } else if (line.kind === "Abutment – chimney") {
      api.add(context, "RFCHIM", geometry.count, geometry.trueLength, null, null);
    } else {
      api.add(context, "RFBOX", geometry.count, geometry.trueLength, null, null);
    }
  }
}

function measureComplexOpenings(api: ReturnType<typeof integration>, roofx: RoofX): void {
  for (const opening of roofx.openings) {
    const type = roofType(api.project, opening.roof);
    const count = n(opening.no) || 1;
    const width = n(opening.w);
    const length = n(opening.l);
    if (!type || !(width > 0 && length > 0)) continue;
    const context = complexContext(api, "openings", opening.ref, opening.id, type.id);
    const mark = sanitiseRoofMark(type.mark);
    if (width * length > 1) {
      api.add(
        context,
        type.form === "Flat concrete slab" ? `RFMEM_${mark}` : `RFCOV_${mark}`,
        -count,
        width,
        length,
        null,
      );
      if (ROOF_INSULATION_RESOURCES[type.ins]) {
        api.add(context, `RFINS_${mark}`, -count, width, length, null);
      }
    }
    api.add(
      context,
      `RF${OPENING_CODES[opening.kind]}_${Math.round(width * 100)}x${Math.round(length * 100)}`,
      count,
      null,
      null,
      null,
    );
  }
}

function measureScheduledTrusses(api: ReturnType<typeof integration>, roofx: RoofX): void {
  for (const truss of roofx.trusses) {
    const count = n(truss.no);
    if (!count) continue;
    const context = complexContext(api, "truss schedule", truss.mark, truss.id, "trs");
    const mark = sanitiseRoofMark(truss.mark);
    if (truss.type === "Timber truss") {
      api.add(context, `RFTTS_${mark}`, count, null, null, null);
    } else {
      api.add(context, `RFSTS_${mark}`, count, n(truss.wt), null, null);
    }
  }
}

export function computeRoofing(
  environment: RoofingComputeEnvironment,
): RoofingComputeResult {
  return (environment.project.roofMode ?? "simple") === "complex"
    ? computeRoofx(environment)
    : computeRoof(environment);
}

function formatNumber(value: number, digits = 0): string {
  return value.toFixed(digits).replace(/\.0+$/, "");
}

export function roofCatalogue(project: RoofingProjectLike): RoofCatalogueEntry[] {
  const rows: RoofCatalogueEntry[] = [];
  const seen = new Set<string>();
  const push = (code: string, unit: RoofCatalogueUnit, desc: string): void => {
    if (seen.has(code)) return;
    seen.add(code);
    rows.push({ sec: "Roofing", code, unit, desc });
  };
  for (const type of project.types.roof ?? []) {
    const mark = sanitiseRoofMark(type.mark);
    const cover = ROOF_COVERS[type.cover];
    if (type.form === "Flat concrete slab") {
      if (n(type.falls) > 0) {
        push(`RFSCR${n(type.falls)}`, "m²", `Cement-sand screed to falls, average ${n(type.falls)} mm thick, on roof slab`);
      }
      push(`RFMEM_${mark}`, "m²", `${type.cover}${type.spec ? `, ${type.spec}` : ""}, to flat roof including 300 mm upstands (roof ${type.mark})`);
    } else {
      push(`RFCOV_${mark}`, "m²", `${type.cover}${type.spec ? `, ${type.spec}` : ""}, to ${type.form.replace("Pitched – ", "").toLowerCase()} roof at ${n(type.pitch)}° pitch, measured on slope, ${cover.kind === "tile" ? "on battens and underlay" : "fixed to purlins with screws and washers"} (roof ${type.mark})`);
      push(`RFRIDGE_${mark}`, "m", `Ridge${type.form === "Pitched – hip" ? " and hip" : ""} capping to match covering (roof ${type.mark})`);
      if (type.struct === "Steel trusses") {
        push(`RFSTEEL_${mark}`, "t", `Structural steel roof trusses at ${n(type.ts)} m centres, fabricated, primed and erected (roof ${type.mark})`);
      }
      if (type.struct !== "None – concrete slab") {
        push(`RFPURL_${mark}`, "m", type.struct === "Steel trusses"
          ? `Cold-formed steel C-purlins 150 mm at ${n(type.ps)} mm centres (roof ${type.mark})`
          : cover.kind === "tile"
            ? `Treated timber tile battens 38 × 50 mm at ${n(type.ps)} mm gauge (roof ${type.mark})`
            : `Treated timber purlins 50 × 75 mm at ${n(type.ps)} mm centres (roof ${type.mark})`);
      }
      if (type.fascia) push("RFFASC", "m", "Treated timber fascia and barge boards 25 × 225 mm, primed and painted");
      if (type.gutter) push("RFGUT", "m", "PVC eaves gutter 150 mm with brackets, stop ends and outlets");
      if (type.struct === "Timber trusses") {
        push("RFPLATE", "m", "Treated timber wall plate 100 × 75 mm, bedded and strapped to walls");
      }
    }
    if (ROOF_INSULATION_RESOURCES[type.ins]) {
      push(`RFINS_${mark}`, "m²", `${type.ins} to roof${type.form.startsWith("Flat") ? "" : ", laid over purlins"} (roof ${type.mark})`);
    }
  }
  for (const placement of project.pl.roof ?? []) {
    const type = roofType(project, placement.type);
    if (!type || type.struct !== "Timber trusses" || type.form === "Flat concrete slab") continue;
    const width = n(placement.W);
    push(`RFTRUSS_${sanitiseRoofMark(type.mark)}_S${Math.round(width * 10)}`, "No.", `Treated timber roof trusses, ${formatNumber(width, 1)} m span at ${n(type.ts)} m centres, with nail plates and hurricane straps (roof ${type.mark})`);
  }
  addComplexCatalogue(project, push);
  return rows;
}

function addComplexCatalogue(
  project: RoofingProjectLike,
  push: (code: string, unit: RoofCatalogueUnit, desc: string) => void,
): void {
  const roofx = project.roofx;
  if (!roofx) return;
  const used = new Set(
    [...roofx.planes, ...roofx.lines, ...roofx.openings].map((row) => row.roof),
  );
  for (const type of project.types.roof ?? []) {
    if (!used.has(type.id)) continue;
    const mark = sanitiseRoofMark(type.mark);
    const tile = ROOF_COVERS[type.cover].kind === "tile";
    push(`RFCOV_${mark}`, "m²", `${type.cover}${type.spec ? `, ${type.spec}` : ""}, to roof slopes, measured on slope, ${tile ? "on battens and underlay" : "fixed to purlins with screws and washers"} (roof ${type.mark})`);
    if (ROOF_INSULATION_RESOURCES[type.ins]) push(`RFINS_${mark}`, "m²", `${type.ins} to roof (roof ${type.mark})`);
    if (type.struct !== "None – concrete slab") {
      push(`RFPURL_${mark}`, "m", type.struct === "Steel trusses"
        ? `Cold-formed steel C-purlins 150 mm at ${n(type.ps)} mm centres (roof ${type.mark})`
        : tile
          ? `Treated timber tile battens 38 × 50 mm at ${n(type.ps)} mm gauge (roof ${type.mark})`
          : `Treated timber purlins 50 × 75 mm at ${n(type.ps)} mm centres (roof ${type.mark})`);
    }
    push(`RFRIDGE_${mark}`, "m", `Ridge and hip capping to match covering (roof ${type.mark})`);
    push(`RFVAL_${mark}`, "m", tile ? `GRP valley trough with cutting of tiles to valleys (roof ${type.mark})` : `Pre-painted valley gutter 600 mm girth with cutting of sheets (roof ${type.mark})`);
    push(`RFVERGE_${mark}`, "m", tile ? `Dry verge system to tiled verges (roof ${type.mark})` : `Pre-painted verge and barge flashing (roof ${type.mark})`);
    if (type.form === "Flat concrete slab") {
      push(`RFMEM_${mark}`, "m²", `${type.cover}${type.spec ? `, ${type.spec}` : ""} to flat roof (roof ${type.mark})`);
    }
  }
  push("RFFASC", "m", "Treated timber fascia and barge boards 25 × 225 mm, primed and painted");
  push("RFGUT", "m", "PVC eaves gutter 150 mm with brackets, stop ends and outlets");
  push("RFABUT", "m", "Apron and step flashings at abutments with walls, sealed");
  push("RFCHIM", "m", "Flashings around chimneys and roof upstands, sealed");
  push("RFBOX", "m", "Box or parapet gutter, 600 mm girth, with outlets and underlay");
  for (const opening of roofx.openings) {
    const width = n(opening.w);
    const length = n(opening.l);
    if (!(width > 0 && length > 0)) continue;
    const code = `RF${OPENING_CODES[opening.kind]}_${Math.round(width * 100)}x${Math.round(length * 100)}`;
    const description = opening.kind === "Skylight / roof light"
      ? "Polycarbonate roof light with upstand kerb"
      : opening.kind === "Dormer"
        ? "Dormer framing, cheeks, covering and flashings (window measured elsewhere)"
        : opening.kind === "Roof hatch"
          ? "Insulated roof access hatch with kerb"
          : "Flashing collar to pipe or vent penetration";
    push(code, "No.", `${description}, ${formatNumber(width, 2)} × ${formatNumber(length, 2)} m, including trimming and flashings`);
  }
  for (const truss of roofx.trusses) {
    if (!n(truss.no)) continue;
    const mark = sanitiseRoofMark(truss.mark);
    if (truss.type === "Timber truss") {
      push(`RFTTS_${mark}`, "No.", `Treated timber roof truss ${truss.mark}, ${formatNumber(n(truss.span), 1)} m span, with nail plates and hurricane straps (truss schedule)`);
    } else {
      push(`RFSTS_${mark}`, "t", `Structural steel ${truss.type === "Steel rafter / portal" ? "rafter" : "roof truss"} ${truss.mark}, ${formatNumber(n(truss.span), 1)} m span, fabricated, primed and erected (truss schedule)`);
    }
  }
}

export function createRoofDefaults(): {
  types: RoofType[];
  placements: RoofPlacement[];
} {
  const types: RoofType[] = [
    { id: "roof-rf1", mark: "RF1", form: "Pitched – hip", cover: "Pre-painted IT4 iron sheets", spec: "0.4 mm, colour to architect's choice", pitch: 22.5, overhang: 0.6, struct: "Steel trusses", ts: 4.5, ps: 1200, ins: "Foil-backed insulation", falls: 0, gutter: true, fascia: true },
    { id: "roof-rf2", mark: "RF2", form: "Flat concrete slab", cover: "Torch-on bituminous membrane", spec: "Two-layer system with mineral cap sheet", pitch: 0, overhang: 0, struct: "None – concrete slab", ts: 0, ps: 0, ins: "Rigid PIR board 50 mm", falls: 50, gutter: false, fascia: false },
    { id: "roof-rf3", mark: "RF3", form: "Pitched – gable", cover: "Clay roof tiles", spec: "Double Roman profile", pitch: 30, overhang: 0.45, struct: "Timber trusses", ts: 0.6, ps: 320, ins: "Glass wool 50 mm", falls: 0, gutter: true, fascia: true },
  ];
  return {
    types,
    placements: [
      { id: "roof-placement-rf1", type: types[0]!.id, L: 28, W: 15, no: 1, ref: "Main roof over offices" },
      { id: "roof-placement-rf2", type: types[1]!.id, L: 6, W: 6, no: 1, ref: "Flat roof over stair and lift core" },
      { id: "roof-placement-rf3", type: types[2]!.id, L: 8, W: 4, no: 1, ref: "Entrance canopy" },
    ],
  };
}

export function createRoofXDefaults(types: readonly RoofType[]): RoofX {
  const first = types[0]?.id ?? "";
  return {
    planes: [
      { id: "rx-plane-1", ref: "Main block – front slope", roof: first, shape: "Trapezium", a: 24, b: 12, h: 6, pitch: "", no: 1 },
      { id: "rx-plane-2", ref: "Main block – rear slope", roof: first, shape: "Trapezium", a: 24, b: 12, h: 6, pitch: "", no: 1 },
      { id: "rx-plane-3", ref: "Main block – hip ends", roof: first, shape: "Triangle", a: 12, b: 0, h: 6, pitch: "", no: 2 },
      { id: "rx-plane-4", ref: "Rear wing – side slopes", roof: first, shape: "Rectangle", a: 10, b: 0, h: 4, pitch: "", no: 2 },
      { id: "rx-plane-5", ref: "Overlap of wing on main rear slope", roof: first, shape: "Triangle", a: 8, b: 0, h: 4, pitch: "", no: 1, less: true },
    ],
    lines: [
      { id: "rx-line-1", ref: "Main ridge", kind: "Ridge", roof: first, len: 12, on: "True", p1: "", p2: "", no: 1 },
      { id: "rx-line-2", ref: "Main hips", kind: "Hip", roof: first, len: 8.49, on: "Plan", p1: "", p2: "", no: 4 },
      { id: "rx-line-3", ref: "Wing ridge", kind: "Ridge", roof: first, len: 10, on: "True", p1: "", p2: "", no: 1 },
      { id: "rx-line-4", ref: "Wing valleys", kind: "Valley", roof: first, len: 5.66, on: "Plan", p1: "", p2: "", no: 2 },
      { id: "rx-line-5", ref: "Wing gable verges", kind: "Verge / barge", roof: first, len: 4, on: "Plan", p1: "", p2: "", no: 2 },
      { id: "rx-line-6", ref: "Eaves all round", kind: "Eaves", roof: first, len: 84, on: "True", p1: "", p2: "", no: 1 },
      { id: "rx-line-7", ref: "Wall abutment at plant room", kind: "Abutment – wall", roof: first, len: 6, on: "True", p1: "", p2: "", no: 1 },
      { id: "rx-line-8", ref: "Box gutter at link", kind: "Parapet / box gutter", roof: first, len: 8, on: "True", p1: "", p2: "", no: 1 },
    ],
    openings: [
      { id: "rx-opening-1", ref: "Stair roof lights", roof: first, kind: "Skylight / roof light", w: 1.2, l: 2.4, no: 2 },
      { id: "rx-opening-2", ref: "Roof access", roof: first, kind: "Roof hatch", w: 0.9, l: 0.9, no: 1 },
      { id: "rx-opening-3", ref: "Soil vent pipes", roof: first, kind: "Vent / pipe penetration", w: 0.15, l: 0.15, no: 4 },
    ],
    trusses: [
      { id: "rx-truss-1", mark: "ST1", type: "Steel truss", span: 12, wt: 210, no: 6, replaces: "" },
      { id: "rx-truss-2", mark: "ST2", type: "Steel truss", span: 8, wt: 120, no: 4, replaces: "" },
    ],
  };
}

/** Integration aliases matching the prototype module vocabulary. */
export const roofDefaults = createRoofDefaults;
export const roofxDefaults = createRoofXDefaults;
export const roofingCatalogue = roofCatalogue;
export const roofResources = ROOF_RESOURCES;
