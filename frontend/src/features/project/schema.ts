import {
  createBridgeDefaults,
  createCompleteBuildingExample,
  createMultiStoreyExample,
  createRoofXDefaults,
  createRoadDefaults,
  DEFAULT_MATERIAL_FACTORS,
  n,
  type RoofType,
} from "@takeoff/engine";
import { asList, asRecord, stringOf, uid, type DocMap } from "../../lib/doc.js";

export type FieldKind = "text" | "num" | "dia" | "bool" | "sel";
export type TypeField = readonly [key: string, label: string, kind: FieldKind, extra?: string | readonly string[], step?: number];
export type TypeGroup = readonly [name: string, hint: string, fields: readonly TypeField[]];
export type PlKind = "type" | "ftype" | "sel" | "text" | "num";
export type PlField = readonly [key: string, label: string, kind: PlKind, extra?: string | readonly string[]];

const beam: readonly TypeGroup[] = [
  ["Section", "Overall depth incl. slab", [["mark", "Mark", "text"], ["b", "Width", "num", "mm", 25], ["h", "Depth", "num", "mm", 25]]],
  ["Bottom bars", "Continuous", [["botN", "No.", "num", "No.", 1], ["botD", "Bar", "dia"]]],
  ["Top bars", "Continuous", [["topN", "No.", "num", "No.", 1], ["topD", "Bar", "dia"]]],
  ["Extra top at supports", "Each end", [["extN", "No. each end", "num", "No.", 1], ["extD", "Bar", "dia"], ["extF", "Length", "num", "× span", 0.05]]],
  ["Side bars", "Total both faces", [["sideN", "No.", "num", "No.", 2], ["sideD", "Bar", "dia"]]],
  ["Links", "Closer spacing at ends", [["lkd", "Bar", "dia"], ["lks", "Mid spacing", "num", "mm", 25], ["lksEnd", "End spacing", "num", "mm", 25], ["ez", "End zone each end", "num", "m", 0.1]]],
];
const column: readonly TypeGroup[] = [
  ["Section", "", [["mark", "Mark", "text"], ["b", "Width b", "num", "mm", 25], ["d", "Depth d", "num", "mm", 25]]],
  ["Main bars", "Lapped at each floor", [["nb", "No. of bars", "num", "No.", 2], ["dia", "Bar", "dia"]]],
  ["Links", "Closer spacing at ends", [["lkd", "Bar", "dia"], ["lks", "Mid spacing", "num", "mm", 25], ["lksEnd", "End spacing", "num", "mm", 25], ["ez", "End zone each end", "num", "m", 0.1]]],
];
const slab: readonly TypeGroup[] = [
  ["Slab", "", [["mark", "Mark", "text"], ["t", "Thickness", "num", "mm", 25]]],
  ["Bottom X", "Bars along panel length", [["bxd", "Bar", "dia"], ["bxs", "Spacing", "num", "mm", 25]]],
  ["Bottom Y", "Bars along panel width", [["byd", "Bar", "dia"], ["bys", "Spacing", "num", "mm", 25]]],
  ["Top reinforcement", "Over supports = 0.25 span each side", [["topMode", "Arrangement", "sel", ["none", "supports", "full"]], ["txd", "Top X bar", "dia"], ["txs", "X spacing", "num", "mm", 25], ["tyd", "Top Y bar", "dia"], ["tys", "Y spacing", "num", "mm", 25]]],
];
const wall: readonly TypeGroup[] = [
  ["Wall", "", [["mark", "Mark", "text"], ["t", "Thickness", "num", "mm", 25], ["faces", "Bar layers", "sel", ["1", "2"]]]],
  ["Vertical bars", "Per face", [["vd", "Bar", "dia"], ["vs", "Spacing", "num", "mm", 25]]],
  ["Horizontal bars", "Per face", [["hd", "Bar", "dia"], ["hs", "Spacing", "num", "mm", 25]]],
];

const EL_CATS = [
  "Lighting point – LED panel", "Lighting point – downlight", "Lighting point – batten",
  "Lighting point – exterior", "Emergency light", "Switch – one gang", "Switch – two gang",
  "Socket outlet – twin 13 A", "Power outlet – 20 A (AC or cooker)", "Data outlet Cat6",
  "TV outlet", "Smoke detector", "Manual call point",
] as const;
const EL_CABLE = ["1.5 mm² twin & earth", "2.5 mm² twin & earth", "4 mm² twin & earth", "6 mm² twin & earth", "Cat6 data", "Coaxial", "Fire-resistant 1.5 mm²"] as const;
const EL_COND = ["20 mm PVC conduit", "25 mm PVC conduit", "Surface trunking", "None"] as const;
const EL_GEAR = ["Distribution board", "Main switchboard", "Sub-main cable", "Cable tray", "Earthing system", "Lightning protection", "Changeover switch", "Energy meter"] as const;
const SAN_FX = ["WC suite", "Wash hand basin", "Urinal", "Shower", "Kitchen sink", "Bath", "Floor drain"] as const;
const PLB_ITEM = ["Cold water riser", "Hot water riser", "Soil and vent stack", "Rainwater downpipe", "Underground drain pipe", "Water storage tank", "Booster pump set", "Water heater", "Inspection chamber", "Septic tank", "Soakaway", "Fire hose reel", "Gate valve"] as const;

