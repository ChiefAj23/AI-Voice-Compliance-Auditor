import { format, formatDistanceToNow, isValid } from 'date-fns';

type DateInput = string | number | Date | null | undefined;

/**
 * How to read a timestamp without a zone designator. The API stores times with
 * datetime.utcnow() and serializes them without "Z", so the default is UTC. Values
 * generated with datetime.now() during an analysis (alert and rule timestamps) are
 * server-local; pass { naive: 'local' } for those.
 */
interface DateOptions {
  naive?: 'utc' | 'local';
}

const NAIVE_ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const toDate = (value: Exclude<DateInput, null | undefined>, { naive = 'utc' }: DateOptions = {}) => {
  if (value instanceof Date) return value;
  if (naive === 'utc' && typeof value === 'string' && NAIVE_ISO_DATETIME.test(value)) {
    return new Date(`${value.replace(' ', 'T')}Z`);
  }
  return new Date(value);
};

const EMPTY = '—';

/** 0.1234 -> "12.3%". */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || Number.isNaN(ratio)) return EMPTY;
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Compliance scores are on a 0–100 scale. */
export function formatScore(score: number | null | undefined, digits = 1): string {
  if (score == null || Number.isNaN(score)) return EMPTY;
  return score.toFixed(digits);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return EMPTY;
  return new Intl.NumberFormat('en-US').format(value);
}

/** Seconds -> "m:ss". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(value: DateInput, options?: DateOptions): string {
  if (value == null) return EMPTY;
  const date = toDate(value, options);
  return isValid(date) ? format(date, 'MMM d, yyyy') : EMPTY;
}

export function formatDateTime(value: DateInput, options?: DateOptions): string {
  if (value == null) return EMPTY;
  const date = toDate(value, options);
  return isValid(date) ? format(date, 'MMM d, yyyy, HH:mm') : EMPTY;
}

/** "3 hours ago" */
export function formatRelative(value: DateInput, options?: DateOptions): string {
  if (value == null) return EMPTY;
  const date = toDate(value, options);
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : EMPTY;
}

/** "follow_up" -> "Follow up", "POSITIVE" -> "Positive" (short acronyms like "QA" are kept) */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  let text = value.replace(/[_-]+/g, ' ').trim();
  if (text.length > 3 && text === text.toUpperCase()) text = text.toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Identifiers shown as names keep their case: "Speaker_1" -> "Speaker 1". */
export function tidyLabel(value: string | null | undefined): string {
  return (value ?? '').replace(/_+/g, ' ').trim();
}

// Method and model ids the analysis pipeline reports (api/summarization.py,
// api/intent_classification.py, api/topic_extraction.py), in reader-friendly words.
const METHOD_NAMES: Record<string, string> = {
  'bart-large-cnn': 'BART large CNN',
  extractive: 'extractive summarization',
  extractive_textrank: 'TextRank extraction',
  ml_zero_shot: 'zero-shot classification',
  keyword_based: 'keyword matching',
  keyword_matching: 'keyword matching',
  rule_based: 'rules',
  lda: 'LDA topic modeling',
  tfidf: 'TF-IDF',
};

/** A pipeline method or model id as words, or '' when the pipeline reports none. */
export function methodLabel(value: string | null | undefined): string {
  const key = (value ?? '').trim().toLowerCase();
  if (!key || key === 'none') return '';
  return METHOD_NAMES[key] ?? humanize(key).toLowerCase();
}
