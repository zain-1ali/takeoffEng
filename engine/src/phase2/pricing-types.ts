import type {
  BuildingType,
  CatalogueEntry,
  ComputeResult,
  Grades,
  NumericInput,
} from "../types.js";

export type ResourceCategory = "Labour" | "Material" | "Plant" | "Subcontract";

export interface Resource {
  code: string;
  category: ResourceCategory;
  name: string;
  unit: string;
  rate: number;
  note: string;
}

export interface RecipeLine {
  resourceCode: string;
  quantity: number;
  note: string;
}

export interface Recipe {
  family: string;
  lines: RecipeLine[];
  note: string;
}

export interface CustomRate {
  lines: RecipeLine[];
}

export interface MaterialFactors {
  readymix: boolean;
  concWaste: number;
  steelWaste: number;
  stock: number;
  wire: number;
  meshLap: number;
  meshWaste: number;
  uses: number;
  fwWaste: number;
  timber: number;
  nails: number;
  compact: number;
  att: number;
  aggWaste: number;
  asWaste: number;
  prime: number;
  tack: number;
  bitWaste: number;
  pipeLen: number;
  paint: number;
}

export interface ConcreteMix {
  cem: number;
  sand: number;
  agg: number;
}

export interface MasonryType {
  mat: "Hollow concrete block" | "Solid concrete block" | "Burnt clay brick" | "Stone";
  t: NumericInput;
  uL: NumericInput;
  uH: NumericInput;
  joint: NumericInput;
  mortar: string;
}

export type FloorFinishName =
  | "Porcelain tiles" | "Ceramic tiles" | "Terrazzo" | "Timber flooring"
  | "Vinyl sheet" | "Epoxy coating" | "Carpet tiles" | "Power-floated concrete";

export interface FloorFinishType {
  mark: string;
  fin: FloorFinishName;
  skm: "Matching tile" | "Timber" | "PVC" | "None";
  skh: NumericInput;
}

export type CeilingKind =
  | "Gypsum board suspended ceiling" | "Mineral fibre tile suspended ceiling"
  | "Plaster and paint to soffit" | "Paint to fair-faced soffit"
  | "PVC ceiling panels" | "T&G timber ceiling";

export interface CeilingType {
  mark: string;
  kind: CeilingKind;
}

export interface ElectricalType {
  mark: string;
  cat: string;
  cable: string;
  conduit: string;
  run: NumericInput;
}

export interface ElectricalGearType {
  mark: string;
  item: string;
  unit: string;
}

export interface SanitaryType {
  mark: string;
  fx: string;
  cold: boolean;
  hot: boolean;
}

export interface PlumbingType {
  mark: string;
  item: string;
  size: string;
  unit: string;
}

export type RoofCover =
  | "Pre-painted IT4 iron sheets" | "Galvanised corrugated iron sheets"
  | "Stone-coated steel tiles" | "Clay roof tiles" | "Concrete roof tiles"
  | "Torch-on bituminous membrane" | "Liquid-applied waterproofing";

export interface RoofType {
  mark: string;
  cover: RoofCover;
  struct: "Steel trusses" | "Timber trusses" | "None – concrete slab";
  ps: NumericInput;
  ins: "None" | "Foil-backed insulation" | "Glass wool 50 mm" | "Rigid PIR board 50 mm";
}

export interface RoofTruss {
  mark: string;
  span: NumericInput;
  wt: NumericInput;
}

export interface RecipeTypes {
  masonry?: readonly MasonryType[];
  ffin?: readonly FloorFinishType[];
  cfin?: readonly CeilingType[];
  elec?: readonly ElectricalType[];
  elecgear?: readonly ElectricalGearType[];
  sanit?: readonly SanitaryType[];
  plumb?: readonly PlumbingType[];
  roof?: readonly RoofType[];
  rpave?: readonly {
    id: string;
    acw: NumericInput;
    acb: NumericInput;
    dens: NumericInput;
  }[];
  rculv?: readonly { dia: NumericInput }[];
}

export interface PricingContext {
  project: {
    btype: BuildingType;
    grades: Grades;
    sog?: { sand: NumericInput; mesh: string };
    project?: { currency: string };
    bacc?: { surfT: NumericInput };
  };
  resources: readonly Resource[];
  factors?: Partial<MaterialFactors>;
  mixes?: Readonly<Record<number, ConcreteMix>>;
  customRates?: Readonly<Record<string, CustomRate>>;
  recipeTypes?: RecipeTypes;
  roofTrusses?: readonly RoofTruss[];
  databankCurrency?: string;
  projectCurrency?: string;
  fxRate?: number;
  toolsPct?: number;
  overheadPct?: number;
  profitPct?: number;
}

export interface AnalysisRow extends RecipeLine {
  index: number;
  resource: Resource | null;
  cost: number;
}

export type CategoryTotals = Record<ResourceCategory, number>;

export interface RateAnalysis {
  code: string;
  family: string;
  note: string;
  custom: boolean;
  rows: AnalysisRow[];
  categories: CategoryTotals;
  tools: number;
  direct: number;
  overheads: number;
  profit: number;
  rate: number;
  missing: string[];
}

export interface BoqSectionRow { sec: string }
export interface BoqItemRow {
  item: string;
  code: string;
  desc: string;
  unit: CatalogueEntry["unit"];
  quantity: number;
  rate: number;
  manualRate: number | undefined;
  amount: number;
}
export type BoqRow = BoqSectionRow | BoqItemRow;

export interface BoqBill {
  title: string;
  amount: number;
  itemCount: number;
}

export interface BoqTotals {
  rows: BoqRow[];
  items: BoqItemRow[];
  bills: BoqBill[];
  subtotal: number;
  contingency: number;
  tax: number;
  total: number;
}

export interface BomSectionRow { sec: string }
export interface BomItemRow {
  code: string;
  material: string;
  specification: string;
  unit: string;
  net: number;
  waste: number;
  order: number;
  displayDecimals: number;
  orderDecimals: number;
  rate: number | undefined;
  manualRate: number | undefined;
  amount: number;
}
export type BomRow = BomSectionRow | BomItemRow;

export interface BomContext extends PricingContext {
  result: ComputeResult;
  manualMaterialRates?: Readonly<Record<string, number>>;
}

export function isBoqItem(row: BoqRow): row is BoqItemRow {
  return "code" in row;
}

export function isBomItem(row: BomRow): row is BomItemRow {
  return "code" in row;
}
