import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Eraser, ShieldCheck } from 'lucide-react';
import { privacyApi } from '../services/api';
import type { PrivacyPolicy } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime, formatNumber } from '../utils/format';
import { errorDetail } from '../utils/errors';
import { Badge, Card, CardBody, CardFooter, CardHeader, Spinner, useConfirm, useToast } from './ui';

function kept(days: number): string {
  return days > 0 ? `${formatNumber(days)} days` : 'Until deleted';
}

function Row({ label, value, help }: { label: string; value: ReactNode; help?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        {help && <p className="mt-0.5 text-[13px] text-fg-subtle">{help}</p>}
      </div>
      <div className="shrink-0 text-right text-sm text-fg-muted">{value}</div>
    </div>
  );
}

/** The deployment's privacy and retention policy, read from the API; administrators can apply retention now. */
export default function PrivacySettings() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [policy, setPolicy] = useState<PrivacyPolicy | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const canPurge = hasPermission('admin:all');

  useEffect(() => {
    privacyApi
      .policy()
      .then(setPolicy)
      .catch((err) => setError(errorDetail(err) || 'The privacy policy could not be loaded.'));
  }, []);

  const retentionOn = !!policy && (policy.retention_days > 0 || policy.audit_retention_days > 0);

  const runNow = async () => {
    if (!policy) return;
    const confirmed = await confirm({
      title: 'Apply the retention policy now?',
      description: (
        <p>
          Analyses older than {kept(policy.retention_days).toLowerCase()} and audit log entries older than{' '}
          {kept(policy.audit_retention_days).toLowerCase()} are deleted permanently. The daily run would do the same.
        </p>
      ),
      confirmLabel: 'Delete expired data',
      tone: 'danger',
    });
    if (!confirmed) return;
    setRunning(true);
    try {
      const { deleted, policy: next } = await privacyApi.purge();
      setPolicy(next);
      toast.success(
        'Retention applied',
        `${formatNumber(deleted.analyses)} analyses and ${formatNumber(deleted.audit_logs)} audit log entries deleted.`,
      );
    } catch (err) {
      toast.error('Could not apply retention', errorDetail(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Privacy and retention"
        description="Set on the server with PII_REDACTION, PII_REDACT_NAMES, RETENTION_DAYS and AUDIT_RETENTION_DAYS."
      />
      {error ? (
        <CardBody>
          <p className="text-sm text-fg-muted">{error}</p>
        </CardBody>
      ) : !policy ? (
        <CardBody className="flex items-center gap-2 text-sm text-fg-muted">
          <Spinner /> Loading…
        </CardBody>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          <Row
            label="Personal data redaction"
            help="Card numbers, Social Security numbers, emails, phone numbers, account numbers, security codes and dates of birth are replaced before a call is analyzed, stored or sent anywhere."
            value={<Badge tone={policy.pii_redaction ? 'success' : 'warning'} dot>{policy.pii_redaction ? 'On' : 'Off'}</Badge>}
          />
          <Row
            label="Names"
            help="Person names are found with a language model, so this is opt-in."
            value={<Badge tone={policy.redact_names ? 'success' : 'neutral'} dot>{policy.redact_names ? 'Redacted' : 'Kept'}</Badge>}
          />
          <Row
            label="Recordings"
            help="Each upload is deleted as soon as its analysis finishes, or fails."
            value={policy.recordings_stored ? 'Stored' : 'Never stored'}
          />
          <Row label="Analyses are kept" value={kept(policy.retention_days)} />
          <Row label="Audit log entries are kept" value={kept(policy.audit_retention_days)} />
          <Row
            label="Last retention run"
            value={
              policy.last_purge
                ? `${formatDateTime(policy.last_purge.at)} · ${formatNumber(policy.last_purge.analyses)} analyses, ${formatNumber(policy.last_purge.audit_logs)} log entries`
                : retentionOn
                  ? 'Not yet (runs daily)'
                  : 'Off'
            }
          />
        </div>
      )}
      {canPurge && policy && (
        <CardFooter>
          <p className="flex items-center gap-1.5 text-[13px] text-fg-subtle">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {retentionOn ? 'Every run is recorded in the audit log.' : 'Set a retention period to enable this.'}
          </p>
          <button type="button" className="btn btn-secondary" onClick={runNow} disabled={!retentionOn || running}>
            {running ? <Spinner /> : <Eraser />}
            {running ? 'Applying…' : 'Apply retention now'}
          </button>
        </CardFooter>
      )}
    </Card>
  );
}
