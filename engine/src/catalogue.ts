import { n } from "./expression.js";
import {
  bandText,
  DIAMETERS,
  proppingBandText,
} from "./helpers.js";
import type { CatalogueEntry, StructuralProject } from "./types.js";

type Unit = CatalogueEntry["unit"];
type Row = readonly [code: string, unit: Unit, description: string];

const GROUP_LABELS: Record<string, string> = {
  FND: "foundations and ground beams",
  COL: "columns",
  BEAM: "beams",
  SLAB: "suspended slabs",
  WALL: "walls",
  STAIR: "staircases",
};

function reinforcement(group: keyof typeof GROUP_LABELS): Row[] {
  return DIAMETERS.map((diameter) => [
    `R${group}${diameter}`,
    "t",
    `${diameter >= 10 ? "High yield" : "Mild steel"} bar reinforcement ${diameter} mm in ${GROUP_LABELS[group]}, cut, bent and fixed`,
  ]);
}

function number(value: unknown, digits = 0): string {
  return n(value as number | string).toFixed(digits);
}

export function catalogue(project: StructuralProject): CatalogueEntry[] {
  const grades = project.grades;
  const rules = project.rules;
  const entries: CatalogueEntry[] = [];
  const depthBands = ["1.00", "2.00", "4.00", "OVER4"] as const;
  const section = (name: string, rows: readonly Row[]): void => {
    for (const [code, unit, desc] of rows) {
      entries.push({ sec: name, code, unit, desc });
    }
  };

  section("Site preparation and earthworks", [
    ["TOP", "m²", `Remove topsoil average ${number(project.sog.topsoil)} mm deep and dispose`],
    ...depthBands.map((value): Row => [
      `EXCP${value}`, "m³",
      `Excavate pits for pad footings, commencing at EGL, maximum depth ${bandText(value)}`,
    ]),
    ...depthBands.map((value): Row => [
      `EXCS${value}`, "m³",
      `Excavate trenches for strip footings, commencing at EGL, maximum depth ${bandText(value)}`,
    ]),
    ...depthBands.map((value): Row => [
      `EXCT${value}`, "m³",
      `Excavate trenches for ground beams, commencing at EGL, maximum depth ${bandText(value)}`,
    ]),
    ...depthBands.map((value): Row => [
      `SUP${value}`, "m²",
      `Earthwork support to faces of excavation, maximum depth ${bandText(value)}`,
    ]),
    ["LVL", "m²", "Level and compact bottoms of excavations and formation"],
    ["ATT", "m²", "Anti-termite treatment to bottoms of excavations and under ground slab"],
    ["BFL", "m³", "Filling to excavations with selected excavated material, compacted in layers"],
    ["DSP", "m³", "Disposal of surplus excavated material off site"],
    ["HARD", "m³", `Imported hardcore filling under ground slab, ${number(project.sog.hardcore)} mm thick, compacted`],
    ["SAND", "m²", `Sand blinding to hardcore, ${number(project.sog.sand)} mm thick`],
    ["DPM", "m²", "Polythene damp-proof membrane under ground slab"],
  ]);

  section("Substructure concrete, formwork and reinforcement", [
    ["BLD", "m³", `Plain concrete ${grades.blind} blinding, ${number(rules.blinding)} mm thick`],
    ["CPAD", "m³", `Reinforced concrete ${grades.found} in pad footings`],
    ["CSTUB", "m³", `Reinforced concrete ${grades.found} in column stubs`],
    ["CSTRIP", "m³", `Reinforced concrete ${grades.found} in strip footings`],
    ["CGB", "m³", `Reinforced concrete ${grades.found} in ground beams`],
    ["CSOG", "m³", `Reinforced concrete ${grades.found} in ground-bearing slab, ${number(project.sog.t)} mm thick`],
    ["FPAD", "m²", "Formwork to sides of pad footings"],
    ["FSTUB", "m²", "Formwork to sides of column stubs"],
    ["FSTRIP", "m²", "Formwork to sides of strip footings"],
    ["FGB", "m²", "Formwork to sides of ground beams"],
    ["FSOGE", "m²", "Formwork to edges of ground-bearing slab"],
    ["MESH", "m²", `Steel fabric reinforcement ${project.sog.mesh} in ground-bearing slab`],
    ...reinforcement("FND"),
  ]);

  section("Frame – columns", [
    ["CCOL", "m³", `Reinforced concrete ${grades.frame} in columns`],
    ["FCOL", "m²", "Formwork to sides of columns"],
    ...reinforcement("COL"),
  ]);
  section("Frame – beams", [
    ["CBEAM", "m³", `Reinforced concrete ${grades.frame} in beams (below slab soffit)`],
    ["FBSOF", "m²", "Formwork to soffits of beams"],
    ["FBSID", "m²", "Formwork to sides of beams"],
    ...reinforcement("BEAM"),
  ]);
  section("Frame – suspended slabs", [
    ["CSLAB", "m³", `Reinforced concrete ${grades.frame} in suspended slabs`],
    ...(["3.00", "4.50", "OVER4.50"] as const).map((value): Row => [
      `FSLAB${value}`, "m²",
      `Formwork to soffits of slabs, propping height ${proppingBandText(value)}`,
    ]),
    ["FSLABE", "m²", "Formwork to free edges of slabs"],
    ...reinforcement("SLAB"),
  ]);
  section("Walls", [
    ["CWALL", "m³", `Reinforced concrete ${grades.frame} in walls`],
    ["FWALL", "m²", "Formwork to faces of walls"],
    ...reinforcement("WALL"),
  ]);
  section("Staircases", [
    ["CSTAIR", "m³", `Reinforced concrete ${grades.frame} in stair flights and landings`],
    ["FSTSOF", "m²", "Formwork to soffits of stair flights and landings"],
    ["FSTRIS", "m", "Formwork to risers of stairs"],
    ["FSTSTR", "m²", "Formwork to open strings of stairs"],
    ...reinforcement("STAIR"),
  ]);

  const seen = new Set<string>();
  return entries.filter(({ code }) => {
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}
