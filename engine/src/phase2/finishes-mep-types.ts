import type { Level, NumericInput, TypeStats } from "../types.js";

export type Phase2Kind =
  | "masonry"
  | "wfin"
  | "ffin"
  | "cfin"
  | "elec"
  | "elecgear"
  | "sanit"
  | "plumb";

export interface Phase2Identified {
  id: string;
  mark: string;
}

export type MasonryMaterial =
  | "Hollow concrete block"
  | "Solid concrete block"
  | "Burnt clay brick"
  | "Stone";
export type MortarMix = "1:3" | "1:4" | "1:6";

export interface MasonryType extends Phase2Identified {
  mat: MasonryMaterial;
  t: NumericInput;
  uL: NumericInput;
  uH: NumericInput;
  joint: NumericInput;
  mortar: MortarMix;
  bfc: NumericInput;
  dpc: boolean;
  lh: NumericInput;
  bear: NumericInput;
  lbar: NumericInput;
  llk: NumericInput;
}

export type WallFinishBase =
  | "Cement-sand plaster"
  | "Cement-sand render"
  | "Gypsum skim"
  | "None";
export type WallFinish =
  | "Emulsion paint"
  | "Weatherproof paint"
  | "Ceramic wall tiles"
  | "Stone cladding"
  | "No finish";

export interface WallFinishType extends Phase2Identified {
  side: "Internal" | "External";
  base: WallFinishBase;
  bt: NumericInput;
  fin: WallFinish;
  coats: NumericInput;
  tile: string;
}

export type FloorFinish =
  | "Porcelain tiles"
  | "Ceramic tiles"
  | "Terrazzo"
  | "Timber flooring"
  | "Vinyl sheet"
  | "Epoxy coating"
  | "Carpet tiles"
  | "Power-floated concrete";

export interface FloorFinishType extends Phase2Identified {
  screed: NumericInput;
  fin: FloorFinish;
  tile: string;
  skm: "Matching tile" | "Timber" | "PVC" | "None";
  skh: NumericInput;
}

export type CeilingKind =
  | "Gypsum board suspended ceiling"
  | "Mineral fibre tile suspended ceiling"
  | "Plaster and paint to soffit"
  | "Paint to fair-faced soffit"
  | "PVC ceiling panels"
  | "T&G timber ceiling";

export interface CeilingFinishType extends Phase2Identified {
  kind: CeilingKind;
  bt: NumericInput;
  coats: NumericInput;
  drop: NumericInput;
}

export type ElectricalCategory =
  | "Lighting point – LED panel"
  | "Lighting point – downlight"
  | "Lighting point – batten"
  | "Lighting point – exterior"
  | "Emergency light"
  | "Switch – one gang"
  | "Switch – two gang"
  | "Socket outlet – twin 13 A"
  | "Power outlet – 20 A (AC or cooker)"
  | "Data outlet Cat6"
  | "TV outlet"
  | "Smoke detector"
  | "Manual call point";
export type ElectricalCable =
  | "1.5 mm² twin & earth"
  | "2.5 mm² twin & earth"
  | "4 mm² twin & earth"
  | "6 mm² twin & earth"
  | "Cat6 data"
  | "Coaxial"
  | "Fire-resistant 1.5 mm²";
export type ElectricalConduit =
  | "20 mm PVC conduit"
  | "25 mm PVC conduit"
  | "Surface trunking"
  | "None";

export interface ElectricalPointType extends Phase2Identified {
  cat: ElectricalCategory;
  desc: string;
  cable: ElectricalCable;
  conduit: ElectricalConduit;
  run: NumericInput;
}

export type ElectricalGearItem =
  | "Distribution board"
  | "Main switchboard"
  | "Sub-main cable"
  | "Cable tray"
  | "Earthing system"
  | "Lightning protection"
  | "Changeover switch"
  | "Energy meter";

export interface ElectricalGearType extends Phase2Identified {
  item: ElectricalGearItem;
  spec: string;
  unit: "No." | "m" | "item";
}

export type SanitaryFitting =
  | "WC suite"
  | "Wash hand basin"
  | "Urinal"
  | "Shower"
  | "Kitchen sink"
  | "Bath"
  | "Floor drain";

export interface SanitaryType extends Phase2Identified {
  fx: SanitaryFitting;
  spec: string;
  cold: boolean;
  hot: boolean;
  sdia: "20" | "25" | "32";
  srun: NumericInput;
  wdia: "32" | "40" | "50" | "110";
  wrun: NumericInput;
}

