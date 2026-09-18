export type NumericInput = number | string;
export type BuildingType = "foundation" | "single" | "multi" | "road" | "bridge";
export type StructuralKind =
  | "pad"
  | "strip"
  | "gbeam"
  | "column"
  | "beam"
  | "slab"
  | "wall"
  | "stair";

export interface Identified {
  id: string;
  mark: string;
}

export interface PadType extends Identified {
  L: NumericInput; W: NumericInput; D: NumericInput; depth: NumericInput;
  sb: NumericInput; sd: NumericInput; sh: NumericInput;
  bxd: NumericInput; bxs: NumericInput; byd: NumericInput; bys: NumericInput;
  top: boolean; stn: NumericInput; std: NumericInput; stl: NumericInput;
  lkd: NumericInput; lks: NumericInput;
}

export interface StripType extends Identified {
  B: NumericInput; D: NumericInput; depth: NumericInput;
  td: NumericInput; ts: NumericInput; ln: NumericInput; ld: NumericInput;
}

export interface BeamType extends Identified {
  b: NumericInput; h: NumericInput;
  botN: NumericInput; botD: NumericInput; topN: NumericInput; topD: NumericInput;
  extN: NumericInput; extD: NumericInput; extF: NumericInput;
  sideN: NumericInput; sideD: NumericInput;
  lkd: NumericInput; lks: NumericInput; lksEnd: NumericInput; ez: NumericInput;
}

export interface ColumnType extends Identified {
  b: NumericInput; d: NumericInput; nb: NumericInput; dia: NumericInput;
  lkd: NumericInput; lks: NumericInput; lksEnd: NumericInput; ez: NumericInput;
}

export interface SlabType extends Identified {
  t: NumericInput; bxd: NumericInput; bxs: NumericInput;
  byd: NumericInput; bys: NumericInput;
  topMode: "none" | "supports" | "full";
  txd: NumericInput; txs: NumericInput; tyd: NumericInput; tys: NumericInput;
}

export interface WallType extends Identified {
  t: NumericInput; faces: NumericInput;
  vd: NumericInput; vs: NumericInput; hd: NumericInput; hs: NumericInput;
}

export interface StairType extends Identified {
  width: NumericInput; going: NumericInput; rise: NumericInput;
  waist: NumericInput; landing: NumericInput;
  md: NumericInput; ms: NumericInput; dd: NumericInput; ds: NumericInput;
}

export interface Level {
  id: string;
  name: string;
  h: NumericInput;
  zone: NumericInput;
}

interface PlacementBase {
  id: string;
  type: string;
  ref?: string;
}

export interface PadPlacement extends PlacementBase { no: NumericInput }
export interface StripPlacement extends PlacementBase { len: NumericInput; no: NumericInput }
export interface BeamPlacement extends PlacementBase {
  level?: string; span: NumericInput; no: NumericInput;
}
export interface ColumnPlacement extends PlacementBase {
  level: string; no: NumericInput; h: NumericInput;
}
export interface SlabPlacement extends PlacementBase {
  level: string; L: NumericInput; W: NumericInput; bw: NumericInput;
  no: NumericInput; less: NumericInput; edge: NumericInput;
}
export interface WallPlacement extends PlacementBase {
  level: string; len: NumericInput; h: NumericInput; op: NumericInput;
}
export interface StairPlacement extends PlacementBase {
  level: string; flights: NumericInput; landings: NumericInput;
}

export interface StructuralTypes {
  pad: PadType[];
  strip: StripType[];
  gbeam: BeamType[];
  column: ColumnType[];
  beam: BeamType[];
  slab: SlabType[];
  wall: WallType[];
  stair: StairType[];
}

export interface StructuralPlacements {
  pad: PadPlacement[];
  strip: StripPlacement[];
  gbeam: BeamPlacement[];
  column: ColumnPlacement[];
  beam: BeamPlacement[];
  slab: SlabPlacement[];
  wall: WallPlacement[];
  stair: StairPlacement[];
}

export interface Rules {
  ws: NumericInput; wsOn: boolean; supOn: boolean; attOn: boolean;
  blinding: NumericInput;
  cF: NumericInput; cC: NumericInput; cB: NumericInput;
  cS: NumericInput; cW: NumericInput;
  anchF: NumericInput; anchB: NumericInput; anchS: NumericInput;
  lap: NumericInput; hook: NumericInput; stock: NumericInput;
}

export interface GroundSlab {
  area: NumericInput; edge: NumericInput; t: NumericInput;
  hardcore: NumericInput; sand: NumericInput; dpm: boolean;
  mesh: string; topsoil: NumericInput;
}

export interface Grades {
  blind: string; found: string; frame: string; civil: string; bridge: string;
}

export interface ProjectMeta {
  name: string;
  currency: string;
  numfmt?: string;
}

export interface StructuralProject {
  project: ProjectMeta;
  btype: BuildingType;
  levels: Level[];
  types: StructuralTypes;
  pl: StructuralPlacements;
  sog: GroundSlab;
  rules: Rules;
  grades: Grades;
}

export interface MeasuredItem {
  loc: string;
  lvl: number;
  el: string;
  tid?: string;
  code: string;
  times: number;
  d1: number | null;
  d2: number | null;
  d3: number | null;
  q: number;
}

export interface Bar {
  loc: string; lvl: number; el: string; member: string; mark: string;
  shape: string; dia: number; members: number; each: number;
  len: number; total: number; kg: number;
}

export interface PlacementStats { conc: number; kg: number }
export interface TypeStats extends PlacementStats { uses: number }

export interface ComputeResult {
  items: MeasuredItem[];
  bars: Bar[];
  warn: string[];
  tot: Record<string, number>;
  concrete: number;
  steelKg: number;
  formwork: number;
  byPlacement: Record<string, PlacementStats>;
  byType: Record<string, TypeStats>;
  floorArea: number;
  levels: Level[];
}

export interface CatalogueEntry {
  sec: string;
  code: string;
  unit: "m³" | "m²" | "m" | "No." | "item" | "t";
  desc: string;
}
