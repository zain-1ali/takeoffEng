import { DIAMETERS, n } from "@takeoff/engine";

export interface DiaChipsProps {
  value: number | string;
  onChange: (diameter: number) => void;
  label?: string;
}

export function DiaChips({ value, onChange, label }: DiaChipsProps) {
  const current = n(value);
  return (
    <div className="f">
      {label ? <span className="lab">{label}</span> : null}
      <div className="chips" role="group" aria-label={label ?? "Bar diameter"}>
        {DIAMETERS.map((diameter) => (
          <button
            key={diameter}
            type="button"
            className="chip"
            aria-pressed={current === diameter}
            onClick={() => onChange(diameter)}
          >
            {diameter}
          </button>
        ))}
      </div>
    </div>
  );
}
