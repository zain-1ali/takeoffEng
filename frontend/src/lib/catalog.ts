export const CURRENCIES: readonly [string, string][] = [
  ["USD", "US dollar"],
  ["EUR", "Euro"],
  ["GBP", "Pound sterling"],
  ["RWF", "Rwandan franc"],
  ["KES", "Kenyan shilling"],
  ["UGX", "Ugandan shilling"],
  ["TZS", "Tanzanian shilling"],
  ["BIF", "Burundian franc"],
  ["ETB", "Ethiopian birr"],
  ["NGN", "Nigerian naira"],
  ["GHS", "Ghanaian cedi"],
  ["ZAR", "South African rand"],
  ["ZMW", "Zambian kwacha"],
  ["MWK", "Malawian kwacha"],
  ["MZN", "Mozambican metical"],
  ["XOF", "West African CFA franc"],
  ["XAF", "Central African CFA franc"],
  ["EGP", "Egyptian pound"],
  ["MAD", "Moroccan dirham"],
  ["AED", "UAE dirham"],
  ["SAR", "Saudi riyal"],
  ["QAR", "Qatari riyal"],
  ["INR", "Indian rupee"],
  ["PKR", "Pakistani rupee"],
  ["BDT", "Bangladeshi taka"],
  ["CNY", "Chinese yuan"],
  ["JPY", "Japanese yen"],
  ["SGD", "Singapore dollar"],
  ["MYR", "Malaysian ringgit"],
  ["PHP", "Philippine peso"],
  ["IDR", "Indonesian rupiah"],
  ["AUD", "Australian dollar"],
  ["NZD", "New Zealand dollar"],
  ["CAD", "Canadian dollar"],
  ["MXN", "Mexican peso"],
  ["BRL", "Brazilian real"],
  ["CHF", "Swiss franc"],
  ["SEK", "Swedish krona"],
  ["NOK", "Norwegian krone"],
  ["PLN", "Polish złoty"],
  ["TRY", "Turkish lira"],
  ["OTHER", "Other – type a code"],
];

export const NUMBER_FORMATS: readonly [string, string][] = [
  ["en-GB", "1,234,567.89"],
  ["de-DE", "1.234.567,89"],
  ["fr-FR", "1 234 567,89"],
  ["de-CH", "1’234’567.89"],
  ["en-IN", "12,34,567.89"],
];

export const STAGE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "CONCEPT", label: "Concept estimate" },
  { value: "PRE_TENDER", label: "Pre-tender estimate" },
  { value: "TENDER", label: "Tender documents" },
  { value: "CONTRACT", label: "Contract documents" },
  { value: "VALUATION", label: "Interim valuation" },
  { value: "FINAL_ACCOUNT", label: "Final account" },
];

export const BUILDING_TYPES = [
  {
    id: "FOUNDATION" as const,
    group: "Buildings",
    label: "Foundations only",
    blurb: "Footings, ground beams and ground slab. For boundary walls, tanks, bases and plinths.",
  },
  {
    id: "SINGLE" as const,
    group: "Buildings",
    label: "Single storey",
    blurb: "Foundations plus one level of columns, beams, roof slab and walls.",
  },
  {
    id: "MULTI" as const,
    group: "Buildings",
    label: "Multi-storey",
    blurb: "All levels, staircases and lift cores.",
  },
  {
    id: "ROAD" as const,
    group: "Civil works",
    label: "Road",
    blurb: "Chainage-based earthworks, pavement layers, side drains, pipe culverts and road furniture.",
  },
  {
    id: "BRIDGE" as const,
    group: "Civil works",
    label: "Concrete bridge",
    blurb: "Footings, pier columns, abutments and wingwalls, girders, deck and approach slabs, bearings and finishes.",
  },
];

export type BuildingTypeId = (typeof BUILDING_TYPES)[number]["id"];

export const STARTER_TYPES: readonly BuildingTypeId[] = ["FOUNDATION", "SINGLE"];

export const MEASUREMENT_STANDARDS: readonly { value: string; label: string; hint: string }[] = [
  { value: "NRM2", label: "NRM2", hint: "Buildings – New Rules of Measurement" },
  { value: "CESMM4", label: "CESMM4", hint: "Civil engineering – roads and bridges" },
  { value: "CUSTOM", label: "Your own standard", hint: "Name it on the next field" },
];

export function buildingTypeLabel(id: string): string {
  return BUILDING_TYPES.find((item) => item.id === id)?.label ?? id;
}

export function stageLabel(value: string): string {
  return STAGE_OPTIONS.find((item) => item.value === value)?.label ?? value;
}

export function defaultStandard(type: BuildingTypeId): string {
  return type === "ROAD" || type === "BRIDGE" ? "CESMM4" : "NRM2";
}

export function isAllowedType(type: string, allowed: readonly string[] | null | undefined): boolean {
  if (!allowed || allowed.length === 0) return STARTER_TYPES.includes(type as BuildingTypeId);
  return allowed.includes(type);
}
