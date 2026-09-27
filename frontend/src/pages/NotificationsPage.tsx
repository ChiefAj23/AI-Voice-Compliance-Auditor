import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Bell, CheckCircle2, Filter, Loader2, Mail, Pencil, Plus, Send, Trash2, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { apiService } from '../services/api';
import type { NotificationConfig } from '../services/api';
import { formatDateTime, formatNumber, formatRelative } from '../utils/format';
import {
  Badge,
  Card,
  EmptyState,
  Field,
  IconButton,
  Modal,
  PageHeader,
  SegmentedControl,
  Spinner,
  Switch,
  useConfirm,
  useToast,
} from '../components/ui';
import { errorDetail } from '../utils/errors';

type StatusFilter = 'all' | 'active' | 'paused';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

/** Threshold the backend applies when no minimum score is set (api/email_notification.py). */
const DEFAULT_MIN_SCORE = 70;

/** Placeholders the email service replaces in the subject and body. */
const EMAIL_PLACEHOLDERS = [
  'compliance_score',
  'toxicity_score',
  'sentiment',
  'emotion',
  'total_alerts',
  'critical_alerts',
  'warning_alerts',
  'filename',
  'timestamp',
];

/** Result of POST /notification_configs/{id}/test. */
interface NotificationTestResponse {
  success?: boolean;
  recipients?: string[] | null;
  error?: string | null;
}

const emptyForm = (): Partial<NotificationConfig> => ({
  name: '',
  description: '',
  email_recipients: [],
  notify_on_critical: true,
  notify_on_warning: false,
  notify_on_compliance_low: true,
  notify_on_custom_rule: true,
  min_compliance_score: undefined,
  email_subject_template: '',
  email_body_template: '',
  rate_limit_minutes: 60,
  is_active: true,
});

function triggerLabels(config: NotificationConfig): string[] {
  const labels: string[] = [];
  if (config.notify_on_critical) labels.push('Critical alerts');
  if (config.notify_on_warning) labels.push('Warnings');
  if (config.notify_on_compliance_low) labels.push(`Score below ${config.min_compliance_score || DEFAULT_MIN_SCORE}`);
  if (config.notify_on_custom_rule) labels.push('Rule violations');
  return labels;
}

/** 30 -> "At most every 30 min", 60 -> "At most once an hour". */
function rateLimitLabel(minutes: number | null | undefined): string {
  const value = minutes || 60;
  if (value % 1440 === 0) return value === 1440 ? 'At most once a day' : `At most every ${value / 1440} days`;
  if (value % 60 === 0) return value === 60 ? 'At most once an hour' : `At most every ${value / 60} hours`;
  return value === 1 ? 'At most once a minute' : `At most every ${value} min`;
}

/** Titled group of fields inside the create/edit dialog. */
function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="py-6 first:pt-0 last:pb-0">
      <h3 className="section-title">{title}</h3>
      {description && <p className="help-text mt-0.5">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * One notification in the list. Narrow screens: name and actions on top, details and
 * delivery stats full width below. Wide screens: delivery stats become a column.
 */
function NotificationRow({
  title,
  actions,
  details,
  meta,
  footer,
}: {
  title: ReactNode;
  actions: ReactNode;
  details: ReactNode;
  meta: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_13rem_auto]">
      <div className="col-start-1 row-start-1 min-w-0">{title}</div>
      <div className="col-start-2 row-start-1 -mr-2 -mt-1.5 flex items-center gap-0.5 self-start lg:col-start-3 lg:row-span-2 lg:row-start-1">
        {actions}
      </div>
      <div className="col-span-2 col-start-1 row-start-2 mt-0.5 min-w-0 lg:col-span-1 lg:col-start-1">{details}</div>
      <div className="col-span-2 col-start-1 row-start-3 mt-3 min-w-0 text-[13px] lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
        {meta}
      </div>
      {footer && <div className="col-span-2 col-start-1 row-start-4 mt-4 lg:col-span-3 lg:col-start-1 lg:row-start-3">{footer}</div>}
    </li>
  );
}

