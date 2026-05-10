type FilterOption<TValue extends string> = {
  value: TValue;
  labelKey: string;
};

type FilterButtonGroupProps<TValue extends string> = {
  options: Array<FilterOption<TValue>>;
  activeValue: TValue;
  onChange: (value: TValue) => void;
  t: (key: string) => string;
};

export function FilterButtonGroup<TValue extends string>({
  options,
  activeValue,
  onChange,
  t,
}: FilterButtonGroupProps<TValue>) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={activeValue === option.value}
          onClick={() => onChange(option.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium data-[active=true]:border-slate-900 data-[active=true]:bg-slate-900 data-[active=true]:text-white"
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  );
}
