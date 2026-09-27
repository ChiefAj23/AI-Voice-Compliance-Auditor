import clsx from 'clsx';

const sizes = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
};

function initials(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Avatar({ name, size = 'md', className }: { name: string; size?: keyof typeof sizes; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        'inline-grid shrink-0 place-items-center rounded-full bg-accent-subtle font-semibold text-accent-fg ring-1 ring-inset ring-accent/15',
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
