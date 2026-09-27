import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
}

/** KPI tile: small label, large tabular figure, optional hint line. */
export default function StatCard({ label, value, hint, icon: Icon, className, children }: StatCardProps) {
  return (
    <div className={clsx('card', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="kpi-label">{label}</p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />}
      </div>
      <div className="kpi-value mt-2">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-fg-subtle">{hint}</div>}
      {children}
    </div>
  );
}