export type PlumbingItem =
  | "Cold water riser"
  | "Hot water riser"
  | "Soil and vent stack"
  | "Rainwater downpipe"
  | "Underground drain pipe"
  | "Water storage tank"
  | "Booster pump set"
  | "Water heater"
  | "Inspection chamber"
  | "Septic tank"
  | "Soakaway"
  | "Fire hose reel"
  | "Gate valve";

export interface PlumbingType extends Phase2Identified {
  item: PlumbingItem;
  size: string;
  unit: "m" | "No.";
}

interface LevelledPlacement {
  id: string;
  level: string;
  type: string;
  ref?: string;
}

export interface MasonryPlacement extends LevelledPlacement {
  pos: "External" | "Internal";
  len: NumericInput;
  h: NumericInput;
  op: NumericInput;
  opn: NumericInput;
  opw: NumericInput;
  f1: string;
  f2: string;
}
export interface WallFinishPlacement extends LevelledPlacement {
  area: NumericInput;
}
export interface RoomFinishPlacement extends LevelledPlacement {
  room: string;
  cf: string;
  area: NumericInput;
  perim: NumericInput;
  doors: NumericInput;
  no: NumericInput;
}
export interface ElectricalPointPlacement extends LevelledPlacement {
  no: NumericInput;
}
export interface QuantityPlacement extends LevelledPlacement {
  qty: NumericInput;
}
export interface SanitaryPlacement extends LevelledPlacement {
  no: NumericInput;
}

export interface Phase2Types {
  masonry?: readonly MasonryType[];
  wfin?: readonly WallFinishType[];
  ffin?: readonly FloorFinishType[];
  cfin?: readonly CeilingFinishType[];
  elec?: readonly ElectricalPointType[];
  elecgear?: readonly ElectricalGearType[];
  sanit?: readonly SanitaryType[];
  plumb?: readonly PlumbingType[];
}

export interface Phase2Placements {
  masonry?: readonly MasonryPlacement[];
  wfin?: readonly WallFinishPlacement[];
  ffin?: readonly RoomFinishPlacement[];
  elec?: readonly ElectricalPointPlacement[];
  elecgear?: readonly QuantityPlacement[];
  sanit?: readonly SanitaryPlacement[];
  plumb?: readonly QuantityPlacement[];
}

export interface Phase2Project {
  types: Phase2Types;
  pl: Phase2Placements;
}

export interface Phase2MeasureContext {
  loc: string;
  lvl: number;
  el: "Masonry" | "Finishes" | "Electrical" | "Plumbing";
  pid: string;
  tid: string;
  grp?: "LINT";
  member?: string;
  members?: number;
  markIndex?: number;
}

export type Phase2Add = (
  context: Phase2MeasureContext,
  code: string,
  times: number,
  d1: number | null,
  d2: number | null,
  d3: number | null,
) => void;
export type Phase2Bar = (
  context: Phase2MeasureContext,
  shape: string,
  diameter: NumericInput,
  each: number,
  length: number,
) => void;

export type Phase2LevelIndex =
  | ReadonlyMap<string, number>
  | Readonly<Record<string, number>>;

export interface Phase2ComputeOptions {
  project: Phase2Project;
  add: Phase2Add;
  bar: Phase2Bar;
  nB: (width: number, spacingMm: NumericInput) => number;
  levels: readonly Level[];
  levelIndex: Phase2LevelIndex;
  kinds: readonly string[];
  warn: string[];
  byType: Record<string, TypeStats>;
}

export type Phase2IdFactory = () => string;

export interface FinishesDefaults {
  types: {
    masonry: MasonryType[];
    wfin: WallFinishType[];
    ffin: FloorFinishType[];
    cfin: CeilingFinishType[];
  };
  placements: {
    masonry: MasonryPlacement[];
    wfin: WallFinishPlacement[];
    ffin: RoomFinishPlacement[];
  };
}

export interface MEPDefaults {
  types: {
    elec: ElectricalPointType[];
    elecgear: ElectricalGearType[];
    sanit: SanitaryType[];
    plumb: PlumbingType[];
  };
  placements: {
    elec: ElectricalPointPlacement[];
    elecgear: QuantityPlacement[];
    sanit: SanitaryPlacement[];
    plumb: QuantityPlacement[];
  };
}
