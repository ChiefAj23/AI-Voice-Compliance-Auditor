import { Loader2 } from 'lucide-react';
import clsx from 'clsx';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('h-4 w-4 animate-spin', className)} aria-hidden="true" />;
}

/** Centered spinner with a label, for sections that are fetching. */
export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={clsx('flex items-center justify-center gap-2 py-14 text-sm text-fg-subtle', className)}>
      <Spinner />
      {label}
    </div>
  );
}
