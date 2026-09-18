import { formatNumber } from "../lib/format.js";

export interface ReadoutProps {
  label: string;
  value: number | string;
  digits?: number;
  unit?: string;
}

export function Readout({ label, value, digits = 2, unit }: ReadoutProps) {
  const text = typeof value === "number" ? formatNumber(value, digits) : value;
  return (
    <div className="readout">
      <small>{label}</small>
      <b>
        {text}
        {unit ? ` ${unit}` : ""}
      </b>
    </div>
  );
}
