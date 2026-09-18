import { n } from "../expression.js";
import { DIAMETERS } from "../helpers.js";
import type { CatalogueEntry, Grades } from "../types.js";
import {
  MASONRY_MATERIAL_CODES,
  sanitizeMark,
} from "./finishes-mep.js";
import type {
  FloorFinish,
  Phase2Project,
  SanitaryFitting,
} from "./finishes-mep-types.js";

type Unit = CatalogueEntry["unit"];

const MASONRY_MATERIAL_NAMES = {
  HB: "Hollow concrete block",
  SB: "Solid concrete block",
  BR: "Burnt clay brick",
  ST: "Dressed stone",
} as const;

const FLOOR_FINISH_NAMES: Partial<Record<FloorFinish, string>> = {
  "Porcelain tiles": "Porcelain floor tiles",
  "Ceramic tiles": "Ceramic floor tiles",
  Terrazzo: "In-situ terrazzo 20 mm thick, ground and polished",
  "Timber flooring": "Timber flooring on battens, sanded and sealed",
  "Vinyl sheet": "Vinyl sheet flooring on smoothing compound",
  "Epoxy coating": "Epoxy floor coating, primer and two coats",
  "Carpet tiles": "Carpet tiles on underlay",
};

const SANITARY_HAS_TRAP: Record<SanitaryFitting, boolean> = {
  "WC suite": false,
  "Wash hand basin": true,
  Urinal: true,
  Shower: true,
  "Kitchen sink": true,
  Bath: true,
  "Floor drain": false,
};

/**
 * Returns the masonry, finishes, electrical and plumbing catalogue sections
 * in prototype bill order. Duplicate codes keep their first description.
 */
