import { n } from "../expression.js";
import { bandText, DIAMETERS } from "../helpers.js";
import type { CatalogueEntry, NumericInput } from "../types.js";
import type {
  CivilCatalogueEntry,
  CivilProject,
} from "./civil-types.js";

type Unit = CatalogueEntry["unit"];
type Row = readonly [code: string, unit: Unit, description: string];

const DEPTH_BANDS = ["1.00", "2.00", "4.00", "OVER4"] as const;

const GROUP_LABELS = {
  BFND: "bridge footings",
  PIER: "piers and crossheads",
  ABUT: "abutments and wingwalls",
  DECK: "deck girders and slabs",
  PARA: "parapets",
  CULV: "culvert headwalls",
} as const;

function reinforcement(group: keyof typeof GROUP_LABELS): Row[] {
  return DIAMETERS.map((diameter) => [
    `R${group}${diameter}`,
    "t",
    `${diameter >= 10 ? "High yield" : "Mild steel"} bar reinforcement ${diameter} mm in ${GROUP_LABELS[group]}, cut, bent and fixed`,
  ]);
}

function uniquePositive<T>(
  rows: readonly T[],
  select: (row: T) => NumericInput,
): string[] {
  const values = rows
    .map((row) => String(select(row)))
    .filter((value) => n(value) > 0);
  return [...new Set(values)];
}

function sharedRows(project: CivilProject): Row[] {
  return [
    ...DEPTH_BANDS.map((value): Row => [
      `SUP${value}`,
      "m²",
      `Earthwork support to faces of excavation, maximum depth ${bandText(value)}`,
    ]),
    ["LVL", "m²", "Level and compact bottoms of excavations and formation"],
    ["ATT", "m²", "Anti-termite treatment to bottoms of excavations and under ground slab"],
    ["BLD", "m³", `Plain concrete ${project.grades.blind} blinding, ${n(project.rules.blinding).toFixed(0)} mm thick`],
    ["BFL", "m³", "Filling to excavations with selected excavated material, compacted in layers"],
    ["DSP", "m³", "Disposal of surplus excavated material off site"],
  ];
}

function rank(code: string): number {
  if (/^EXC/.test(code)) return 0;
  if (/^SUP/.test(code)) return 1;
  if (code === "LVL") return 2;
  if (code === "ATT") return 3;
  if (code === "BLD") return 4;
  if (code === "BFL") return 6;
  if (code === "DSP") return 7;
  if (/^R[A-Z]+\d+$/.test(code)) return 8;
  return 5;
}

function sortedTarget(rows: readonly Row[], project: CivilProject): Row[] {
  return [...rows, ...sharedRows(project)]
    .map((row, index) => ({ row, index }))
    .sort((left, right) =>
      rank(left.row[0]) - rank(right.row[0]) || left.index - right.index)
    .map(({ row }) => row);
}

function append(
  output: CivilCatalogueEntry[],
  section: string,
  rows: readonly Row[],
): void {
  for (const [code, unit, desc] of rows) {
    output.push({ sec: section, code, unit, desc });
  }
}

function roadCatalogue(project: CivilProject): CivilCatalogueEntry[] {
  const output: CivilCatalogueEntry[] = [];
  append(output, "Road – clearance and earthworks", [
    ["CLR", "m²", "Site clearance of road reserve including grubbing and disposal"],
    ["TOPR", "m³", "Strip topsoil from road footprint and stockpile for reuse"],
    ["RCUT", "m³", "Excavate road cut to formation level in material other than rock"],
    ["RCUTFILL", "m³", "Load, haul and place suitable cut material in embankment"],
    ["RBORROW", "m³", "Imported fill from approved borrow pits, placed in embankment"],
    ["RFILL", "m³", "Compact embankment fill in 200 mm layers to 95% MDD"],
    ["RSPOIL", "m³", "Dispose of surplus or unsuitable cut material to spoil"],
    ["SGC", "m²", "Scarify and compact road bed to 95% MDD"],
  ]);
  append(output, "Road – pavement layers", [
    ...uniquePositive(project.types.rpave, ({ cap }) => cap).map((value): Row => [
      `CAP${value}`,
      "m³",
      `Improved subgrade, natural gravel, ${value} mm compacted thickness`,
    ]),
    ...uniquePositive(project.types.rpave, ({ subb }) => subb).map((value): Row => [
      `SUBB${value}`,
      "m³",
      `Natural gravel subbase, ${value} mm compacted thickness`,
    ]),
    ...uniquePositive(project.types.rpave, ({ base }) => base).map((value): Row => [
      `BASE${value}`,
      "m³",
      `Graded crushed stone base, ${value} mm compacted thickness`,
    ]),
    ["PRIME", "m²", "Prime coat MC-30 to crushed stone base"],
    ...uniquePositive(project.types.rpave, ({ acb }) => acb).map((value): Row => [
      `ACB${value}`,
      "m²",
      `Dense bitumen macadam binder course, ${value} mm thick`,
    ]),
    ["TACK", "m²", "Tack coat K1-60 between asphalt layers"],
    ...uniquePositive(project.types.rpave, ({ acw }) => acw).map((value): Row => [
      `ACW${value}`,
      "m²",
      `Asphalt concrete wearing course, ${value} mm thick`,
    ]),
    ["SDS", "m²", "Double surface dressing to shoulders"],
  ]);
  append(output, "Road – drainage and culverts", sortedTarget([
    ["EXCD", "m³", "Excavate side drains to profile and dispose"],
    ["CDRN", "m³", `Concrete ${project.grades.civil} lining to side drains, cast on earth`],
    ["MESHD", "m²", "Steel fabric reinforcement to drain linings and culvert aprons"],
    ...DEPTH_BANDS.map((value): Row => [
      `EXCC${value}`,
      "m³",
      `Excavate trenches for pipe culverts, maximum depth ${bandText(value)}`,
    ]),
    ["CBED", "m³", `Concrete ${project.grades.blind} bedding to culvert pipes`],
    ...uniquePositive(project.types.rculv, ({ dia }) => dia).map((value): Row => [
      `PIPE${value}`,
      "m",
      `Precast concrete culvert pipes ${value} mm internal diameter, laid and jointed`,
    ]),
    ["CHW", "m³", `Reinforced concrete ${project.grades.civil} in culvert headwalls`],
    ["FHW", "m²", "Formwork to faces of culvert headwalls"],
    ["CAPR", "m³", `Concrete ${project.grades.civil} in culvert inlet and outlet aprons`],
    ...reinforcement("CULV"),
  ], project));
  append(output, "Road – furniture and markings", [
    ["KERB", "m", "Precast concrete kerbs bedded and backed in concrete"],
    ["RMARK", "m", "Thermoplastic road marking lines, 100 mm wide"],
    ["RSIGN", "No.", "Road signs complete with posts and foundations"],
    ["GRAIL", "m", "W-beam guardrail with posts and terminals"],
    ["RSTUD", "No.", "Reflective road studs"],
    ["KMP", "No.", "Kilometre posts"],
  ]);
  return output;
}

