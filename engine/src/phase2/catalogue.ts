import { catalogue as structuralCatalogue } from "../catalogue.js";
import type { CatalogueEntry } from "../types.js";
import { civilCatalogue } from "./civil-catalogue.js";
import { finishesMepCatalogue } from "./finishes-mep-catalogue.js";
import type { FullProject } from "./full.js";
import { roofCatalogue } from "./roofing.js";

export function fullCatalogue(project: FullProject): CatalogueEntry[] {
  if (project.btype === "road" || project.btype === "bridge") {
    return civilCatalogue(project);
  }
  const entries: CatalogueEntry[] = [
    ...structuralCatalogue(project),
  ];
  if (project.btype === "single" || project.btype === "multi") {
    entries.push(
      ...finishesMepCatalogue(project, project.grades),
      ...roofCatalogue(project),
    );
  }

  const seen = new Set<string>();
  return entries.filter(({ code }) => {
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}