export function finishesMepCatalogue(
  project: Phase2Project,
  grades: Pick<Grades, "frame" | "found">,
): CatalogueEntry[] {
  const entries: CatalogueEntry[] = [];
  const seen = new Set<string>();
  const add = (sec: string, code: string, unit: Unit, desc: string): void => {
    if (seen.has(code)) return;
    seen.add(code);
    entries.push({ sec, code, unit, desc });
  };

  const masonry = project.types.masonry ?? [];
  for (const type of masonry) {
    const material = MASONRY_MATERIAL_CODES[type.mat] ?? "HB";
    for (const position of ["E", "I"] as const) {
      const thickness = n(type.t);
      add(
        "Masonry",
        `MAS${material}${thickness}${position}`,
        "m²",
        `${MASONRY_MATERIAL_NAMES[material]} walling ${thickness} mm thick${material === "BR" ? "" : `, ${n(type.uL)} × ${n(type.uH)} mm units`}, ${position === "E" ? "external" : "internal"} walls, bedded and jointed in cement-sand mortar ${type.mortar}`,
      );
    }
  }
  add(
    "Masonry",
    "BFORCE",
    "m",
    "Brickforce ladder reinforcement built into bed joints",
  );
  for (const thickness of new Set(masonry.map((type) => n(type.t)))) {
    add(
      "Masonry",
      `DPC${thickness}`,
      "m",
      `Bituminous damp-proof course ${thickness} mm wide, bedded in mortar at base of walls`,
    );
  }
  add(
    "Masonry",
    "CLINT",
    "m³",
    `Reinforced concrete ${grades.frame || grades.found} in lintels over openings`,
  );
  add("Masonry", "FLINT", "m²", "Formwork to soffits and sides of lintels");
  const lintelDiameters = new Set<number>(DIAMETERS);
  for (const type of masonry) {
    const main = n(type.lbar);
    const links = n(type.llk);
    if (main > 0) {
      lintelDiameters.add(main);
      lintelDiameters.add(Math.max(8, main - 2));
    }
    if (links > 0) lintelDiameters.add(links);
  }
  for (const diameter of lintelDiameters) {
    add(
      "Masonry",
      `RLINT${diameter}`,
      "t",
      `${diameter >= 10 ? "High yield" : "Mild steel"} bar reinforcement ${diameter} mm in lintels, cut, bent and fixed`,
    );
  }

  for (const finish of project.types.wfin ?? []) {
    const thickness = n(finish.bt);
    if (finish.base !== "None" && thickness > 0) {
      if (finish.base === "Gypsum skim") {
        add(
          "Wall finishes",
          `SKIM${thickness}`,
          "m²",
          `Gypsum skim coat ${thickness} mm thick to internal walls`,
        );
      } else if (finish.side === "External") {
        add(
          "Wall finishes",
          `PLE${thickness}`,
          "m²",
          `Cement-sand render 1:4, ${thickness} mm thick in two coats to external walls, wood-float finish`,
        );
      } else {
        add(
          "Wall finishes",
          `PLI${thickness}`,
          "m²",
          `Cement-sand plaster 1:4, ${thickness} mm thick to internal walls, steel-trowelled smooth`,
        );
      }
    }
    if (finish.fin === "Emulsion paint") {
      add(
        "Wall finishes",
        `PNTI${n(finish.coats)}`,
        "m²",
        `Emulsion paint, one mist coat and ${n(finish.coats)} full coats, to plastered internal walls`,
      );
    }
    if (finish.fin === "Weatherproof paint") {
      add(
        "Wall finishes",
        `PNTX${n(finish.coats)}`,
        "m²",
        `Weatherproof masonry paint, ${n(finish.coats)} coats, to rendered external walls`,
      );
    }
    if (finish.fin === "Ceramic wall tiles") {
      add(
        "Wall finishes",
        `WTILE_${sanitizeMark(finish.mark)}`,
        "m²",
        `Ceramic wall tiles${finish.tile ? ` ${finish.tile}` : ""}, fixed with adhesive and grouted (wall finish ${finish.mark})`,
      );
    }
    if (finish.fin === "Stone cladding") {
      add(
        "Wall finishes",
        `CLAD_${sanitizeMark(finish.mark)}`,
        "m²",
        `Natural stone cladding${finish.tile ? ` ${finish.tile}` : ""}, fixed with adhesive and mechanical ties (wall finish ${finish.mark})`,
      );
    }
  }

  for (const finish of project.types.ffin ?? []) {
    const screed = n(finish.screed);
    if (screed > 0) {
      add(
        "Floor finishes",
        `SCR${screed}`,
        "m²",
        `Cement-sand screed 1:3, ${screed} mm thick to floors, to receive finish`,
      );
    }
    if (finish.fin === "Power-floated concrete") {
      add(
        "Floor finishes",
        "PFLOAT",
        "m²",
        "Power-float finish to concrete floor slabs",
      );
    } else {
      const tileDetail =
        finish.tile && /tiles|Vinyl/.test(finish.fin) ? ` ${finish.tile}` : "";
      const fixing = /tiles/.test(finish.fin)
        ? ", fixed with adhesive and grouted"
        : "";
      add(
        "Floor finishes",
        `FF_${sanitizeMark(finish.mark)}`,
        "m²",
        `${FLOOR_FINISH_NAMES[finish.fin] ?? finish.fin}${tileDetail}${fixing} (floor finish ${finish.mark})`,
      );
    }
    if (finish.skm !== "None" && n(finish.skh) > 0) {
      add(
        "Floor finishes",
        `SK_${sanitizeMark(finish.mark)}`,
        "m",
        `${finish.skm === "Matching tile" ? "Tile skirting matching floor tiles" : `${finish.skm} skirting`}, ${n(finish.skh)} mm high (floor finish ${finish.mark})`,
      );
    }
  }

  for (const ceiling of project.types.cfin ?? []) {
    if (
      ceiling.kind === "Plaster and paint to soffit" &&
      n(ceiling.bt) > 0
    ) {
      add(
        "Ceiling finishes",
        `CPL${n(ceiling.bt)}`,
        "m²",
        `Cement-sand plaster ${n(ceiling.bt)} mm thick to concrete soffits`,
      );
    }
    if (
      n(ceiling.coats) > 0 &&
      /Plaster|Paint|Gypsum/.test(ceiling.kind)
    ) {
      add(
        "Ceiling finishes",
        `CPNT${n(ceiling.coats)}`,
        "m²",
        `Emulsion paint, ${n(ceiling.coats)} coats, to ceilings and soffits`,
      );
    }
    if (!/soffit/.test(ceiling.kind)) {
      add(
        "Ceiling finishes",
        `CSUS_${sanitizeMark(ceiling.mark)}`,
        "m²",
        `${ceiling.kind}${n(ceiling.drop) ? `, ${n(ceiling.drop)} mm suspension drop` : ""}, including framing and trims (ceiling finish ${ceiling.mark})`,
      );
    }
  }

  for (const type of project.types.elec ?? []) {
    add(
      "Electrical – lighting, power, data and fire alarm points",
      `EL_${sanitizeMark(type.mark)}`,
      "No.",
      `${type.cat}${type.desc ? `: ${type.desc}` : ""}, wired in ${type.cable}${type.conduit !== "None" ? ` in ${type.conduit.toLowerCase()}` : ""}, average run ${n(type.run).toFixed(0)} m, including back box, connections and testing (point ${type.mark})`,
    );
  }
  for (const type of project.types.elecgear ?? []) {
    add(
      "Electrical – distribution, containment and protection",
      `EG_${sanitizeMark(type.mark)}`,
      type.unit,
      `${type.item}${type.spec ? `: ${type.spec}` : ""}, supplied, installed, connected and tested (${type.mark})`,
    );
  }
  for (const type of project.types.sanit ?? []) {
    add(
      "Plumbing – sanitary fittings",
      `SF_${sanitizeMark(type.mark)}`,
      "No.",
      `${type.fx}${type.spec ? `: ${type.spec}` : ""}, including ${SANITARY_HAS_TRAP[type.fx] ? "trap, " : ""}isolating valves and connections (${type.mark})`,
    );
  }
  for (const diameter of ["20", "25", "32"] as const) {
    add(
      "Plumbing – branch pipework to fittings",
      `PPRC${diameter}`,
      "m",
      `PPR PN20 cold water pipe ${diameter} mm, with fittings and clips, in branches to fittings`,
    );
    add(
      "Plumbing – branch pipework to fittings",
      `PPRH${diameter}`,
      "m",
      `PPR PN20 hot water pipe ${diameter} mm, with fittings and clips, in branches to fittings`,
    );
  }
  for (const diameter of ["32", "40", "50"] as const) {
    add(
      "Plumbing – branch pipework to fittings",
      `WST${diameter}`,
      "m",
      `uPVC waste pipe ${diameter} mm, with fittings and clips`,
    );
  }
  add(
    "Plumbing – branch pipework to fittings",
    "WST110",
    "m",
    "uPVC soil pipe 110 mm, with fittings and brackets, branches to WCs",
  );
  for (const type of project.types.plumb ?? []) {
    add(
      "Plumbing – risers, stacks, drainage and plant",
      `PL_${sanitizeMark(type.mark)}`,
      type.unit,
      `${type.item}${type.size ? `: ${type.size}` : ""}, supplied, installed and tested (${type.mark})`,
    );
  }

  return entries;
}
