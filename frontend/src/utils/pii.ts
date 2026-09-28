/**
 * Personal data the API removes from transcripts (api/pii.py). Each kind is replaced by a
 * placeholder such as [CARD]; the analysis keeps how many of each kind were found.
 */

/** Singular and plural names for each kind, keyed as the API counts them. */
const KINDS: Record<string, [string, string]> = {
  card_number: ['card number', 'card numbers'],
  ssn: ['Social Security number', 'Social Security numbers'],
  iban: ['IBAN', 'IBANs'],
  email: ['email address', 'email addresses'],
  phone: ['phone number', 'phone numbers'],
  account_number: ['account number', 'account numbers'],
  cvv: ['security code', 'security codes'],
  pin: ['PIN', 'PINs'],
  card_expiry: ['card expiry date', 'card expiry dates'],
  date_of_birth: ['date of birth', 'dates of birth'],
  number: ['long number', 'long numbers'],
  name: ['name', 'names'],
};

/** Placeholder in the transcript -> the kind it stands for. */
export const PLACEHOLDERS: Record<string, string> = {
  CARD: 'card_number',
  SSN: 'ssn',
  IBAN: 'iban',
  EMAIL: 'email',
  PHONE: 'phone',
  ACCOUNT: 'account_number',
  CVV: 'cvv',
  PIN: 'pin',
  EXPIRY: 'card_expiry',
  DOB: 'date_of_birth',
  NUMBER: 'number',
  NAME: 'name',
};

export const PLACEHOLDER_PATTERN = new RegExp(`\\[(${Object.keys(PLACEHOLDERS).join('|')})\\]`, 'g');

export interface PiiSummary {
  redacted: boolean;
  counts: Record<string, number>;
  sensitive: string[];
}

export function piiName(kind: string, count = 1): string {
  const names = KINDS[kind];
  if (!names) return kind.replace(/_/g, ' ');
  return count === 1 ? names[0] : names[1];
}

/** "1 card number, 2 phone numbers" in a fixed, readable order. */
export function describePii(counts: Record<string, number> | null | undefined): string {
  if (!counts) return '';
  return Object.keys(KINDS)
    .filter((kind) => (counts[kind] ?? 0) > 0)
    .map((kind) => `${counts[kind]} ${piiName(kind, counts[kind])}`)
    .join(', ');
}

export function totalPii(counts: Record<string, number> | null | undefined): number {
  return Object.values(counts ?? {}).reduce((sum, value) => sum + (value || 0), 0);
}
