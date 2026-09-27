import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  /** Accessible name, also shown as a tooltip. */
  label: string;
  tone?: 'default' | 'danger';
}

export default function IconButton({ icon: Icon, label, tone = 'default', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx('btn btn-icon', tone === 'danger' ? 'btn-danger-ghost' : 'btn-ghost', className)}
      {...props}
    >
      <Icon />
    </button>
  );
}