function TestResultCallout({ result, onDismiss }: { result: NotificationTestResponse; onDismiss: () => void }) {
  const sent = Boolean(result.success);
  const Icon = sent ? CheckCircle2 : XCircle;

  return (
    <div className={clsx('callout', sent ? 'callout-success' : 'callout-danger')}>
      <Icon aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{sent ? 'Test email sent' : 'Test email failed'}</p>
        {sent && result.recipients && result.recipients.length > 0 && (
          <p className="mt-0.5 break-words">Sent to {result.recipients.join(', ')}.</p>
        )}
        {result.error && <p className="mt-0.5 break-words">{result.error}</p>}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss test result"
        className="-m-1 grid h-6 w-6 shrink-0 place-items-center rounded opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function NotificationsPage() {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NotificationConfig | null>(null);
  const [filter, setFilter] = useState<{ isActive?: boolean }>({});
  const [testResult, setTestResult] = useState<{ config: NotificationConfig; result: NotificationTestResponse } | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<NotificationConfig>>(emptyForm);

  const [emailInput, setEmailInput] = useState('');

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    loadConfigs();
  }, [filter]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNotificationConfigs(filter.isActive);
      setConfigs(response.configs);
    } catch (error) {
      console.error('Failed to load notification configs:', error);
      toast.error('Could not load notifications', 'Check that the API is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingConfig?.id) {
        await apiService.updateNotificationConfig(editingConfig.id, formData);
        toast.success('Notification updated');
      } else {
        await apiService.createNotificationConfig(formData);
        toast.success('Notification created');
      }
      setShowForm(false);
      setEditingConfig(null);
      resetForm();
      loadConfigs();
    } catch (error) {
      console.error('Failed to save notification config:', error);
      toast.error('Could not save notification', errorDetail(error));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (config: NotificationConfig) => {
    setEditingConfig(config);
    setFormData(config);
    // Existing addresses already show as removable chips; the input is only for adding more.
    setEmailInput('');
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const config = configs.find((item) => item.id === id);
    const confirmed = await confirm({
      title: 'Delete notification?',
      description: `${config ? `"${config.name}"` : 'This notification'} will stop sending emails. This can't be undone.`,
      confirmLabel: 'Delete notification',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteNotificationConfig(id);
      if (testResult?.config.id === id) setTestResult(null);
      toast.success('Notification deleted');
      loadConfigs();
    } catch (error) {
      console.error('Failed to delete notification config:', error);
      toast.error('Could not delete notification', errorDetail(error));
    }
  };

  const handleTest = async (config: NotificationConfig) => {
    setTestingId(config.id ?? null);
    try {
      const result: NotificationTestResponse = (await apiService.testNotificationConfig(config.id!)) ?? {};
      setTestResult({ config: config, result });
      if (result.success) {
        toast.success(
          'Test email sent',
          result.recipients && result.recipients.length > 0 ? `Sent to ${result.recipients.join(', ')}.` : undefined,
        );
      } else {
        toast.error('Test email failed', result.error || undefined);
      }
    } catch (error) {
      console.error('Failed to test notification:', error);
      toast.error('Could not send test email', errorDetail(error));
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEmailInput('');
  };

  const addEmail = () => {
    const emails = emailInput.split(',').map(e => e.trim()).filter(e => e);
    setFormData({ ...formData, email_recipients: [...(formData.email_recipients || []), ...emails] });
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    setFormData({
      ...formData,
      email_recipients: (formData.email_recipients || []).filter(e => e !== email),
    });
  };

  const openCreateForm = () => {
    resetForm();
    setEditingConfig(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingConfig(null);
    resetForm();
  };

  const statusFilter: StatusFilter = filter.isActive === undefined ? 'all' : filter.isActive ? 'active' : 'paused';

  const changeStatusFilter = (value: StatusFilter) => {
    if (value === statusFilter) return;
    setFilter(value === 'all' ? {} : { isActive: value === 'active' });
  };

  const recipients = formData.email_recipients || [];

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Email alerts when calls need attention."
        actions={
          <button onClick={openCreateForm} className="btn btn-primary">
            <Plus />
            Add notification
          </button>
        }
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SegmentedControl
            label="Filter notifications by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={changeStatusFilter}
          />
          {!loading && configs.length > 0 && (
            <p className="text-[13px] tabular-nums text-fg-subtle">
              {configs.length} {configs.length === 1 ? 'notification' : 'notifications'}
            </p>
          )}
        </div>

        {loading ? (
          <div role="status">
            <span className="sr-only">Loading notifications…</span>
            <ul className="divide-y divide-line" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="skeleton h-4 w-48" />
                  <div className="skeleton mt-2 h-3 w-72 max-w-full" />
                  <div className="mt-3.5 flex gap-1.5">
                    <div className="skeleton h-5 w-40" />
                    <div className="skeleton h-5 w-36" />
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <div className="skeleton h-5 w-24" />
                    <div className="skeleton h-5 w-28" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : configs.length === 0 ? (
          filter.isActive !== undefined ? (
            <EmptyState
              icon={Filter}
              title={filter.isActive ? 'No active notifications' : 'No paused notifications'}
              description="Try another status filter."
              action={
                <button onClick={() => setFilter({})} className="btn btn-secondary">
                  Show all notifications
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Bell}
              title="No notifications yet"
              description="Email your team when a call scores low, raises an alert or breaks a compliance rule."
              action={
                <button onClick={openCreateForm} className="btn btn-secondary">
                  <Plus />
                  Add notification
                </button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-line">
            {configs.map((config) => {
              const triggers = triggerLabels(config);
              const configRecipients = config.email_recipients || [];
              const shownRecipients = configRecipients.slice(0, 2);
              const hiddenRecipients = configRecipients.slice(2);
              const sentCount = config.sent_count || 0;
              const isTesting = testingId !== null && testingId === config.id;
              const result = testResult && testResult.config.id === config.id ? testResult.result : null;

              return (
                <NotificationRow
                  key={config.id}
                  title={
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-medium text-fg">{config.name}</p>
                      {config.is_active ? (
                        <Badge tone="success" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="neutral" dot>
                          Paused
                        </Badge>
                      )}
                    </div>
                  }
                  actions={
                    <>
                      <IconButton
                        icon={isTesting ? Loader2 : Send}
                        label={isTesting ? 'Sending test…' : 'Send test'}
                        onClick={() => handleTest(config)}
                        disabled={isTesting}
                        className={isTesting ? '[&>svg]:animate-spin' : undefined}
                      />
                      <IconButton icon={Pencil} label="Edit notification" onClick={() => handleEdit(config)} />
                      <IconButton
                        icon={Trash2}
                        label="Delete notification"
                        tone="danger"
                        onClick={() => handleDelete(config.id!)}
                      />
                    </>
                  }
                  details={
                    <>
                      {config.description && <p className="text-[13px] text-fg-subtle">{config.description}</p>}
                      <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                        <span className="sr-only">Recipients:</span>
                        {configRecipients.length === 0 ? (
                          <span className="text-xs text-fg-faint">No recipients</span>
                        ) : (
                          shownRecipients.map((email, idx) => (
                            <Badge key={`${email}-${idx}`} className="max-w-[16rem]">
                              <span className="truncate" title={email}>
                                {email}
                              </span>
                            </Badge>
                          ))
                        )}
                        {hiddenRecipients.length > 0 && (
                          <span title={hiddenRecipients.join(', ')}>
                            <Badge className="tabular-nums">
                              +{hiddenRecipients.length}
                              <span className="sr-only"> more: {hiddenRecipients.join(', ')}</span>
                            </Badge>
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {triggers.length > 0 ? (
                          triggers.map((label) => <Badge key={label}>{label}</Badge>)
                        ) : (
                          <span className="text-xs text-fg-faint">No triggers selected</span>
                        )}
                      </div>
                    </>
                  }
                  meta={
                    <div className="space-y-0.5">
                      {sentCount === 0 && !config.last_sent ? (
                        <p className="text-fg-subtle">Never sent</p>
                      ) : (
                        <>
                          <p className="tabular-nums text-fg-muted">
                            {formatNumber(sentCount)} {sentCount === 1 ? 'alert' : 'alerts'} sent
                          </p>
                          <p className="text-fg-subtle" title={config.last_sent ? formatDateTime(config.last_sent) : undefined}>
                            {config.last_sent ? `Last sent ${formatRelative(config.last_sent)}` : 'Not sent yet'}
                          </p>
                        </>
                      )}
                      <p className="text-fg-subtle">{rateLimitLabel(config.rate_limit_minutes)}</p>
                    </div>
                  }
                  footer={result && <TestResultCallout result={result} onDismiss={() => setTestResult(null)} />}
                />
              );
            })}
          </ul>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={closeForm}
        size="lg"
        title={editingConfig ? 'Edit notification' : 'Add notification'}
        description={
          editingConfig
            ? 'Changes apply to the next alert.'
            : 'Email a list of people when an analysis matches your triggers.'
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" form="notification-form" className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />}
              {editingConfig ? 'Save changes' : 'Create notification'}
            </button>
          </>
        }
      >
        <form id="notification-form" onSubmit={handleSubmit} className="divide-y divide-line">
          <FormSection title="Details">
            <div className="grid gap-4">
              <Field label="Name" htmlFor="notification-name" required>
                <input
                  id="notification-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Compliance team alerts"
                  required
                />
              </Field>
              <Field label="Description" htmlFor="notification-description">
                <textarea
                  id="notification-description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={2}
                  placeholder="Optional note for your team"
                />
              </Field>
            </div>
            <Switch
              className="mt-5"
              checked={!!formData.is_active}
              onChange={(checked) => setFormData({ ...formData, is_active: checked })}
              label="Active"
              description="Paused notifications keep their settings but send nothing."
            />
          </FormSection>

          <FormSection title="Recipients" description="Everyone listed here gets each alert email.">
            <Field
              label="Add email addresses"
              htmlFor="notification-recipients"
              help="Separate several addresses with commas, then press Enter or select Add."
              required
            >
              <div className="flex gap-2">
                <input
                  id="notification-recipients"
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="input flex-1"
                  placeholder="name@company.com, team@company.com"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
                <button type="button" onClick={addEmail} className="btn btn-secondary">
                  Add
                </button>
              </div>
            </Field>
            {recipients.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Recipients">
                {recipients.map((email, idx) => (
                  <li key={idx} className="min-w-0 max-w-full">
                    <Badge className="max-w-full gap-1 pr-1">
                      <span className="truncate">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        aria-label={`Remove ${email}`}
                        title="Remove"
                        className="grid h-4 w-4 shrink-0 place-items-center rounded-sm text-fg-subtle transition-colors hover:bg-surface-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-fg-faint">No recipients added yet.</p>
            )}
          </FormSection>

          <FormSection title="Triggers" description="Send an email when an analysis matches any of these.">
            <div className="space-y-4">
              <Switch
                checked={!!formData.notify_on_critical}
                onChange={(checked) => setFormData({ ...formData, notify_on_critical: checked })}
                label="Critical alerts"
                description="The analysis raised at least one critical alert."
              />
              <Switch
                checked={!!formData.notify_on_warning}
                onChange={(checked) => setFormData({ ...formData, notify_on_warning: checked })}
                label="Warnings"
                description="The analysis raised at least one warning."
              />
              <div>
                <Switch
                  checked={!!formData.notify_on_compliance_low}
                  onChange={(checked) => setFormData({ ...formData, notify_on_compliance_low: checked })}
                  label="Low compliance score"
                  description="The call scored below your threshold."
                />
                {formData.notify_on_compliance_low && (
                  <Field
                    label="Score threshold"
                    htmlFor="notification-min-score"
                    help={`Calls scoring below this send an email. Leave empty to use ${DEFAULT_MIN_SCORE}.`}
                    className="mt-3 pl-12"
                  >
                    <input
                      id="notification-min-score"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.min_compliance_score || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          min_compliance_score: e.target.value ? parseFloat(e.target.value) : undefined,
                        })
                      }
                      className="input w-28 tabular-nums"
                      placeholder={String(DEFAULT_MIN_SCORE)}
                    />
                  </Field>
                )}
              </div>
              <Switch
                checked={!!formData.notify_on_custom_rule}
                onChange={(checked) => setFormData({ ...formData, notify_on_custom_rule: checked })}
                label="Custom rule violations"
                description="The call matched one of your compliance rules."
              />
            </div>
          </FormSection>

          <FormSection title="Email content" description="Leave these empty to use the default subject and body.">
            <div className="space-y-4">
              <Field label="Subject" htmlFor="notification-subject">
                <input
                  id="notification-subject"
                  type="text"
                  value={formData.email_subject_template || ''}
                  onChange={(e) => setFormData({ ...formData, email_subject_template: e.target.value })}
                  className="input"
                  placeholder="Compliance Alert - Voice Audit"
                />
              </Field>
              <Field label="Body (HTML)" htmlFor="notification-body">
                <textarea
                  id="notification-body"
                  value={formData.email_body_template || ''}
                  onChange={(e) => setFormData({ ...formData, email_body_template: e.target.value })}
                  className="input font-mono text-[13px]"
                  rows={8}
                  placeholder="<p>Compliance score: {{compliance_score}}</p>"
                  spellCheck={false}
                />
              </Field>
              <div>
                <p className="text-xs font-medium text-fg-muted">Placeholders for the subject and body</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {EMAIL_PLACEHOLDERS.map((name) => (
                    <code key={name} className="code-chip">{`{{${name}}}`}</code>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Rate limit"
            description="Alerts that arrive before the window has passed are skipped, so a burst of calls sends one email."
          >
            <Field label="Minimum time between emails" htmlFor="notification-rate-limit" required>
              <div className="flex items-center gap-2">
                <input
                  id="notification-rate-limit"
                  type="number"
                  min="1"
                  value={formData.rate_limit_minutes || 60}
                  onChange={(e) => setFormData({ ...formData, rate_limit_minutes: parseInt(e.target.value) || 60 })}
                  className="input w-28 tabular-nums"
                  required
                />
                <span className="text-sm text-fg-subtle">minutes</span>
              </div>
            </Field>
          </FormSection>
        </form>
      </Modal>
    </div>
  );
}