export const TYPE_SCHEMA: Record<string, readonly TypeGroup[]> = {
  pad: [
    ["Footing", "Plan size and depth", [["mark", "Mark", "text"], ["L", "Length", "num", "m", 0.05], ["W", "Width", "num", "m", 0.05], ["D", "Depth", "num", "m", 0.05], ["depth", "EGL to formation", "num", "m", 0.05]]],
    ["Stub column", "From top of pad to EGL", [["sb", "Stub b", "num", "mm", 25], ["sd", "Stub d", "num", "mm", 25], ["sh", "Stub height", "num", "m", 0.05]]],
    ["Bottom mat X", "Bars along length", [["bxd", "Bar", "dia"], ["bxs", "Spacing", "num", "mm", 25]]],
    ["Bottom mat Y", "Bars along width", [["byd", "Bar", "dia"], ["bys", "Spacing", "num", "mm", 25]]],
    ["Top mat", "Repeats bottom mat", [["top", "Provide top mat", "bool"]]],
    ["Starter bars", "Per footing", [["stn", "No. per footing", "num", "No.", 1], ["std", "Bar", "dia"], ["stl", "Length each", "num", "m", 0.1]]],
    ["Stub links", "", [["lkd", "Bar", "dia"], ["lks", "Spacing", "num", "mm", 25]]],
  ],
  strip: [
    ["Footing", "Section", [["mark", "Mark", "text"], ["B", "Width", "num", "m", 0.05], ["D", "Depth", "num", "m", 0.05], ["depth", "EGL to formation", "num", "m", 0.05]]],
    ["Transverse bars", "Across width", [["td", "Bar", "dia"], ["ts", "Spacing", "num", "mm", 25]]],
    ["Longitudinal bars", "Along length", [["ln", "No. of bars", "num", "No.", 1], ["ld", "Bar", "dia"]]],
  ],
  beam,
  gbeam: beam,
  column,
  slab,
  wall,
  stair: [
    ["Flight", "One flight and one landing", [["mark", "Mark", "text"], ["width", "Width", "num", "m", 0.05], ["going", "Going (plan)", "num", "m", 0.1], ["rise", "Rise per flight", "num", "m", 0.05], ["waist", "Waist", "num", "mm", 25], ["landing", "Landing depth", "num", "m", 0.1]]],
    ["Main bars", "Along flight", [["md", "Bar", "dia"], ["ms", "Spacing", "num", "mm", 25]]],
    ["Distribution bars", "Across flight", [["dd", "Bar", "dia"], ["ds", "Spacing", "num", "mm", 25]]],
  ],
  bfoot: [
    ["Footing", "Abutment or pier base", [["mark", "Mark", "text"], ["L", "Length", "num", "m", 0.05], ["W", "Width", "num", "m", 0.05], ["D", "Depth", "num", "m", 0.05], ["depth", "EGL to formation", "num", "m", 0.1]]],
    ["Bottom mat X", "Bars along length", [["bxd", "Bar", "dia"], ["bxs", "Spacing", "num", "mm", 25]]],
    ["Bottom mat Y", "Bars along width", [["byd", "Bar", "dia"], ["bys", "Spacing", "num", "mm", 25]]],
    ["Top mat", "Repeats bottom mat", [["top", "Provide top mat", "bool"]]],
    ["Starter bars", "Into pier or wall, per footing", [["stn", "No. per footing", "num", "No.", 1], ["std", "Bar", "dia"], ["stl", "Length each", "num", "m", 0.1]]],
  ],
  bpier: column,
  bbeam: beam,
  bslab: slab,
  bwall: wall,
  rpave: [
    ["Cross-section", "Widths", [["mark", "Mark", "text"], ["cw", "Carriageway", "num", "m", 0.25], ["sw", "Shoulder each side", "num", "m", 0.25], ["reserve", "Clearance width", "num", "m", 1]]],
    ["Surfacing", "Asphalt layers, 0 = none", [["acw", "Wearing course", "num", "mm", 5], ["acb", "Binder course", "num", "mm", 5], ["dens", "Asphalt density", "num", "t/m³", 0.05], ["sds", "Double seal to shoulders", "bool"]]],
    ["Granular layers", "Compacted thickness, 0 = none", [["base", "Crushed stone base", "num", "mm", 25], ["subb", "Gravel subbase", "num", "mm", 25], ["cap", "Improved subgrade", "num", "mm", 25]]],
    ["Earthworks", "Side slopes and topsoil", [["cs", "Cut slope", "num", "H:1V", 0.25], ["fs", "Fill slope", "num", "H:1V", 0.25], ["top", "Topsoil strip", "num", "mm", 25]]],
  ],
  rdrain: [
    ["Drain", "Trapezoidal section", [["mark", "Mark", "text"], ["b", "Bottom width", "num", "m", 0.05], ["d", "Depth", "num", "m", 0.05], ["s", "Side slope", "num", "H:1V", 0.25]]],
    ["Lining", "Concrete cast on earth", [["lined", "Concrete lined", "bool"], ["t", "Lining thickness", "num", "mm", 25], ["mesh", "Mesh reinforcement", "bool"]]],
  ],
  rculv: [
    ["Pipe", "", [["mark", "Mark", "text"], ["dia", "Internal diameter", "num", "mm", 150], ["bed", "Bedding thickness", "num", "mm", 25]]],
    ["Headwalls", "Two per culvert, bars both faces", [["hwW", "Width", "num", "m", 0.1], ["hwH", "Height", "num", "m", 0.1], ["hwT", "Thickness", "num", "mm", 25], ["vd", "Vertical bar", "dia"], ["vs", "Vertical spacing", "num", "mm", 25], ["hd", "Horizontal bar", "dia"], ["hs", "Horizontal spacing", "num", "mm", 25]]],
    ["Aprons", "Two per culvert, mesh reinforced", [["apL", "Length", "num", "m", 0.1], ["apW", "Width", "num", "m", 0.1], ["apT", "Thickness", "num", "mm", 25]]],
  ],
  masonry: [
    ["Walling", "Unit and wall thickness", [["mark", "Mark", "text"], ["mat", "Material", "sel", ["Hollow concrete block", "Solid concrete block", "Burnt clay brick", "Stone"]], ["t", "Wall thickness", "num", "mm", 25], ["uL", "Unit length", "num", "mm", 10], ["uH", "Unit height", "num", "mm", 5], ["joint", "Mortar joint", "num", "mm", 1]]],
    ["Mortar and reinforcement", "Brickforce 0 = none", [["mortar", "Mortar mix", "sel", ["1:3", "1:4", "1:6"]], ["bfc", "Brickforce every", "num", "courses", 1], ["dpc", "DPC at base on lowest level", "bool"]]],
    ["Lintels over openings", "In-situ reinforced concrete", [["lh", "Lintel depth", "num", "mm", 25], ["bear", "Bearing each end", "num", "m", 0.05], ["lbar", "Main bars", "dia"], ["llk", "Links", "dia"]]],
  ],
  wfin: [
    ["Wall finish", "Base coat and final finish", [["mark", "Mark", "text"], ["side", "Face", "sel", ["Internal", "External"]], ["base", "Base coat", "sel", ["Cement-sand plaster", "Cement-sand render", "Gypsum skim", "None"]], ["bt", "Base thickness", "num", "mm", 1], ["fin", "Finish", "sel", ["Emulsion paint", "Weatherproof paint", "Ceramic wall tiles", "Stone cladding", "No finish"]], ["coats", "Paint coats", "num", "No.", 1], ["tile", "Tile or cladding size", "text"]]],
  ],
  ffin: [
    ["Floor finish", "Screed and finish", [["mark", "Mark", "text"], ["screed", "Screed thickness", "num", "mm", 5], ["fin", "Finish", "sel", ["Porcelain tiles", "Ceramic tiles", "Terrazzo", "Timber flooring", "Vinyl sheet", "Epoxy coating", "Carpet tiles", "Power-floated concrete"]], ["tile", "Tile size", "text"]]],
    ["Skirting", "0 height = none", [["skm", "Skirting", "sel", ["Matching tile", "Timber", "PVC", "None"]], ["skh", "Skirting height", "num", "mm", 25]]],
  ],
  cfin: [
    ["Ceiling finish", "", [["mark", "Mark", "text"], ["kind", "System", "sel", ["Gypsum board suspended ceiling", "Mineral fibre tile suspended ceiling", "Plaster and paint to soffit", "Paint to fair-faced soffit", "PVC ceiling panels", "T&G timber ceiling"]], ["bt", "Plaster thickness", "num", "mm", 1], ["coats", "Paint coats", "num", "No.", 1], ["drop", "Suspension drop", "num", "mm", 50]]],
  ],
  elec: [
    ["Point", "Device, cable and containment", [["mark", "Mark", "text"], ["cat", "Point", "sel", EL_CATS], ["desc", "Specification", "text"], ["cable", "Cable", "sel", EL_CABLE], ["conduit", "Containment", "sel", EL_COND], ["run", "Average run per point", "num", "m", 1]]],
  ],
  elecgear: [
    ["Item", "Distribution, containment and protection", [["mark", "Mark", "text"], ["item", "Item", "sel", EL_GEAR], ["spec", "Specification", "text"], ["unit", "Unit", "sel", ["No.", "m", "item"]]]],
  ],
  sanit: [
    ["Fitting", "", [["mark", "Mark", "text"], ["fx", "Fitting", "sel", SAN_FX], ["spec", "Specification", "text"]]],
    ["Water supply", "Pipe run from riser or branch", [["cold", "Cold water", "bool"], ["hot", "Hot water", "bool"], ["sdia", "Supply pipe", "sel", ["20", "25", "32"]], ["srun", "Supply run each", "num", "m", 0.5]]],
    ["Waste", "", [["wdia", "Waste pipe", "sel", ["32", "40", "50", "110"]], ["wrun", "Waste run each", "num", "m", 0.5]]],
  ],
  plumb: [
    ["Item", "Risers, stacks, drainage and plant", [["mark", "Mark", "text"], ["item", "Item", "sel", PLB_ITEM], ["size", "Size or capacity", "text"], ["unit", "Unit", "sel", ["m", "No."]]]],
  ],
  roof: [
    ["Roof", "Form and covering", [
      ["mark", "Mark", "text"],
      ["form", "Roof form", "sel", ["Pitched – hip", "Pitched – gable", "Mono-pitch", "Flat concrete slab"]],
      ["cover", "Covering", "sel", [
        "Pre-painted IT4 iron sheets",
        "Galvanised corrugated iron sheets",
        "Stone-coated steel tiles",
        "Clay roof tiles",
        "Concrete roof tiles",
        "Torch-on bituminous membrane",
        "Liquid-applied waterproofing",
      ]],
      ["spec", "Specification", "text"],
      ["pitch", "Pitch", "num", "°", 2.5],
      ["overhang", "Eaves overhang", "num", "m", 0.05],
    ]],
    ["Structure", "Trusses and purlins or battens", [
      ["struct", "Structure", "sel", ["Steel trusses", "Timber trusses", "None – concrete slab"]],
      ["ts", "Truss spacing", "num", "m", 0.1],
      ["ps", "Purlin / batten spacing", "num", "mm", 50],
    ]],
    ["Insulation, falls and rainwater", "Screed to falls applies to flat roofs", [
      ["ins", "Insulation", "sel", ["None", "Foil-backed insulation", "Glass wool 50 mm", "Rigid PIR board 50 mm"]],
      ["falls", "Screed to falls (average)", "num", "mm", 5],
      ["gutter", "Eaves gutters", "bool"],
      ["fascia", "Fascia and barge boards", "bool"],
    ]],
  ],
};

