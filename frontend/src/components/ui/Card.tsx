import type { HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';

/** Bordered surface. Compose with CardHeader / CardBody / CardFooter. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card-flush', className)} {...props} />;
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}

export function CardHeader({ title, description, icon: Icon, actions, className }: CardHeaderProps) {
  return (
    <div className={clsx('card-header', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface-subtle text-fg-muted">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="card-title">{title}</h2>
          {description && <p className="card-description">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card-body', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('card-footer', className)} {...props} />;
}
