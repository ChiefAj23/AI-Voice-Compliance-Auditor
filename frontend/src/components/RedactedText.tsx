import type { ReactNode } from 'react';
import { Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { PLACEHOLDER_PATTERN, PLACEHOLDERS, describePii, piiName, totalPii } from '../utils/pii';
import type { PiiSummary } from '../utils/pii';

/** A transcript with each placeholder the API left ([CARD], [EMAIL], ...) shown as a small chip. */
export function RedactedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const name = piiName(PLACEHOLDERS[match[1]]);
    parts.push(
      <span
        key={index}
        title={`${name} removed`}
        className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-surface-subtle px-1.5 py-px align-baseline text-xs font-medium text-fg-subtle ring-1 ring-inset ring-line"
      >
        <Lock className="h-3 w-3" aria-hidden="true" />
        {name}
        <span className="sr-only"> removed</span>
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

/** What the redaction found on this call; nothing when redaction did not run. */
export function PrivacyNote({ privacy }: { privacy?: PiiSummary | null }) {
  if (!privacy?.redacted) return null;
  if (totalPii(privacy.counts) === 0) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-fg-subtle">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Checked for personal data before analysis: none found.
      </p>
    );
  }
  const sensitive = privacy.sensitive.length > 0;
  return (
    <div className={`callout ${sensitive ? 'callout-warning' : 'callout-info'}`} role="note">
      {sensitive ? <ShieldAlert /> : <ShieldCheck />}
      <p>
        <span className="font-medium">Personal data removed before analysis: </span>
        {describePii(privacy.counts)}.
        {sensitive && ' Payment or identity details were spoken on this call.'}
      </p>
    </div>
  );
}
