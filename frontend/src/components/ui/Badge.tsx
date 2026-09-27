import type { ReactNode } from 'react';
import clsx from 'clsx';
import type { Tone } from '../../utils/status';

const toneClass: Record<Tone, string> = {
  neutral: 'badge-neutral',
  accent: 'badge-accent',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
};

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Badge({ tone = 'neutral', dot = false, className, children }: BadgeProps) {
  return (
    <span className={clsx('badge', toneClass[tone], className)}>
      {dot && <span className="status-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