function bridgeCatalogue(project: CivilProject): CivilCatalogueEntry[] {
  const output: CivilCatalogueEntry[] = [];
  append(output, "Bridge – foundations", sortedTarget([
    ...DEPTH_BANDS.map((value): Row => [
      `EXCB${value}`,
      "m³",
      `Excavate for bridge footings, commencing at EGL, maximum depth ${bandText(value)}`,
    ]),
    ["CBFT", "m³", `Reinforced concrete ${project.grades.found} in abutment and pier footings`],
    ["FBFT", "m²", "Formwork to sides of bridge footings"],
    ...reinforcement("BFND"),
  ], project));
  append(output, "Bridge – substructure", [
    ["CPIER", "m³", `Reinforced concrete ${project.grades.bridge} in pier columns`],
    ["FPIER", "m²", "Formwork to pier columns, fair finish"],
    ["CXHEAD", "m³", `Reinforced concrete ${project.grades.bridge} in pier crossheads`],
    ["FXHEAD", "m²", "Formwork to soffits and sides of crossheads"],
    ["CABW", "m³", `Reinforced concrete ${project.grades.bridge} in abutment walls`],
    ["FABW", "m²", "Formwork to faces of abutment walls"],
    ["CWING", "m³", `Reinforced concrete ${project.grades.bridge} in wingwalls`],
    ["FWING", "m²", "Formwork to faces of wingwalls"],
    ["CBALL", "m³", `Reinforced concrete ${project.grades.bridge} in ballast walls`],
    ["FBALL", "m²", "Formwork to faces of ballast walls"],
    ...reinforcement("PIER"),
    ...reinforcement("ABUT"),
  ]);
  append(output, "Bridge – superstructure", [
    ["CGIRD", "m³", `Reinforced concrete ${project.grades.bridge} in deck girders`],
    ["FGIRD", "m²", "Formwork to soffits and sides of girders"],
    ["CDIAPH", "m³", `Reinforced concrete ${project.grades.bridge} in diaphragms`],
    ["FDIAPH", "m²", "Formwork to soffits and sides of diaphragms"],
    ["CDECK", "m³", `Reinforced concrete ${project.grades.bridge} in deck slab`],
    ["FDECK", "m²", "Formwork to soffit of deck slab"],
    ["FDECKE", "m²", "Formwork to edges of deck slab"],
    ["CAPPR", "m³", `Reinforced concrete ${project.grades.found} in approach slabs`],
    ["FAPPRE", "m²", "Formwork to edges of approach slabs"],
    ["CPARA", "m³", `Reinforced concrete ${project.grades.bridge} in parapets`],
    ["FPARA", "m²", "Formwork to faces of parapets"],
    ...reinforcement("DECK"),
    ...reinforcement("PARA"),
  ]);
  append(output, "Bridge – bearings, joints and finishes", [
    ["BRG", "No.", "Elastomeric bearings including installation"],
    ["EJ", "m", "Deck expansion joints, proprietary system"],
    ["WPF", "m²", "Waterproofing membrane to deck"],
    ["SURF", "m²", `Asphalt surfacing to deck, ${n(project.bacc.surfT).toFixed(0)} mm thick`],
    ["SPOUT", "No.", "Deck drainage spouts"],
    ["HRAIL", "m", "Galvanised steel handrail"],
    ["BFGR", "m³", "Granular backfill behind abutments, compacted in layers"],
  ]);
  return output;
}

/**
 * Builds only the road or bridge catalogue for the supplied civil project.
 * Shared earthwork rows are relocated into the prototype's civil target
 * section and sorted using the same rank rules.
 */
export function civilCatalogue(project: CivilProject): CivilCatalogueEntry[] {
  const rows = project.btype === "road"
    ? roadCatalogue(project)
    : bridgeCatalogue(project);
  const seen = new Set<string>();
  return rows.filter(({ code }) => {
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

export const catalogueCivil = civilCatalogue;
