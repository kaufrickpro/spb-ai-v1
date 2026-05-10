type FieldClassNames = {
  inputClass: string;
  labelClass: string;
};

type TextInputProps = FieldClassNames & {
  id: string;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "email";
  value: string;
};

type NumberInputProps = FieldClassNames & {
  id: string;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: string) => void;
  value: string;
};

type TextareaInputProps = FieldClassNames & {
  id: string;
  label: string;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  rows: number;
  value: string;
};

export function TextInput({
  id,
  inputClass,
  label,
  labelClass,
  maxLength,
  onChange,
  placeholder,
  required,
  type = "text",
  value,
}: TextInputProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        className={inputClass}
      />
    </div>
  );
}

export function NumberInput({
  id,
  inputClass,
  label,
  labelClass,
  max,
  min,
  onChange,
  value,
}: NumberInputProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}

export function TextareaInput({
  id,
  inputClass,
  label,
  labelClass,
  maxLength,
  onChange,
  placeholder,
  rows,
  value,
}: TextareaInputProps) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </div>
  );
}