export const PL_SCHEMA: Record<string, readonly PlField[]> = {
  pad: [["type", "Footing", "type"], ["no", "No.", "num"], ["ref", "Grid / location", "text"]],
  strip: [["type", "Footing", "type"], ["len", "Length", "num", "m"], ["no", "No.", "num"], ["ref", "Location", "text"]],
  gbeam: [["type", "Beam", "type"], ["span", "Clear span", "num", "m"], ["no", "No.", "num"], ["ref", "Grid / location", "text"]],
  column: [["type", "Column", "type"], ["no", "No.", "num"], ["h", "Height (blank = auto)", "num", "m"], ["ref", "Grid / location", "text"]],
  beam: [["type", "Beam", "type"], ["span", "Clear span", "num", "m"], ["no", "No.", "num"], ["ref", "Grid / location", "text"]],
  slab: [["type", "Slab", "type"], ["L", "Panel L", "num", "m"], ["W", "Panel W", "num", "m"], ["bw", "Support width", "num", "m"], ["no", "No.", "num"], ["less", "Less openings", "num", "m²"], ["edge", "Free edge", "num", "m"], ["ref", "Location", "text"]],
  wall: [["type", "Wall", "type"], ["len", "Length", "num", "m"], ["h", "Height (blank = auto)", "num", "m"], ["op", "Openings", "num", "m²"], ["ref", "Location", "text"]],
  stair: [["type", "Stair", "type"], ["flights", "Flights", "num"], ["landings", "Landings", "num"], ["ref", "Location", "text"]],
  bfoot: [["type", "Footing", "type"], ["part", "Part", "sel", ["Abutment", "Pier"]], ["no", "No.", "num"], ["ref", "Location", "text"]],
  bpier: [["type", "Pier column", "type"], ["h", "Height", "num", "m"], ["no", "No.", "num"], ["ref", "Location", "text"]],
  bwall: [["type", "Wall", "type"], ["part", "Part", "sel", ["Abutment wall", "Wingwall", "Ballast wall", "Parapet"]], ["len", "Length", "num", "m"], ["h", "Height", "num", "m"], ["no", "No.", "num"], ["ref", "Location", "text"]],
  bbeam: [["type", "Beam", "type"], ["part", "Part", "sel", ["Girder", "Crosshead", "Diaphragm"]], ["span", "Length", "num", "m"], ["no", "No.", "num"], ["ref", "Location", "text"]],
  bslab: [["type", "Slab", "type"], ["part", "Part", "sel", ["Deck slab", "Approach slab"]], ["L", "Length", "num", "m"], ["W", "Width", "num", "m"], ["no", "No.", "num"], ["ref", "Location", "text"]],
  rpave: [["type", "Section", "type"], ["from", "From ch.", "num", "m"], ["to", "To ch.", "num", "m"], ["cut", "Avg cut", "num", "m"], ["fill", "Avg fill", "num", "m"], ["ref", "Description", "text"]],
  rdrain: [["type", "Drain", "type"], ["len", "Length", "num", "m"], ["sides", "Sides", "num"], ["ref", "Location", "text"]],
  rculv: [["type", "Culvert", "type"], ["len", "Pipe length", "num", "m"], ["lines", "Lines", "num"], ["no", "No.", "num"], ["depth", "Trench depth", "num", "m"], ["ref", "Chainage", "text"]],
  masonry: [["type", "Wall", "type"], ["pos", "Position", "sel", ["External", "Internal"]], ["len", "Length", "num", "m"], ["h", "Height (blank = auto)", "num", "m"], ["op", "Openings area", "num", "m²"], ["opn", "Openings", "num"], ["opw", "Avg width", "num", "m"], ["f1", "Finish face 1", "ftype", "wfin"], ["f2", "Finish face 2", "ftype", "wfin"], ["ref", "Location", "text"]],
  wfin: [["type", "Wall finish", "type"], ["area", "Area", "num", "m²"], ["ref", "Surface / location", "text"]],
  ffin: [["room", "Room / area", "text"], ["type", "Floor finish", "type"], ["cf", "Ceiling finish", "ftype", "cfin"], ["area", "Floor area", "num", "m²"], ["perim", "Perimeter", "num", "m"], ["doors", "Less door widths", "num", "m"], ["no", "No.", "num"], ["ref", "Notes", "text"]],
  elec: [["type", "Point", "type"], ["no", "No.", "num"], ["ref", "Room / area", "text"]],
  elecgear: [["type", "Item", "type"], ["qty", "Quantity", "num"], ["ref", "Location", "text"]],
  sanit: [["type", "Fitting", "type"], ["no", "No.", "num"], ["ref", "Room / area", "text"]],
  plumb: [["type", "Item", "type"], ["qty", "Quantity", "num"], ["ref", "Location", "text"]],
  roof: [["type", "Roof", "type"], ["L", "Plan length", "num", "m"], ["W", "Plan width / span", "num", "m"], ["no", "No.", "num"], ["ref", "Location", "text"]],
};

