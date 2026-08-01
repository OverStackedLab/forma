import { Icon } from './Icon';

type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

type SelectProps<T extends string | number> = {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  title?: string;
  className?: string;
};

/**
 * A native `<select>` styled to sit alongside the viewport's icon buttons.
 *
 * Native rather than a custom listbox: it gets keyboard handling, screen
 * reader semantics and the platform's own popup for free, and
 * `useKeyboardShortcuts`' `isEditable` guard already covers `SELECT`, so the
 * app's single-key shortcuts don't fire while it has focus.
 *
 * `appearance-none` is load-bearing — without it Safari draws its own bezel
 * and ignores the border and background entirely.
 */
export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  title,
  className = '',
}: SelectProps<T>) {
  return (
    <div className={`relative ${className}`}>
      <select
        aria-label={ariaLabel}
        title={title}
        value={value}
        onChange={(e) => {
          // `<select>` values are always strings; restore the option's own type
          // so a numeric caller never receives "10" where it expects 10.
          const next = options.find((o) => String(o.value) === e.target.value);
          if (next) onChange(next.value);
        }}
        className="h-[34px] cursor-pointer appearance-none rounded-lg border border-canvas/12 bg-white/60 pr-6 pl-2.5 font-mono text-[11px] text-canvas"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevron_down"
        size={14}
        className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-canvas/50"
      />
    </div>
  );
}
