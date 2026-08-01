import { Icon } from './Icon';

type OptionCardProps = {
  label: string;
  description?: string;
  icon: string;
  active?: boolean;
  dragPayload?: string;
  onClick: () => void;
};

export function OptionCard({
  label,
  description,
  icon,
  active = false,
  dragPayload,
  onClick,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      draggable={Boolean(dragPayload)}
      onDragStart={(e) => {
        if (dragPayload) e.dataTransfer.setData('text/plain', dragPayload);
      }}
      onClick={onClick}
      className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center ${
        active ? 'border-accent bg-accent/14' : 'border-white/10 bg-surface'
      }`}
    >
      <Icon name={icon} size={18} className={active ? 'text-accent' : 'text-ink/65'} />
      <span className={`text-[11px] leading-tight ${active ? 'text-ink' : 'text-ink/65'}`}>
        {label}
      </span>
      {description && (
        <span className="font-mono text-[9px] leading-tight text-ink/30">{description}</span>
      )}
    </button>
  );
}