export const KIND_LABEL: Record<string, string> = {
  pad: "Pad footings", strip: "Strip footings", gbeam: "Ground beams & slab", column: "Columns",
  beam: "Beams", slab: "Slabs", wall: "Walls", stair: "Staircases",
  bfoot: "Bridge footings", bpier: "Pier columns", bwall: "Abutments & walls",
  bbeam: "Girders & crossheads", bslab: "Deck & approach slabs",
  rpave: "Road sections", rdrain: "Side drains", rculv: "Culverts",
  masonry: "Masonry walls", wfin: "Wall finishes", ffin: "Floor finishes & rooms", cfin: "Ceiling finishes",
  elec: "Electrical points", elecgear: "Electrical distribution", sanit: "Sanitary fittings", plumb: "Plumbing pipework & plant",
  roof: "Roofing",
};

export const KIND_INTRO: Record<string, string> = {
  pad: "Schedule each footing type with its full reinforcement, then enter how many of each occur.",
  strip: "Strip footing types with transverse and longitudinal bars, and the run lengths where they occur.",
  gbeam: "Ground beam types (same detail as frame beams) with their spans, plus the ground-bearing slab.",
  column: "Column types with main bars and links. Enter where each type occurs on every level.",
  beam: "Beam types with bottom, top, support and side bars and links. Each row is a group of identical spans on a level.",
  slab: "Slab types with bottom and top reinforcement. Each row is a group of identical panels, centre-to-centre of supports.",
  wall: "Wall types with vertical and horizontal bars. Enter the length on each level.",
  stair: "Staircase types. Enter the number of flights and landings on each level.",
  masonry: "Block, brick and stone walls by type and thickness. Each row is a run of wall on a level.",
  wfin: "Plaster, render, paint, tiling and cladding types. Masonry faces pick these up automatically.",
  ffin: "Floor finish types and the room finishes schedule: floor area, perimeter and ceiling finish.",
  cfin: "Ceiling finish types. Assign them to rooms in Floor finishes & rooms.",
  elec: "Lighting, power, data and fire alarm points measured by number.",
  elecgear: "Distribution boards, switchboards, sub-mains, cable tray, earthing and lightning protection.",
  sanit: "Sanitary fitting types with their water supply and waste connections.",
  plumb: "Risers, stacks, drainage, tanks, pumps and fire hose reels.",
  bfoot: "Abutment and pier footing types with mats and starters.",
  bpier: "Pier column types with main bars and links, and their heights.",
  bwall: "Wall types used for abutments, wingwalls, ballast walls and parapets.",
  bbeam: "Girders, crossheads and diaphragms, each with full beam reinforcement.",
  bslab: "Deck and approach slab types with bottom and top reinforcement.",
  rpave: "Pavement section types. Each row is a chainage length with its average cut or fill.",
  rdrain: "Side drain profiles, lined or unlined, with the lengths where they occur.",
  rculv: "Pipe culvert types with bedding, headwalls and aprons.",
  roof: "Set up roof types (form, covering, pitch, structure, insulation), then pick how to measure: simple rectangular roofs, or complex roofs plane by plane with ridges, hips, valleys, openings and a truss schedule. Only the method you pick is measured.",
};

