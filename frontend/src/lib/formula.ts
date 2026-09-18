import { evalExpr, isExpr, n } from "./expr.js";
import { formatNumber, formulaDigits } from "./format.js";

export interface FormulaStatus {
  isFormula: boolean;
  valid: boolean;
  value: number;
  badge: string | null;
  title: string | undefined;
}

export function formulaStatus(raw: string): FormulaStatus {
  if (!isExpr(raw)) {
    return {
      isFormula: false,
      valid: true,
      value: n(raw),
      badge: null,
      title: undefined,
    };
  }
  const result = evalExpr(raw);
  if (Number.isFinite(result)) {
    return {
      isFormula: true,
      valid: true,
      value: result,
      badge: `= ${formatNumber(result, formulaDigits(result))}`,
      title: `${raw} = ${result}`,
    };
  }
  return {
    isFormula: true,
    valid: false,
    value: 0,
    badge: "check formula",
    title: "This formula can’t be calculated",
  };
}
