import { Icon } from './Icon';

type IconButtonProps = {
  icon: string;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Renders aria-pressed — omit for buttons that are not toggles. */
  toggle?: boolean;
  iconSize?: number;
};

export function IconButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
  toggle = false,
  iconSize = 18,
}: IconButtonProps) {
  const tone = disabled
    ? 'text-ink/25 opacity-50'
    : active
      ? 'bg-accent/18 text-accent'
      : 'text-ink/70 hover:bg-white/5';

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={toggle ? active : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-[7px] ${tone}`}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}