export const LEVELLED = new Set([
  "column", "beam", "slab", "wall", "stair", "masonry", "wfin", "ffin", "elec", "elecgear", "sanit", "plumb",
]);

export const NO_CONC_STEEL = new Set(["wfin", "ffin", "elec", "elecgear", "sanit", "plumb", "cfin", "roof"]);

export const FIN_QTY_KINDS = new Set([
  "masonry", "wfin", "ffin", "cfin", "elec", "elecgear", "sanit", "plumb", "roof",
]);

export const NAV_INPUTS: readonly [string, string][] = [
  ["project", "Project & type"],
  ["rpave", "Road sections"], ["rdrain", "Side drains"], ["rculv", "Culverts"], ["rfurn", "Road furniture"],
  ["bfoot", "Bridge footings"], ["bpier", "Pier columns"], ["bwall", "Abutments & walls"],
  ["bbeam", "Girders & crossheads"], ["bslab", "Deck & approach slabs"], ["bacc", "Bearings & finishes"],
  ["levels", "Levels"],
  ["pad", "Pad footings"], ["strip", "Strip footings"], ["gbeam", "Ground beams & slab"],
  ["column", "Columns"], ["beam", "Beams"], ["slab", "Slabs"], ["wall", "Walls"], ["stair", "Staircases"],
  ["roof", "Roofing"],
  ["masonry", "Masonry walls"], ["wfin", "Wall finishes"], ["ffin", "Floor finishes & rooms"], ["cfin", "Ceiling finishes"],
  ["elec", "Electrical points"], ["elecgear", "Electrical distribution"], ["sanit", "Sanitary fittings"], ["plumb", "Plumbing pipework & plant"],
  ["rules", "Covers & rules"],
];

