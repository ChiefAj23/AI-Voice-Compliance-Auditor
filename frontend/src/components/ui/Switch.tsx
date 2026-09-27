import { useId } from 'react';
import clsx from 'clsx';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export default function Switch({ checked, onChange, label, description, disabled, className }: SwitchProps) {
  const id = useId();
  const toggle = () => {
    if (!disabled) onChange(!checked);
  };

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? `${id}-label` : undefined}
      disabled={disabled}
      onClick={toggle}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-line-strong',
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );

  if (!label) return control;

  return (
    <div className={clsx('flex items-start gap-3', className)}>
      <div className="pt-0.5">{control}</div>
      <div className={clsx('min-w-0 select-none', !disabled && 'cursor-pointer')} onClick={toggle}>
        <p id={`${id}-label`} className="text-sm font-medium text-fg">
          {label}
        </p>
        {description && <p className="text-[13px] text-fg-subtle">{description}</p>}
      </div>
    </div>
  );
}
