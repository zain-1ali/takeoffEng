import {
  createBridgeDefaults,
  createCompleteBuildingExample,
  createMultiStoreyExample,
  createRoadDefaults,
} from "@takeoff/engine";
import type { BuildingType } from "../models/enums.js";

export function engineBuildingType(type: BuildingType): "foundation" | "single" | "multi" | "road" | "bridge" {
  return type.toLowerCase() as "foundation" | "single" | "multi" | "road" | "bridge";
}

export function defaultProjectName(type: BuildingType): string {
  switch (type) {
    case "FOUNDATION":
      return "Foundations take-off";
    case "SINGLE":
      return "Single-storey building";
    case "MULTI":
      return "Six-storey office building – structural works";
    case "ROAD":
      return "2.0 km road";
    case "BRIDGE":
      return "Three-span concrete bridge";
  }
}

export function initialStateJson(
  type: BuildingType,
  meta: { name: string; currency: string; numberLocale: string },
): Record<string, unknown> {
  const cloned = structuredClone(seedFor(type)) as Record<string, unknown>;
  cloned.btype = engineBuildingType(type);
  cloned.project = {
    ...((cloned.project as Record<string, unknown> | undefined) ?? {}),
    name: meta.name,
    currency: meta.currency,
    numfmt: meta.numberLocale,
  };
  if (type === "SINGLE" || type === "MULTI") {
    cloned.roofMode = "simple";
  }
  return cloned;
}

function seedFor(type: BuildingType): object {
  if (type === "ROAD") return createRoadDefaults();
  if (type === "BRIDGE") return createBridgeDefaults();
  if (type === "FOUNDATION") {
    const project = createMultiStoreyExample();
    project.btype = "foundation";
    return project;
  }
  const project = createCompleteBuildingExample("simple");
  project.btype = type === "SINGLE" ? "single" : "multi";
  return project;
}
