type UnderlineTabsProps<T extends string> = {
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
};

export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: UnderlineTabsProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex border-b border-hairline">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`h-10 flex-1 border-b-2 text-xs font-semibold ${
              active ? 'border-accent text-ink' : 'border-transparent text-ink/50'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
