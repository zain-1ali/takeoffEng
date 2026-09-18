import { n } from "./expression.js";
import type { NumericInput } from "./types.js";

export const DIAMETERS = [6, 8, 10, 12, 16, 20, 25, 32] as const;

export function ceilSafe(value: number): number {
  return Math.ceil(value - 1e-9);
}

export function kgPerM(diameter: NumericInput): number {
  const value = n(diameter);
  return (value * value) / 162.2;
}

export function band(depth: number): "1.00" | "2.00" | "4.00" | "OVER4" {
  if (depth <= 1) return "1.00";
  if (depth <= 2) return "2.00";
  if (depth <= 4) return "4.00";
  return "OVER4";
}

export function bandText(value: string): string {
  return value === "OVER4"
    ? "exceeding 4.00 m"
    : `not exceeding ${value} m`;
}

export function proppingBand(
  height: number,
): "3.00" | "4.50" | "OVER4.50" {
  if (height <= 3) return "3.00";
  if (height <= 4.5) return "4.50";
  return "OVER4.50";
}

export function proppingBandText(value: string): string {
  return value === "OVER4.50"
    ? "exceeding 4.50 m"
    : `not exceeding ${value} m`;
}

export function letter(index: number): string {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const digit = (value - 1) % 26;
    result = String.fromCharCode(65 + digit) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}