export const NAV_PRICING: readonly [string, string][] = [
  ["rates", "Rate analysis"],
  ["resources", "Resource databank"],
];

export const NAV_REPORTS: readonly [string, string][] = [
  ["summary", "Dashboard"],
  ["boq", "Bills of quantities"],
  ["bom", "Bill of materials"],
  ["rareport", "Rate analysis report"],
  ["bbs", "Bar schedule"],
  ["dims", "Dimension sheet"],
];

export const LATER: Record<string, string> = {
  team: "Team workspace ships in Phase 11.",
};

export const BTYPE_LABEL: Record<string, string> = {
  foundation: "Foundations only",
  single: "Single storey",
  multi: "Multi-storey",
  road: "Road",
  bridge: "Concrete bridge",
};

export function engineType(apiType: string): string {
  return apiType.toLowerCase();
}

export function kindsVisible(btype: string): string[] {
  if (btype === "road") return ["rpave", "rdrain", "rculv"];
  if (btype === "bridge") return ["bfoot", "bpier", "bwall", "bbeam", "bslab"];
  const kinds = ["pad", "strip", "gbeam"];
  if (btype !== "foundation") {
    kinds.push("column", "beam", "slab", "wall", "roof", "masonry", "wfin", "ffin", "cfin", "elec", "elecgear", "sanit", "plumb");
  }
  if (btype === "multi") kinds.push("stair");
  return kinds;
}

export function visibleInputSteps(btype: string): readonly [string, string][] {
  const kinds = kindsVisible(btype);
  return NAV_INPUTS.filter(([view]) => (
    view === "project"
    || view === "rules"
    || (view === "levels" && btype === "multi")
    || (view === "rfurn" && btype === "road")
    || (view === "bacc" && btype === "bridge")
    || kinds.includes(view)
  ));
}

export function hasSidePanel(view: string): boolean {
  return Boolean(TYPE_SCHEMA[view]) || ["project", "levels", "rules", "rfurn", "bacc"].includes(view);
}

