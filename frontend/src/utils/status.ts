import { humanize } from './format';

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

// Thresholds mirror the backend defaults in api/alert_system.py (AlertThresholds),
// so a badge turns amber or red exactly when the backend raises an alert.
const COMPLIANCE_WARNING = 70;
const COMPLIANCE_CRITICAL = 50;
const TOXICITY_WARNING = 0.5;
const TOXICITY_CRITICAL = 0.7;

export function complianceTone(score: number | null | undefined): Tone {
  if (score == null || Number.isNaN(score)) return 'neutral';
  if (score < COMPLIANCE_CRITICAL) return 'danger';
  if (score < COMPLIANCE_WARNING) return 'warning';
  return 'success';
}

export function complianceLabel(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return 'Not scored';
  if (score < COMPLIANCE_CRITICAL) return 'Non-compliant';
  if (score < COMPLIANCE_WARNING) return 'Needs review';
  return 'Compliant';
}

/** Toxicity is a 0–1 probability. */
export function toxicityTone(ratio: number | null | undefined): Tone {
  if (ratio == null || Number.isNaN(ratio)) return 'neutral';
  if (ratio > TOXICITY_CRITICAL) return 'danger';
  if (ratio > TOXICITY_WARNING) return 'warning';
  return 'success';
}

// The backend's sentiment model (cardiffnlp/twitter-roberta-base-sentiment) answers LABEL_0,
// LABEL_1 and LABEL_2 for negative, neutral and positive. Other labels pass through.
const SENTIMENT_LABELS: Record<string, string> = { label_0: 'negative', label_1: 'neutral', label_2: 'positive' };

export function sentimentName(sentiment: string | null | undefined): string {
  const value = (sentiment ?? '').trim().toLowerCase();
  return SENTIMENT_LABELS[value] ?? value;
}

/** Display text for a sentiment label: "LABEL_2" -> "Positive". */
export function sentimentLabel(sentiment: string | null | undefined): string {
  return humanize(sentimentName(sentiment));
}

/** Sentiment is polarity, not status: blue / gray / red, so it never reads as a compliance verdict. */
export function sentimentTone(sentiment: string | null | undefined): Tone {
  const value = sentimentName(sentiment);
  if (value.startsWith('pos')) return 'accent';
  if (value.startsWith('neg')) return 'danger';
  return 'neutral';
}

export function severityTone(severity: string | null | undefined): Tone {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high':
      return 'danger';
    case 'warning':
    case 'medium':
      return 'warning';
    case 'info':
    case 'low':
      return 'info';
    default:
      return 'neutral';
  }
}

/** Solid fill for meters and bars, keyed by tone. */
export const toneFill: Record<Tone, string> = {
  neutral: 'bg-fg-faint',
  accent: 'bg-accent',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};

/** Foreground color for icons and figures, keyed by tone. */
export const toneText: Record<Tone, string> = {
  neutral: 'text-fg-muted',
  accent: 'text-accent-fg',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-sky-600 dark:text-sky-400',
};
