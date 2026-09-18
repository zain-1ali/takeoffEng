import type { NumericInput } from "../types.js";

export type RoofMode = "simple" | "complex";
export type RoofForm =
  | "Pitched – hip"
  | "Pitched – gable"
  | "Mono-pitch"
  | "Flat concrete slab";
export type RoofStructure =
  | "Steel trusses"
  | "Timber trusses"
  | "None – concrete slab";
export type RoofCover =
  | "Pre-painted IT4 iron sheets"
  | "Galvanised corrugated iron sheets"
  | "Stone-coated steel tiles"
  | "Clay roof tiles"
  | "Concrete roof tiles"
  | "Torch-on bituminous membrane"
  | "Liquid-applied waterproofing";
export type RoofInsulation =
  | "None"
  | "Foil-backed insulation"
  | "Glass wool 50 mm"
  | "Rigid PIR board 50 mm";

export interface RoofType {
  id: string;
  mark: string;
  form: RoofForm;
  cover: RoofCover;
  spec: string;
  pitch: NumericInput;
  overhang: NumericInput;
  struct: RoofStructure;
  ts: NumericInput;
  ps: NumericInput;
  ins: RoofInsulation;
  falls: NumericInput;
  gutter: boolean;
  fascia: boolean;
}

export interface RoofPlacement {
  id: string;
  type: string;
  L: NumericInput;
  W: NumericInput;
  no: NumericInput;
  ref?: string;
}

export type RoofPlaneShape = "Rectangle" | "Trapezium" | "Triangle";

export interface RoofPlane {
  id: string;
  ref?: string;
  roof: string;
  shape: RoofPlaneShape;
  a: NumericInput;
  b: NumericInput;
  h: NumericInput;
  pitch: NumericInput;
  no: NumericInput;
  less?: boolean;
}

export type RoofLineKind =
  | "Ridge"
  | "Hip"
  | "Valley"
  | "Verge / barge"
  | "Eaves"
  | "Abutment – wall"
  | "Abutment – chimney"
  | "Parapet / box gutter";

export interface RoofLine {
  id: string;
  ref?: string;
  kind: RoofLineKind;
  roof: string;
  len: NumericInput;
  on: "Plan" | "True";
  p1: NumericInput;
  p2: NumericInput;
  no: NumericInput;
}

export type RoofOpeningKind =
  | "Skylight / roof light"
  | "Dormer"
  | "Roof hatch"
  | "Vent / pipe penetration";

export interface RoofOpening {
  id: string;
  ref?: string;
  roof: string;
  kind: RoofOpeningKind;
  w: NumericInput;
  l: NumericInput;
  no: NumericInput;
}

export interface RoofTrussScheduleRow {
  id: string;
  mark: string;
  type: "Steel truss" | "Steel rafter / portal" | "Timber truss";
  span: NumericInput;
  wt: NumericInput;
  no: NumericInput;
  replaces?: string;
}

export interface RoofX {
  planes: RoofPlane[];
  lines: RoofLine[];
  openings: RoofOpening[];
  trusses: RoofTrussScheduleRow[];
}

export interface RoofingProjectLike {
  roofMode?: RoofMode;
  levels?: readonly unknown[];
  types: { roof?: readonly RoofType[] };
  pl: { roof?: readonly RoofPlacement[] };
  roofx?: RoofX;
}

export interface RoofMeasureContext {
  loc: string;
  lvl: number;
  el: "Roofing";
  pid: string;
  tid: string;
}

export type RoofAdd = (
  context: RoofMeasureContext,
  code: string,
  times: number,
  d1: number | null,
  d2: number | null,
  d3: number | null,
) => void;

export interface RoofTypeStats {
  conc: number;
  kg: number;
  uses: number;
}

export interface RoofingComputeEnvironment {
  project: RoofingProjectLike;
  add: RoofAdd;
  levels?: readonly unknown[];
  kinds?: readonly string[];
  warn?: string[];
  onWarning?: (message: string) => void;
  byType?: Record<string, RoofTypeStats>;
}

export interface RoofPlaneGeometry {
  type?: RoofType;
  count: number;
  planArea: number;
  slopeFactor: number;
  slopeArea: number;
  rafterLength: number;
  averagePurlinLength: number;
  pitch: number;
}

export interface RoofLineGeometry {
  type?: RoofType;
  count: number;
  trueLength: number;
  totalLength: number;
}

export interface RoofGeometryReadouts {
  planArea: number;
  slopeArea: number;
  ridgesAndHips: number;
  valleys: number;
  openingsDeducted: number;
  scheduledSteelKg: number;
}

export interface RoofingComputeResult {
  mode: RoofMode;
  measured: boolean;
  topLevel: number;
  readouts: RoofGeometryReadouts;
}

export type RoofCatalogueUnit = "m²" | "m" | "No." | "t";

export interface RoofCatalogueEntry {
  sec: "Roofing";
  code: string;
  unit: RoofCatalogueUnit;
  desc: string;
}

export interface RoofResource {
  code: string;
  cat: "Material" | "Subcontract";
  name: string;
  unit: "m²" | "kg" | "m" | "No." | "t";
  rate: number;
}
