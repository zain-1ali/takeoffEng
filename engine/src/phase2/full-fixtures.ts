import { createMultiStoreyExample } from "../fixtures.js";
import {
  createFinishesDefaults,
  createMEPDefaults,
} from "./finishes-mep.js";
import type { FullBuildingProject } from "./full.js";
import {
  createRoofDefaults,
  createRoofXDefaults,
} from "./roofing.js";

export function createCompleteBuildingExample(
  roofMode: "simple" | "complex" = "simple",
): FullBuildingProject {
  const project = createMultiStoreyExample() as FullBuildingProject;
  let sequence = 0;
  const id = (): string => `phase2-${++sequence}`;
  const finishes = createFinishesDefaults(project.levels, id);
  const mep = createMEPDefaults(project.levels, id);
  const roof = createRoofDefaults();

  Object.assign(project.types, finishes.types, mep.types, {
    roof: roof.types,
  });
  Object.assign(project.pl, finishes.placements, mep.placements, {
    roof: roof.placements,
  });
  project.roofMode = roofMode;
  project.roofx = createRoofXDefaults(roof.types);
  return project;
}