export function activeLevels(doc: DocMap): DocMap[] {
  const btype = stringOf(doc.btype, "multi");
  const levels = asList(doc.levels);
  if (btype === "multi") return levels;
  if (btype === "single") return levels.slice(0, 1);
  return [];
}

export function typeSummary(kind: string, type: DocMap): string {
  const fmt = (value: unknown) => {
    const num = n((value ?? 0) as number | string);
    return Number.isFinite(num) ? String(Math.round(num * 100) / 100) : "";
  };
  const mapped = ({ bfoot: "pad", bpier: "column", bbeam: "beam", bslab: "slab", bwall: "wall" } as Record<string, string>)[kind] ?? kind;
  switch (mapped) {
    case "pad": return `${fmt(type.L)}×${fmt(type.W)} m`;
    case "strip": return `${fmt(type.B)}×${fmt(type.D)} m`;
    case "column": return `${type.b}×${type.d} · ${type.nb}Y${type.dia}`;
    case "beam":
    case "gbeam": return `${type.b}×${type.h} · ${type.botN}Y${type.botD}`;
    case "slab": return `${type.t} mm · Y${type.bxd}@${type.bxs}`;
    case "wall": return `${type.t} mm · Y${type.vd}@${type.vs}`;
    case "stair": return `${fmt(type.width)} m wide`;
    case "rpave": return `${fmt(type.cw)} + 2×${fmt(type.sw)} m`;
    case "rdrain": return `${fmt(type.b)}×${fmt(type.d)} m`;
    case "rculv": return `Ø${type.dia} mm`;
    case "roof": {
      const form = stringOf(type.form).replace("Pitched – ", "");
      const cover = stringOf(type.cover).replace(" iron sheets", " sheets").replace("Torch-on ", "");
      const pitch = stringOf(type.form).startsWith("Flat") ? "" : ` · ${fmt(type.pitch)}°`;
      return `${form} · ${cover}${pitch}`;
    }
    default: return stringOf(type.mark);
  }
}

export function blankType(kind: string): DocMap {
  const row: DocMap = { id: uid("t"), mark: "T1" };
  for (const group of TYPE_SCHEMA[kind] ?? []) {
    for (const [key, , fieldKind, extra] of group[2]) {
      if (key === "mark") continue;
      if (fieldKind === "text") row[key] = "";
      else if (fieldKind === "bool") row[key] = false;
      else if (fieldKind === "sel") row[key] = Array.isArray(extra) ? extra[0] : "";
      else if (fieldKind === "dia") row[key] = 12;
      else row[key] = 0;
    }
  }
  return row;
}

export function blankRow(kind: string, doc: DocMap, selectedTypeId?: string, levelId?: string): DocMap {
  const types = asList(asRecord(doc.types)[kind]);
  const typeId = selectedTypeId || stringOf(types[0]?.id);
  const row: DocMap = { id: uid("p"), type: typeId };
  for (const [key, , fieldKind, extra] of PL_SCHEMA[kind] ?? []) {
    if (key === "type") continue;
    if (fieldKind === "text") row[key] = "";
    else if (fieldKind === "ftype") {
      const others = asList(asRecord(doc.types)[String(extra)]);
      row[key] = others[0]?.id ?? "";
    } else if (fieldKind === "sel") row[key] = Array.isArray(extra) ? extra[0] : "";
    else if (["no", "flights", "landings", "lines", "sides"].includes(key)) row[key] = 1;
    else if (key === "bw") row[key] = 0.3;
    else if (key === "h" && LEVELLED.has(kind)) row[key] = "";
    else row[key] = 0;
  }
  if (LEVELLED.has(kind)) row.level = levelId || stringOf(activeLevels(doc)[0]?.id);
  if (kind === "rpave") {
    const last = asList(asRecord(doc.pl).rpave).at(-1);
    if (last) {
      row.from = n((last.to ?? 0) as number | string);
      row.to = n((last.to ?? 0) as number | string) + 500;
    }
  }
  return row;
}

export function addType(doc: DocMap, kind: string, selectedIndex: number): { doc: DocMap; index: number } {
  const next = structuredClone(doc);
  const types = asList(asRecord(next.types)[kind]);
  const src = types[selectedIndex] ?? types[0];
  const created = src ? { ...src, id: uid("t") } : blankType(kind);
  const prefix = stringOf(src?.mark || kind[0]?.toUpperCase()).replace(/\d+$/, "");
  created.mark = `${prefix}${types.length + 1}`;
  types.push(created);
  asRecord(next.types)[kind] = types;
  const ui = asRecord(next.ui);
  ui.sel = { ...asRecord(ui.sel), [kind]: types.length - 1 };
  next.ui = ui;
  return { doc: next, index: types.length - 1 };
}

