import type {
  Bar,
  BeamType,
  CatalogueEntry,
  ColumnType,
  Grades,
  MeasuredItem,
  NumericInput,
  PlacementStats,
  Rules,
  SlabType,
  StructuralPlacements,
  StructuralProject,
  StructuralTypes,
  TypeStats,
  WallType,
} from "../types.js";
import type { Phase2Placements, Phase2Types } from "./finishes-mep-types.js";
import type { RoofMode, RoofType, RoofX } from "./roofing-types.js";

export type CivilKind =
  | "rpave"
  | "rdrain"
  | "rculv"
  | "bfoot"
  | "bpier"
  | "bwall"
  | "bbeam"
  | "bslab";

export interface CivilIdentified {
  id: string;
  mark: string;
}

export interface RoadPavementType extends CivilIdentified {
  cw: NumericInput;
  sw: NumericInput;
  reserve: NumericInput;
  acw: NumericInput;
  acb: NumericInput;
  dens: NumericInput;
  sds: boolean;
  base: NumericInput;
  subb: NumericInput;
  cap: NumericInput;
  cs: NumericInput;
  fs: NumericInput;
  top: NumericInput;
}

export interface RoadDrainType extends CivilIdentified {
  b: NumericInput;
  d: NumericInput;
  s: NumericInput;
  lined: boolean;
  t: NumericInput;
  mesh: boolean;
}

export interface RoadCulvertType extends CivilIdentified {
  dia: NumericInput;
  bed: NumericInput;
  hwW: NumericInput;
  hwH: NumericInput;
  hwT: NumericInput;
  vd: NumericInput;
  vs: NumericInput;
  hd: NumericInput;
  hs: NumericInput;
  apL: NumericInput;
  apW: NumericInput;
  apT: NumericInput;
}

export interface BridgeFootingType extends CivilIdentified {
  L: NumericInput;
  W: NumericInput;
  D: NumericInput;
  depth: NumericInput;
  bxd: NumericInput;
  bxs: NumericInput;
  byd: NumericInput;
  bys: NumericInput;
  top: boolean;
  stn: NumericInput;
  std: NumericInput;
  stl: NumericInput;
}

export type BridgePierType = ColumnType;
export type BridgeWallType = WallType;
export type BridgeBeamType = BeamType;
export type BridgeSlabType = SlabType;

interface CivilPlacementBase {
  id: string;
  type: string;
  ref?: string;
}

export interface RoadPavementPlacement extends CivilPlacementBase {
  from: NumericInput;
  to: NumericInput;
  cut: NumericInput;
  fill: NumericInput;
}

export interface RoadDrainPlacement extends CivilPlacementBase {
  len: NumericInput;
  sides: NumericInput;
}

export interface RoadCulvertPlacement extends CivilPlacementBase {
  len: NumericInput;
  lines: NumericInput;
  no: NumericInput;
  depth: NumericInput;
}

export interface BridgeFootingPlacement extends CivilPlacementBase {
  part: "Abutment" | "Pier";
  no: NumericInput;
}

export interface BridgePierPlacement extends CivilPlacementBase {
  h: NumericInput;
  no: NumericInput;
}

export type BridgeWallPart =
  | "Abutment wall"
  | "Wingwall"
  | "Ballast wall"
  | "Parapet";

export interface BridgeWallPlacement extends CivilPlacementBase {
  part: BridgeWallPart;
  len: NumericInput;
  h: NumericInput;
  no: NumericInput;
}

export type BridgeBeamPart = "Girder" | "Crosshead" | "Diaphragm";

export interface BridgeBeamPlacement extends CivilPlacementBase {
  part: BridgeBeamPart;
  span: NumericInput;
  no: NumericInput;
}

export type BridgeSlabPart = "Deck slab" | "Approach slab";

export interface BridgeSlabPlacement extends CivilPlacementBase {
  part: BridgeSlabPart;
  L: NumericInput;
  W: NumericInput;
  no: NumericInput;
}

export interface CivilTypes extends StructuralTypes, Phase2Types {
  rpave: RoadPavementType[];
  rdrain: RoadDrainType[];
  rculv: RoadCulvertType[];
  bfoot: BridgeFootingType[];
  bpier: BridgePierType[];
  bwall: BridgeWallType[];
  bbeam: BridgeBeamType[];
  bslab: BridgeSlabType[];
  roof?: readonly RoofType[];
}

export interface CivilPlacements extends StructuralPlacements, Phase2Placements {
  rpave: RoadPavementPlacement[];
  rdrain: RoadDrainPlacement[];
  rculv: RoadCulvertPlacement[];
  bfoot: BridgeFootingPlacement[];
  bpier: BridgePierPlacement[];
  bwall: BridgeWallPlacement[];
  bbeam: BridgeBeamPlacement[];
  bslab: BridgeSlabPlacement[];
  roof?: readonly import("./roofing-types.js").RoofPlacement[];
}

export interface RoadFurniture {
  kerb: NumericInput;
  lines: NumericInput;
  signs: NumericInput;
  grail: NumericInput;
  studs: NumericInput;
  kmp: NumericInput;
}

export interface BridgeAccessories {
  bearings: NumericInput;
  joints: NumericInput;
  wp: NumericInput;
  surf: NumericInput;
  surfT: NumericInput;
  spouts: NumericInput;
  rail: NumericInput;
  backfill: NumericInput;
}

interface CivilProjectBase
  extends Omit<StructuralProject, "btype" | "types" | "pl"> {
  types: CivilTypes;
  pl: CivilPlacements;
  road: RoadFurniture;
  bacc: BridgeAccessories;
  roofMode?: RoofMode;
  roofx?: RoofX;
}

export type CivilProject =
  | (CivilProjectBase & { btype: "road" })
  | (CivilProjectBase & { btype: "bridge" });

export interface CivilComputeOptions {
  /**
   * Restricts measured placement families. When omitted, the families visible
   * for project.btype are used. Bridge accessories intentionally ignore this
   * filter, matching the prototype.
   */
  kinds?: readonly CivilKind[];
}

/**
 * Self-contained civil result. Its quantity, bar and statistics fields are
 * assignment-compatible with the corresponding fields in ComputeResult.
 */
export interface CivilComputeResult {
  items: MeasuredItem[];
  bars: Bar[];
  warn: string[];
  tot: Record<string, number>;
  concrete: number;
  steelKg: number;
  formwork: number;
  byPlacement: Record<string, PlacementStats>;
  byType: Record<string, TypeStats>;
  floorArea: 0;
  levels: [];
}

export type CivilCatalogueEntry = CatalogueEntry;

export interface CivilDefaults {
  types: CivilTypes;
  placements: CivilPlacements;
  rules: Rules;
  grades: Grades;
  road: RoadFurniture;
  bacc: BridgeAccessories;
}
