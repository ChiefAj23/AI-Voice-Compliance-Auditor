import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CheckCircle2, Filter, Loader2, Pencil, Plus, Send, Trash2, Webhook as WebhookIcon, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { apiService } from '../services/api';
import type { Webhook } from '../services/api';
import { formatDateTime, formatNumber, formatRelative, humanize } from '../utils/format';
import { toneText } from '../utils/status';
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

/** Threshold the backend applies when no minimum score is set (api/webhook_service.py). */
const DEFAULT_MIN_SCORE = 70;

const AUTH_LABELS: Record<string, string | undefined> = {
  none: 'No auth',
  bearer: 'Bearer token',
  basic: 'Basic auth',
  custom: 'Custom auth',
};

/** Result of POST /webhooks/{id}/test. */
interface WebhookTestResponse {
  success?: boolean;
  status_code?: number | null;
  response?: unknown;
  error?: string | null;
}

const emptyForm = (): Partial<Webhook> => ({
  name: '',
  description: '',
  url: '',
  method: 'POST',
  headers: {},
  auth_type: 'none',
  auth_config: {},
  trigger_on_critical: true,
  trigger_on_warning: false,
  trigger_on_compliance_low: true,
  trigger_on_custom_rule: true,
  min_compliance_score: undefined,
  payload_template: undefined,
  include_transcription: true,
  include_analysis: true,
  is_active: true,
});

function hasPayloadTemplate(template: Webhook['payload_template'] | null): boolean {
  return !!template && Object.keys(template).length > 0;
}

function triggerLabels(webhook: Webhook): string[] {
  const labels: string[] = [];
  if (webhook.trigger_on_critical) labels.push('Critical alerts');
  if (webhook.trigger_on_warning) labels.push('Warnings');
  if (webhook.trigger_on_compliance_low) labels.push(`Score below ${webhook.min_compliance_score || DEFAULT_MIN_SCORE}`);
  if (webhook.trigger_on_custom_rule) labels.push('Rule violations');
  return labels;
}

