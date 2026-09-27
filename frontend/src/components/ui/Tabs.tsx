import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  icon?: LucideIcon;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

/** Underlined tabs for switching between sections of one page. */
export function Tabs<T extends string>({ tabs, value, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={clsx('flex gap-6 overflow-x-auto border-b border-line', className)}>
      {tabs.map(({ id, label, count, icon: Icon }) => {
        const selected = id === value;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={clsx(
              '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-0.5 pb-3 pt-1 text-sm font-medium transition-colors',
              selected
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-subtle hover:border-line-strong hover:text-fg',
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
            {label}
            {count !== undefined && (
              <span
                className={clsx(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  selected ? 'bg-accent-subtle text-accent-fg' : 'bg-surface-subtle text-fg-subtle',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface SegmentedControlProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}

/** Compact toggle between a few mutually exclusive options (e.g. a date range). */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx('inline-flex rounded-md border border-line-strong bg-surface-subtle p-0.5', className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={clsx(
              'rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors',
              selected ? 'bg-surface text-fg shadow-xs ring-1 ring-line' : 'text-fg-subtle hover:text-fg',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
