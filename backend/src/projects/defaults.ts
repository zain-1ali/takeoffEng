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
  if (type === "ROAD") return blankTakeoff(createRoadDefaults());
  if (type === "BRIDGE") return blankTakeoff(createBridgeDefaults());
  if (type === "FOUNDATION") {
    const project = createMultiStoreyExample();
    project.btype = "foundation";
    return blankTakeoff(project);
  }
  const project = createCompleteBuildingExample("simple");
  project.btype = type === "SINGLE" ? "single" : "multi";
  return blankTakeoff(project);
}

/** Keep type catalogs, but drop measured work so new projects start at quantity zero. */
export function blankTakeoff<T extends object>(project: T): T {
  const next = structuredClone(project) as T & {
    pl?: Record<string, unknown>;
    sog?: Record<string, unknown>;
    road?: Record<string, unknown>;
    bacc?: Record<string, unknown>;
    roofx?: Record<string, unknown>;
  };
  if (next.pl) emptyArrays(next.pl);
  if (next.roofx) emptyArrays(next.roofx);
  if (next.road) zeroNumbers(next.road);
  if (next.bacc) zeroNumbers(next.bacc);
  if (next.sog) {
    next.sog.area = 0;
    next.sog.edge = 0;
    next.sog.t = 0;
    next.sog.hardcore = 0;
    next.sog.sand = 0;
    next.sog.dpm = false;
    next.sog.topsoil = 0;
  }
  return next;
}

function emptyArrays(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (Array.isArray(value[key])) value[key] = [];
  }
}

function zeroNumbers(value: Record<string, unknown>): void {
  for (const key of Object.keys(value)) {
    if (typeof value[key] === "number") value[key] = 0;
  }
}
