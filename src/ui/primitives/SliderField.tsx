import { useEffect, useId, useState } from 'react';

type SliderFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Displayed suffix, e.g. "mm" or "°". */
  unit?: string;
  /** Spelled-out unit for the number input's aria-label, e.g. "millimetres" or "degrees". */
  unitName?: string;
};

/**
 * Slider and number input are two views of one value, bound in both
 * directions. The text field keeps its own draft while focused so a
 * part-typed number isn't clamped out from under the user.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit = 'mm',
  unitName = 'millimetres',
}: SliderFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commitDraft = () => {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n)) onChange(n);
    else setDraft(String(value));
  };

  return (
    <div className="px-0.5 pt-1.5 pb-3.5">
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[12.5px] text-ink/70">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={draft}
            min={min}
            max={max}
            step={step}
            aria-label={`${label} in ${unitName}`}
            onFocus={() => setEditing(true)}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
            className="h-[22px] w-[58px] rounded-[5px] border border-white/10 bg-input px-1.5 text-right font-mono text-[11.5px] text-ink"
          />
          <span className="font-mono text-[10.5px] text-ink/35">{unit}</span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        className="w-full"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
