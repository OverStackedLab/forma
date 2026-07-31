import { useEffect, useRef, useState } from 'react';

type InlineRenameProps = {
  value: string;
  onRename: (value: string) => void;
  className?: string;
  inputClassName?: string;
  ariaLabel: string;
};

/**
 * Double-click to rename in place — Enter or blur commits, Escape reverts.
 * Blank input is discarded rather than committed, so a name can't go empty.
 */
export function InlineRename({
  value,
  onRename,
  className = '',
  inputClassName = '',
  ariaLabel,
}: InlineRenameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onRename(trimmed);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={inputClassName}
      />
    );
  }

  return (
    <span
      className={className}
      title="Double-click to rename"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {value}
    </span>
  );
}
