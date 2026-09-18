import { useId } from "react";

export interface TextFieldProps {
  value: string;
  onChange: (raw: string) => void;
  label?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function TextField({
  value,
  onChange,
  label,
  id,
  placeholder,
  disabled = false,
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const field = (
    <div className="box">
      <input
        id={inputId}
        className="t"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
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
