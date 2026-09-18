import { useId } from "react";

export interface SelectFieldProps {
  value: string;
  onChange: (raw: string) => void;
  options: readonly { value: string; label: string }[];
  label?: string;
  id?: string;
  disabled?: boolean;
}

export function SelectField({
  value,
  onChange,
  options,
  label,
  id,
  disabled = false,
}: SelectFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const field = (
    <div className="box">
      <select
        id={inputId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
