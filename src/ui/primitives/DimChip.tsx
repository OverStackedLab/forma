import { formatLength, type DisplayUnit } from '@/domain/units';

type DimChipProps = {
  axis: string;
  /** Millimetres — formatted in the given display unit. */
  value: number;
  unit: DisplayUnit;
};

/** Read-only dimension readout — sizes that are derived, not directly editable. */
export function DimChip({ axis, value, unit }: DimChipProps) {
  return (
    <div className="flex-1 rounded-md bg-surface px-2 py-1.5">
      <div className="text-[9.5px] text-ink/45 uppercase">{axis}</div>
      <div className="font-mono text-xs text-ink">{formatLength(value, unit)}</div>
    </div>
  );
}
