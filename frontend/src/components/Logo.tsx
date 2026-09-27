/** Product mark: a waveform on the accent tile. Matches public/favicon.svg. */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <g stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
        <path d="M8 13v6" />
        <path d="M12 10v12" />
        <path d="M16 7v18" />
        <path d="M20 11v10" />
        <path d="M24 14v4" />
      </g>
    </svg>
  );
}
