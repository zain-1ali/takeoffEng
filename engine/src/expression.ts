import type { NumericInput } from "./types.js";

const EXPR_OK = /^[\d\s.,+\-*/x×÷()%^]+$/i;
const EXPR_OP = /[+*/x×÷()%^]|\d\s*-/i;
const PLAIN_NUMBER_OR_PERCENT = /^\s*[-+]?\d+(?:[.,]\d+)?\s*%?\s*$/;
const cache = new Map<string, number>();

export function evalExpr(source: string): number {
  const cached = cache.get(source);
  if (cached !== undefined) return cached;

  const text = source
    .trim()
    .replace(/,/g, ".")
    .replace(/[x×]/gi, "*")
    .replace(/÷/g, "/");
  let index = 0;

  const peek = (): string | undefined => {
    while (text[index] === " ") index += 1;
    return text[index];
  };
  const eat = (token: string): boolean => {
    if (peek() !== token) return false;
    index += 1;
    return true;
  };
  const number = (): number => {
    peek();
    const match = /^(?:\d*\.?\d+|\d+\.)(?:e[+-]?\d+)?/i.exec(
      text.slice(index),
    );
    if (!match) throw new Error("number expected");
    index += match[0].length;
    let value = Number.parseFloat(match[0]);
    if (eat("%")) value /= 100;
    return value;
  };
  const atom = (): number => {
    if (eat("-")) return -atom();
    if (eat("+")) return atom();
    if (eat("(")) {
      const value = sum();
      if (!eat(")")) throw new Error("closing parenthesis expected");
      return value;
    }
    return number();
  };
  const power = (): number => {
    const value = atom();
    return eat("^") ? Math.pow(value, power()) : value;
  };
  const product = (): number => {
    let value = power();
    for (;;) {
      if (eat("*")) value *= power();
      else if (eat("/")) {
        const divisor = power();
        value = divisor === 0 ? Number.NaN : value / divisor;
      } else if (peek() === "(") value *= power();
      else return value;
    }
  };
  const sum = (): number => {
    let value = product();
    for (;;) {
      if (eat("+")) value += product();
      else if (eat("-")) value -= product();
      else return value;
    }
  };

  let result = Number.NaN;
  try {
    if (text.length <= 240) {
      result = sum();
      if (peek() !== undefined) result = Number.NaN;
    }
  } catch {
    result = Number.NaN;
  }

  if (cache.size > 2_000) cache.clear();
  cache.set(source, result);
  return result;
}

export function isExpr(value: unknown): boolean {
  if (typeof value !== "string" || !EXPR_OK.test(value)) return false;
  if (PLAIN_NUMBER_OR_PERCENT.test(value)) return false;
  return EXPR_OP.test(value.trim().replace(/^[-+]/, ""));
}

export function n(value: NumericInput | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "");
  if (isExpr(text)) {
    const result = evalExpr(text);
    return Number.isFinite(result) ? result : 0;
  }
  const result = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(result) ? result : 0;
}

export function clearExpressionCache(): void {
  cache.clear();
}
