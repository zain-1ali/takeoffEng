import { useId, type KeyboardEvent } from "react";
import { n } from "../lib/expr.js";
import { formulaStatus } from "../lib/formula.js";
import { roundResult } from "../lib/format.js";

export interface NumberFieldProps {
  value: string | number;
  onChange: (raw: string) => void;
  label?: string;
  unit?: string;
  step?: number;
  compact?: boolean;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function NumberField({
  value,
  onChange,
  label,
  unit,
  step = 1,
  compact = false,
  id,
  disabled = false,
  className = "",
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = `${inputId}-eq`;
  const raw = String(value ?? "");
  const status = formulaStatus(raw);
  const boxClass = [
    "box",
    compact ? "compact" : "",
    status.badge && status.valid ? "exprok" : "",
    status.badge && !status.valid ? "exprbad" : "",
    className,
  ].filter(Boolean).join(" ");

  function bump(delta: number) {
    const next = Math.max(0, Number((n(raw) + delta).toFixed(3)));
    onChange(String(next));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && status.isFormula) {
      event.preventDefault();
      if (!status.valid) return;
      onChange(String(roundResult(status.value)));
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? 1 : -1;
      bump(direction * step * (event.shiftKey ? 10 : 1));
    }
  }

  const field = (
    <div
      className={boxClass}
      data-eq={status.badge ?? undefined}
    >
      <button
        className="stp"
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Decrease"
        onClick={() => bump(-step)}
      >
        −
      </button>
      <input
        id={inputId}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={raw}
        title={status.title}
        aria-invalid={status.isFormula && !status.valid}
        aria-describedby={status.badge ? describedBy : undefined}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        className="stp"
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Increase"
        onClick={() => bump(step)}
      >
        +
      </button>
      {unit ? <span className="u">{unit}</span> : null}
      {status.badge ? (
        <span id={describedBy} className="sr-only">
          {status.badge}
        </span>
      ) : null}
    </div>
  );

  if (!label) return field;
  return (
    <div className="f">
      <label htmlFor={inputId}>{label}</label>
      {field}
    </div>
  );
}
