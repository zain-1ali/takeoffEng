export { catalogue as structuralCatalogue } from "./catalogue.js";
export { activeLevels, compute as computeStructural } from "./compute.js";
export {
  clearExpressionCache,
  evalExpr,
  isExpr,
  n,
} from "./expression.js";
export { createMultiStoreyExample } from "./fixtures.js";
export {
  band,
  bandText,
  ceilSafe,
  DIAMETERS,
  kgPerM,
  letter,
  proppingBand,
  proppingBandText,
} from "./helpers.js";
export type * from "./types.js";
export { civilCatalogue } from "./phase2/civil-catalogue.js";
export { computeCivil, createBridgeDefaults, createRoadDefaults } from "./phase2/civil.js";
export type * from "./phase2/civil-types.js";
export { fullCatalogue as catalogue } from "./phase2/catalogue.js";
export { finishesMepCatalogue } from "./phase2/finishes-mep-catalogue.js";
export * from "./phase2/finishes-mep.js";
export { createCompleteBuildingExample } from "./phase2/full-fixtures.js";
export { computeFullProject as compute } from "./phase2/full.js";
export type * from "./phase2/full.js";
export * from "./phase2/roofing.js";
export { analyse, currencyFactor, raRate, RATE_CATEGORIES, stdRecipe } from "./phase2/pricing.js";
export { bomResourcePrice, bomRows, bomTotal } from "./phase2/bom.js";
export { boqRows, boqTotals } from "./phase2/boq.js";
export {
  allDefaultResources,
  blankResources,
  DEFAULT_MATERIAL_FACTORS,
  ensureResources,
  finResourcesEnsure,
  mepResourcesEnsure,
  raDefaults,
  roofResourcesEnsure,
  roofxResourcesEnsure,
} from "./phase2/resources.js";
export type {
  AnalysisRow,
  BomContext,
  BomItemRow,
  BomRow,
  BoqBill,
  BoqItemRow,
  BoqRow,
  BoqTotals,
  CategoryTotals,
  ConcreteMix,
  CustomRate,
  MaterialFactors,
  PricingContext,
  RateAnalysis,
  Recipe,
  RecipeLine,
  RecipeTypes,
  Resource,
  ResourceCategory,
} from "./phase2/pricing-types.js";

export const ENGINE_VERSION = "0.2.0";

export function ping(): string {
  return "takeoff-engine";
}
