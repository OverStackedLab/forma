import type { ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  className?: string;
};

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-canvas font-bold',
  ghost: 'border border-white/10 bg-surface text-ink/75 hover:text-ink',
  danger: 'border border-[rgba(220,90,90,.3)] bg-[rgba(220,90,90,.1)] text-danger',
};

/** Small action button — the 28px height used throughout the sidebars. */
export function Button({
  children,
  onClick,
  variant = 'ghost',
  disabled = false,
  className = '',
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 items-center rounded-md px-3 text-[11.5px] disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