export function duplicateType(doc: DocMap, kind: string, selectedIndex: number): { doc: DocMap; index: number } {
  const next = structuredClone(doc);
  const types = asList(asRecord(next.types)[kind]);
  const src = types[selectedIndex];
  if (!src) return { doc, index: selectedIndex };
  types.splice(selectedIndex + 1, 0, { ...src, id: uid("t"), mark: `${stringOf(src.mark)}a` });
  asRecord(next.types)[kind] = types;
  const ui = asRecord(next.ui);
  ui.sel = { ...asRecord(ui.sel), [kind]: selectedIndex + 1 };
  next.ui = ui;
  return { doc: next, index: selectedIndex + 1 };
}

export function deleteType(doc: DocMap, kind: string, selectedIndex: number): { doc: DocMap; index: number } {
  const next = structuredClone(doc);
  const types = asList(asRecord(next.types)[kind]);
  const src = types[selectedIndex];
  if (!src) return { doc, index: selectedIndex };
  const id = stringOf(src.id);
  types.splice(selectedIndex, 1);
  asRecord(next.types)[kind] = types;
  const placements = asList(asRecord(next.pl)[kind]).filter((row) => row.type !== id);
  asRecord(next.pl)[kind] = placements;
  const ui = asRecord(next.ui);
  const nextIndex = Math.max(0, selectedIndex - 1);
  ui.sel = { ...asRecord(ui.sel), [kind]: nextIndex };
  next.ui = ui;
  return { doc: next, index: nextIndex };
}

export function copyUp(doc: DocMap, kind: string, fromLevelId: string): DocMap | null {
  const levels = activeLevels(doc);
  const fromIndex = levels.findIndex((level) => stringOf(level.id) === fromLevelId);
  if (fromIndex < 0 || fromIndex === levels.length - 1) return null;
  const next = structuredClone(doc);
  const above = new Set(levels.slice(fromIndex + 1).map((level) => stringOf(level.id)));
  const rows = asList(asRecord(next.pl)[kind]);
  const source = rows.filter((row) => stringOf(row.level) === fromLevelId);
  const kept = rows.filter((row) => !above.has(stringOf(row.level)));
  for (const levelId of above) {
    for (const row of source) kept.push({ ...row, id: uid("p"), level: levelId });
  }
  asRecord(next.pl)[kind] = kept;
  return next;
}

export const DEFAULT_MIXES: Record<string, { cem: number; sand: number; agg: number }> = {
  "15": { cem: 230, sand: 0.5, agg: 0.9 },
  "20": { cem: 290, sand: 0.47, agg: 0.88 },
  "25": { cem: 340, sand: 0.44, agg: 0.85 },
  "30": { cem: 380, sand: 0.42, agg: 0.82 },
  "35": { cem: 420, sand: 0.4, agg: 0.8 },
  "40": { cem: 460, sand: 0.38, agg: 0.78 },
};

export function ensureRoofX(doc: DocMap): DocMap {
  const existing = asRecord(doc.roofx);
  if (Array.isArray(existing.planes) && Array.isArray(existing.lines)
    && Array.isArray(existing.openings) && Array.isArray(existing.trusses)) {
    return doc;
  }
  const next = structuredClone(doc);
  next.roofx = createRoofXDefaults(asList(asRecord(next.types).roof) as RoofType[]);
  return next;
}

export function resetToExample(doc: DocMap): DocMap {
  const btype = stringOf(doc.btype, "multi");
  const project = asRecord(doc.project);
  const name = stringOf(project.name);
  const currency = stringOf(project.currency, "USD");
  const numfmt = stringOf(project.numfmt, "en-GB");
  let seed: DocMap;
  if (btype === "road") {
    seed = structuredClone(createRoadDefaults()) as unknown as DocMap;
  } else if (btype === "bridge") {
    seed = structuredClone(createBridgeDefaults()) as unknown as DocMap;
  } else if (btype === "foundation") {
    const example = createMultiStoreyExample();
    example.btype = "foundation";
    seed = structuredClone(example) as unknown as DocMap;
  } else {
    const example = createCompleteBuildingExample("simple");
    example.btype = btype === "single" ? "single" : "multi";
    seed = structuredClone(example) as unknown as DocMap;
  }
  seed.btype = btype;
  seed.roofMode = stringOf(seed.roofMode, "simple");
  seed.project = { ...asRecord(seed.project), name, currency, numfmt };
  seed.mat = { ...DEFAULT_MATERIAL_FACTORS, ...asRecord(seed.mat) };
  seed.mix = Object.keys(asRecord(seed.mix)).length ? seed.mix : structuredClone(DEFAULT_MIXES);
  seed.ui = { sel: {} };
  return seed;
}

export function optionLabel(value: string): string {
  if (value === "supports") return "Over supports";
  if (value === "full") return "Full top mat";
  if (value === "none") return "None";
  if (value === "1") return "1 layer (centre)";
  if (value === "2") return "2 layers (both faces)";
  return value;
}