function responseText(value: unknown): string | null {
  if (value == null || value === '') return null;
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
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
 * One webhook in the list. Narrow screens: name and actions on top, details and
 * delivery stats full width below. Wide screens: delivery stats become a column.
 */
function WebhookRow({
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

function TestResultCallout({ result, onDismiss }: { result: WebhookTestResponse; onDismiss: () => void }) {
  const delivered = Boolean(result.success);
  const body = responseText(result.response);
  const Icon = delivered ? CheckCircle2 : XCircle;

  return (
    <div className={clsx('callout', delivered ? 'callout-success' : 'callout-danger')}>
      <Icon aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{delivered ? 'Test event delivered' : 'Test event failed'}</p>
        {result.status_code != null && (
          <p className="mt-0.5 tabular-nums">The endpoint responded with HTTP {result.status_code}.</p>
        )}
        {result.error && <p className="mt-0.5 break-words">{result.error}</p>}
        {body && (
          <>
            <p className="mt-3 text-xs font-medium">Response body</p>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs leading-5 text-fg-muted">
              {body}
            </pre>
          </>
        )}
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

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [filter, setFilter] = useState<{ isActive?: boolean }>({});
  const [testResult, setTestResult] = useState<{ webhook: Webhook; result: WebhookTestResponse } | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Webhook>>(emptyForm);
  const [payloadText, setPayloadText] = useState('');
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const payloadRef = useRef<HTMLTextAreaElement>(null);

  const [bearerToken, setBearerToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');

  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    loadWebhooks();
  }, [filter]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await apiService.getWebhooks(filter.isActive);
      setWebhooks(response.webhooks);
    } catch (error) {
      console.error('Failed to load webhooks:', error);
      toast.error('Could not load webhooks', 'Check that the API is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // The template editor holds text; the API takes a JSON object or nothing.
    let payloadTemplate = formData.payload_template;
    if (payloadText.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(payloadText);
      } catch {
        parsed = undefined;
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setPayloadError('Enter a valid JSON object, or leave this empty to send the default payload.');
        payloadRef.current?.focus();
        return;
      }
      payloadTemplate = parsed as Webhook['payload_template'];
    } else if (hasPayloadTemplate(formData.payload_template)) {
      // Template cleared: an empty object makes the backend send the default payload again.
      payloadTemplate = {};
    }

    setSaving(true);
    try {
      // Prepare auth config
      let authConfig = {};
      if (formData.auth_type === 'bearer' && bearerToken) {
        authConfig = { token: bearerToken };
      } else if (formData.auth_type === 'basic' && basicUsername && basicPassword) {
        authConfig = { username: basicUsername, password: basicPassword };
      }

      const webhookData = {
        ...formData,
        payload_template: payloadTemplate,
        auth_config: Object.keys(authConfig).length > 0 ? authConfig : undefined,
      };

      if (editingWebhook?.id) {
        await apiService.updateWebhook(editingWebhook.id, webhookData);
        toast.success('Webhook updated');
      } else {
        await apiService.createWebhook(webhookData);
        toast.success('Webhook created');
      }
      setShowForm(false);
      setEditingWebhook(null);
      resetForm();
      loadWebhooks();
    } catch (error) {
      console.error('Failed to save webhook:', error);
      toast.error('Could not save webhook', errorDetail(error));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormData(webhook);
    setPayloadText(hasPayloadTemplate(webhook.payload_template) ? JSON.stringify(webhook.payload_template, null, 2) : '');
    setPayloadError(null);
    if (webhook.auth_type === 'bearer' && webhook.auth_config) {
      setBearerToken(webhook.auth_config.token || '');
    }
    if (webhook.auth_type === 'basic' && webhook.auth_config) {
      setBasicUsername(webhook.auth_config.username || '');
      setBasicPassword(webhook.auth_config.password || '');
    }
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const webhook = webhooks.find((item) => item.id === id);
    const confirmed = await confirm({
      title: 'Delete webhook?',
      description: `${webhook ? `"${webhook.name}"` : 'This webhook'} will stop receiving events. This can't be undone.`,
      confirmLabel: 'Delete webhook',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteWebhook(id);
      if (testResult?.webhook.id === id) setTestResult(null);
      toast.success('Webhook deleted');
      loadWebhooks();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      toast.error('Could not delete webhook', errorDetail(error));
    }
  };

  const handleTest = async (webhook: Webhook) => {
    setTestingId(webhook.id ?? null);
    try {
      const result: WebhookTestResponse = (await apiService.testWebhook(webhook.id!)) ?? {};
      setTestResult({ webhook: webhook, result });
      const status = result.status_code != null ? `HTTP ${result.status_code}` : null;
      if (result.success) {
        toast.success('Test event delivered', status ? `${webhook.name} responded with ${status}.` : undefined);
      } else {
        toast.error('Test event failed', result.error || (status ? `${webhook.name} responded with ${status}.` : undefined));
      }
    } catch (error) {
      console.error('Failed to test webhook:', error);
      toast.error('Could not send test event', errorDetail(error));
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setPayloadText('');
    setPayloadError(null);
    setBearerToken('');
    setBasicUsername('');
    setBasicPassword('');
  };

  const openCreateForm = () => {
    resetForm();
    setEditingWebhook(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingWebhook(null);
    resetForm();
  };

  const statusFilter: StatusFilter = filter.isActive === undefined ? 'all' : filter.isActive ? 'active' : 'paused';

  const changeStatusFilter = (value: StatusFilter) => {
    if (value === statusFilter) return;
    setFilter(value === 'all' ? {} : { isActive: value === 'active' });
  };

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Send analysis events to your own systems."
        actions={
          <button onClick={openCreateForm} className="btn btn-primary">
            <Plus />
            Add webhook
          </button>
        }
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <SegmentedControl
            label="Filter webhooks by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={changeStatusFilter}
          />
          {!loading && webhooks.length > 0 && (
            <p className="text-[13px] tabular-nums text-fg-subtle">
              {webhooks.length} {webhooks.length === 1 ? 'webhook' : 'webhooks'}
            </p>
          )}
        </div>

        {loading ? (
          <div role="status">
            <span className="sr-only">Loading webhooks…</span>
            <ul className="divide-y divide-line" aria-hidden="true">
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="skeleton h-4 w-48" />
                  <div className="skeleton mt-2 h-3 w-72 max-w-full" />
                  <div className="mt-3.5 flex gap-2">
                    <div className="skeleton h-5 w-12" />
                    <div className="skeleton h-5 w-80 max-w-full" />
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <div className="skeleton h-5 w-24" />
                    <div className="skeleton h-5 w-28" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : webhooks.length === 0 ? (
          filter.isActive !== undefined ? (
            <EmptyState
              icon={Filter}
              title={filter.isActive ? 'No active webhooks' : 'No paused webhooks'}
              description="Try another status filter."
              action={
                <button onClick={() => setFilter({})} className="btn btn-secondary">
                  Show all webhooks
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={WebhookIcon}
              title="No webhooks yet"
              description="Post events to Slack, a ticketing tool or your own API when a call needs attention."
              action={
                <button onClick={openCreateForm} className="btn btn-secondary">
                  <Plus />
                  Add webhook
                </button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-line">
            {webhooks.map((webhook) => {
              const triggers = triggerLabels(webhook);
              const delivered = webhook.success_count || 0;
              const failed = webhook.failure_count || 0;
              const neverTriggered = !webhook.last_triggered && delivered + failed === 0;
              const isTesting = testingId !== null && testingId === webhook.id;
              const result = testResult && testResult.webhook.id === webhook.id ? testResult.result : null;

              return (
                <WebhookRow
                  key={webhook.id}
                  title={
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-medium text-fg">{webhook.name}</p>
                      {webhook.is_active ? (
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
                        onClick={() => handleTest(webhook)}
                        disabled={isTesting}
                        className={isTesting ? '[&>svg]:animate-spin' : undefined}
                      />
                      <IconButton icon={Pencil} label="Edit webhook" onClick={() => handleEdit(webhook)} />
                      <IconButton
                        icon={Trash2}
                        label="Delete webhook"
                        tone="danger"
                        onClick={() => handleDelete(webhook.id!)}
                      />
                    </>
                  }
                  details={
                    <>
                      {webhook.description && <p className="text-[13px] text-fg-subtle">{webhook.description}</p>}
                      <div className="mt-2.5 flex min-w-0 items-center gap-2">
                        <Badge className="font-mono">{webhook.method}</Badge>
                        <code className="code-chip min-w-0 truncate" title={webhook.url}>
                          {webhook.url}
                        </code>
                        <span className="shrink-0 text-xs text-fg-subtle">
                          {AUTH_LABELS[webhook.auth_type] ?? humanize(webhook.auth_type)}
                        </span>
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
                    neverTriggered ? (
                      <p className="text-fg-subtle">Never triggered</p>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="tabular-nums text-fg-muted">
                          {formatNumber(delivered)} delivered
                          <span className="text-fg-faint" aria-hidden="true">
                            {' · '}
                          </span>
                          <span className={failed > 0 ? toneText.danger : undefined}>{formatNumber(failed)} failed</span>
                        </p>
                        <p
                          className="text-fg-subtle"
                          title={webhook.last_triggered ? formatDateTime(webhook.last_triggered) : undefined}
                        >
                          {webhook.last_triggered ? `Last triggered ${formatRelative(webhook.last_triggered)}` : 'Not triggered yet'}
                        </p>
                      </div>
                    )
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
        title={editingWebhook ? 'Edit webhook' : 'Add webhook'}
        description={
          editingWebhook
            ? 'Changes apply to the next event this webhook sends.'
            : 'Post analysis events to an HTTP endpoint when a call needs attention.'
        }
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>
              Cancel
            </button>
            <button type="submit" form="webhook-form" className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />}
              {editingWebhook ? 'Save changes' : 'Create webhook'}
            </button>
          </>
        }
      >
        <form id="webhook-form" onSubmit={handleSubmit} className="divide-y divide-line">
          <FormSection title="Endpoint" description="Where events are sent.">
            <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
              <Field label="Name" htmlFor="webhook-name" required className="sm:col-span-2">
                <input
                  id="webhook-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Compliance alerts to Slack"
                  required
                />
              </Field>
              <Field label="Method" htmlFor="webhook-method" required>
                <select
                  id="webhook-method"
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value as Webhook['method'] })}
                  className="input font-mono text-[13px]"
                  required
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </Field>
              <Field label="URL" htmlFor="webhook-url" required>
                <input
                  id="webhook-url"
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="input font-mono text-[13px]"
                  placeholder="https://example.com/hooks/voice-audit"
                  spellCheck={false}
                  required
                />
              </Field>
              <Field label="Description" htmlFor="webhook-description" className="sm:col-span-2">
                <textarea
                  id="webhook-description"
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
              description="Paused webhooks keep their settings but send nothing."
            />
          </FormSection>

          <FormSection title="Authentication" description="How the endpoint verifies that requests come from Voice Auditor.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Type" htmlFor="webhook-auth-type">
                <select
                  id="webhook-auth-type"
                  value={formData.auth_type}
                  onChange={(e) => setFormData({ ...formData, auth_type: e.target.value as Webhook['auth_type'] })}
                  className="input"
                >
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                  <option value="basic">Basic auth</option>
                  {editingWebhook?.auth_type === 'custom' && <option value="custom">Custom</option>}
                </select>
              </Field>

              {formData.auth_type === 'bearer' && (
                <Field label="Token" htmlFor="webhook-token" className="sm:col-span-2">
                  <input
                    id="webhook-token"
                    type="password"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    className="input font-mono text-[13px]"
                    placeholder="Sent as Authorization: Bearer …"
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                </Field>
              )}

              {formData.auth_type === 'basic' && (
                <>
                  <Field label="Username" htmlFor="webhook-username">
                    <input
                      id="webhook-username"
                      type="text"
                      value={basicUsername}
                      onChange={(e) => setBasicUsername(e.target.value)}
                      className="input"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Password" htmlFor="webhook-password">
                    <input
                      id="webhook-password"
                      type="password"
                      value={basicPassword}
                      onChange={(e) => setBasicPassword(e.target.value)}
                      className="input"
                      autoComplete="new-password"
                    />
                  </Field>
                </>
              )}
            </div>
            {formData.auth_type === 'custom' && (
              <p className="help-text">Custom authentication is set up through the API with request headers and is kept as is.</p>
            )}
          </FormSection>

          <FormSection title="Triggers" description="Send an event when an analysis matches any of these.">
            <div className="space-y-4">
              <Switch
                checked={!!formData.trigger_on_critical}
                onChange={(checked) => setFormData({ ...formData, trigger_on_critical: checked })}
                label="Critical alerts"
                description="The analysis raised at least one critical alert."
              />
              <Switch
                checked={!!formData.trigger_on_warning}
                onChange={(checked) => setFormData({ ...formData, trigger_on_warning: checked })}
                label="Warnings"
                description="The analysis raised at least one warning."
              />
              <div>
                <Switch
                  checked={!!formData.trigger_on_compliance_low}
                  onChange={(checked) => setFormData({ ...formData, trigger_on_compliance_low: checked })}
                  label="Low compliance score"
                  description="The call scored below your threshold."
                />
                {formData.trigger_on_compliance_low && (
                  <Field
                    label="Score threshold"
                    htmlFor="webhook-min-score"
                    help={`Calls scoring below this send an event. Leave empty to use ${DEFAULT_MIN_SCORE}.`}
                    className="mt-3 pl-12"
                  >
                    <input
                      id="webhook-min-score"
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
                checked={!!formData.trigger_on_custom_rule}
                onChange={(checked) => setFormData({ ...formData, trigger_on_custom_rule: checked })}
                label="Custom rule violations"
                description="The call matched one of your compliance rules."
              />
            </div>
          </FormSection>

          <FormSection title="Payload" description="What each event contains.">
            <div className="space-y-4">
              <Switch
                checked={!!formData.include_transcription}
                onChange={(checked) => setFormData({ ...formData, include_transcription: checked })}
                label="Include transcript"
                description="Adds the full call transcript."
              />
              <Switch
                checked={!!formData.include_analysis}
                onChange={(checked) => setFormData({ ...formData, include_analysis: checked })}
                label="Include analysis"
                description="Adds scores, sentiment, emotion and rule violations."
              />
              <Field
                label="Custom template"
                htmlFor="webhook-payload"
                error={payloadError}
                help={
                  <>
                    Optional JSON object sent instead of the default payload, so the options above no longer apply.
                    Supports <code className="code-chip">{'{{compliance_score}}'}</code> and{' '}
                    <code className="code-chip">{'{{alerts_count}}'}</code>.
                  </>
                }
              >
                <textarea
                  id="webhook-payload"
                  ref={payloadRef}
                  value={payloadText}
                  onChange={(e) => {
                    setPayloadText(e.target.value);
                    if (payloadError) setPayloadError(null);
                  }}
                  className="input font-mono text-[13px]"
                  rows={6}
                  placeholder={'{\n  "text": "Compliance score {{compliance_score}}"\n}'}
                  spellCheck={false}
                  aria-invalid={payloadError ? true : undefined}
                />
              </Field>
            </div>
          </FormSection>
        </form>
      </Modal>
    </div>
  );
}
