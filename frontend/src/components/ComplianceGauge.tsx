import clsx from 'clsx';
import { complianceTone, toneFill } from '../utils/status';
import type { Tone } from '../utils/status';

// The unfilled track is a light step of the fill's own hue, so the state reads across the bar.
const track: Record<Tone, string> = {
  neutral: 'bg-surface-muted',
  accent: 'bg-accent-subtle',
  success: 'bg-emerald-100 dark:bg-emerald-500/15',
  warning: 'bg-amber-100 dark:bg-amber-500/15',
  danger: 'bg-red-100 dark:bg-red-500/15',
  info: 'bg-sky-100 dark:bg-sky-500/15',
};

// Alert thresholds from api/alert_system.py: below 50 is critical, below 70 needs review.
const thresholds = [50, 70];

interface ComplianceGaugeProps {
  score: number;
}

export default function ComplianceGauge({ score }: ComplianceGaugeProps) {
  const tone = complianceTone(score);
  const value = Math.max(0, Math.min(score, 100));

  return (
    <div>
      <div
        role="meter"
        aria-label="Compliance score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(value.toFixed(1))}
        className={clsx('relative h-2 rounded-full', track[tone])}
      >
        <div
          className={clsx('h-full rounded-full transition-[width] duration-500 ease-out', toneFill[tone])}
          style={{ width: `${value}%` }}
        />
        {thresholds.map((threshold) => (
          <span
            key={threshold}
            aria-hidden="true"
            className="absolute -top-1 h-4 w-0.5 rounded-full bg-fg-faint ring-2 ring-surface"
            style={{ left: `calc(${threshold}% - 1px)` }}
          />
        ))}
      </div>
      <div aria-hidden="true" className="relative mt-2 h-4 text-2xs tabular-nums text-fg-subtle">
        <span className="absolute left-0">0</span>
        {thresholds.map((threshold) => (
          <span key={threshold} className="absolute -translate-x-1/2" style={{ left: `${threshold}%` }}>
            {threshold}
          </span>
        ))}
        <span className="absolute right-0">100</span>
      </div>
    </div>
  );
}
