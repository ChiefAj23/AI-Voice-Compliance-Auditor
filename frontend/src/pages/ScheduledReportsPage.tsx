import { useState, useEffect } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CalendarClock, Mail, Pencil, Play, Plus, Search, Trash2, X } from 'lucide-react';
import { apiService } from '../services/api';
import type { ScheduledReport } from '../services/api';
import { formatDateTime, formatNumber, humanize } from '../utils/format';
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

type ScheduleType = ScheduledReport['schedule_type'];
type ScheduleConfig = ScheduledReport['schedule_config'];
type StatusFilter = 'all' | 'active' | 'paused';

// Index = day_of_week value. The backend (APScheduler) counts weekdays from Monday = 0.
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

const newReport = (): Partial<ScheduledReport> => ({
  name: '',
  description: '',
  schedule_type: 'daily',
  schedule_config: { hour: 9, minute: 0 },
  timezone: 'UTC',
  report_type: 'summary',
  filters: {},
  email_recipients: [],
  email_subject: '',
  email_body_template: '',
  is_active: true,
});

/** parseInt that keeps 0 (midnight, minute 0) instead of treating it as empty. */
function toInt(value: string, fallback: number): number {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const pad = (value: number) => String(value).padStart(2, '0');

function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "Weekly on Monday at 08:00". Defaults mirror _create_trigger in api/report_scheduler.py. */
function describeSchedule(type: ScheduleType | undefined, config: ScheduleConfig | undefined): string {
  const c = config ?? {};
  const time = `${pad(c.hour ?? 9)}:${pad(c.minute ?? 0)}`;
  switch (type) {
    case 'daily':
      return `Daily at ${time}`;
    case 'weekly':
      return `Weekly on ${WEEKDAYS[c.day_of_week ?? 0] ?? WEEKDAYS[0]} at ${time}`;
    case 'monthly':
      return `Monthly on the ${ordinal(c.day ?? 1)} at ${time}`;
    case 'custom':
      return 'Custom schedule';
    default:
      return humanize(type);
  }
}

function ScheduleSummary({ report }: { report: ScheduledReport }) {
  const timezone = <span className="text-fg-subtle">· {report.timezone || 'UTC'}</span>;
  if (report.schedule_type === 'custom') {
    const cron = report.schedule_config?.cron_expression;
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
        Cron
        {cron ? <code className="code-chip">{cron}</code> : <span className="text-fg-faint">not set</span>}
        {timezone}
      </span>
    );
  }
  return (
    <span className="min-w-0">
      {describeSchedule(report.schedule_type, report.schedule_config)} {timezone}
    </span>
  );
}

function RecipientSummary({ recipients }: { recipients?: string[] }) {
  const list = recipients ?? [];
  if (list.length === 0) return <span className="text-fg-faint">No recipients</span>;
  const extra = list.length - 2;
  return (
    <span className="truncate" title={list.join(', ')}>
      {list.slice(0, 2).join(', ')}
      {extra > 0 && <span className="text-fg-subtle"> +{extra}</span>}
    </span>
  );
}

function FormSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <h3 className="section-title">{title}</h3>
      <p className="help-text">{description}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [filter, setFilter] = useState<{ isActive?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const [formData, setFormData] = useState<Partial<ScheduledReport>>(newReport);

  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    loadReports();
  }, [filter]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await apiService.getScheduledReports(filter.isActive);
      setReports(response.reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Could not load scheduled reports', errorDetail(error) ?? 'Check that the API is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingReport?.id) {
        await apiService.updateScheduledReport(editingReport.id, formData);
      } else {
        await apiService.createScheduledReport(formData);
      }
      toast.success(editingReport?.id ? 'Changes saved' : 'Report scheduled', formData.name);
      setShowForm(false);
      setEditingReport(null);
      resetForm();
      loadReports();
    } catch (error) {
      console.error('Failed to save report:', error);
      toast.error('Could not save scheduled report', errorDetail(error));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report);
    setFormData(report);
    // Existing recipients are shown as chips; the input is only for adding new ones.
    setEmailInput('');
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const report = reports.find((r) => r.id === id);
    const confirmed = await confirm({
      title: 'Delete this scheduled report?',
      description: report
        ? `"${report.name}" will stop sending and be permanently removed.`
        : 'It will stop sending and be permanently removed.',
      confirmLabel: 'Delete report',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteScheduledReport(id);
      toast.success('Scheduled report deleted');
      loadReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Could not delete scheduled report', errorDetail(error));
    }
  };

  const handleRunNow = async (id: number) => {
    const report = reports.find((r) => r.id === id);
    const recipientCount = report?.email_recipients?.length ?? 0;
    const confirmed = await confirm({
      title: 'Run this report now?',
      description: report
        ? `"${report.name}" will be generated and emailed to ${recipientCount} ${
            recipientCount === 1 ? 'recipient' : 'recipients'
          }. Its regular schedule isn't affected.`
        : "Its regular schedule isn't affected.",
      confirmLabel: 'Run now',
      tone: 'default',
    });
    if (!confirmed) return;

    setRunningId(id);
    try {
      await apiService.runScheduledReportNow(id);
      toast.success('Report run triggered', 'Recipients should receive it shortly.');
      loadReports();
    } catch (error) {
      console.error('Failed to run report:', error);
      toast.error('Could not run report', errorDetail(error));
    } finally {
      setRunningId(null);
    }
  };

  const handleToggleActive = async (report: ScheduledReport, isActive: boolean) => {
    if (report.id == null) return;
    setTogglingId(report.id);
    try {
      const updated = await apiService.updateScheduledReport(report.id, { is_active: isActive });
      // The response carries the recalculated next run.
      setReports((current) =>
        current.map((r) => (r.id === report.id ? { ...r, ...updated, is_active: isActive } : r))
      );
      toast.success(isActive ? 'Schedule activated' : 'Schedule paused', report.name);
    } catch (error) {
      console.error('Failed to update report:', error);
      toast.error('Could not update scheduled report', errorDetail(error));
    } finally {
      setTogglingId(null);
    }
  };

  const resetForm = () => {
    setFormData(newReport());
    setEmailInput('');
  };

  const openCreate = () => {
    resetForm();
    setEditingReport(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingReport(null);
    resetForm();
  };

  const addEmail = () => {
    const emails = emailInput.split(',').map(e => e.trim()).filter(e => e);
    const merged = Array.from(new Set([...(formData.email_recipients || []), ...emails]));
    setFormData({ ...formData, email_recipients: merged });
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    setFormData({
      ...formData,
      email_recipients: (formData.email_recipients || []).filter(e => e !== email),
    });
  };

  // next_run is stored as wall-clock time in the report's own timezone (shown alongside it),
  // unlike last_run, which is UTC.
  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return 'Not scheduled';
    return formatDateTime(nextRun, { naive: 'local' });
  };

  const formatLastRun = (lastRun?: string) => {
    if (!lastRun) return 'Never';
    return formatDateTime(lastRun);
  };

  const setScheduleConfig = (patch: ScheduleConfig) =>
    setFormData({ ...formData, schedule_config: { ...formData.schedule_config, ...patch } });

  const statusFilter: StatusFilter = filter.isActive === undefined ? 'all' : filter.isActive ? 'active' : 'paused';
  const formSchedule = formData.schedule_type;
  const formConfig = formData.schedule_config;
  const recipients = formData.email_recipients ?? [];

  const hourField = (
    <Field label="Hour (0–23)" htmlFor="report-hour">
      <input
        id="report-hour"
        type="number"
        min="0"
        max="23"
        value={formConfig?.hour ?? 9}
        onChange={(e) => setScheduleConfig({ hour: toInt(e.target.value, 9) })}
        className="input tabular-nums"
      />
    </Field>
  );

  const minuteField = (
    <Field label="Minute (0–59)" htmlFor="report-minute">
      <input
        id="report-minute"
        type="number"
        min="0"
        max="59"
        value={formConfig?.minute ?? 0}
        onChange={(e) => setScheduleConfig({ minute: toInt(e.target.value, 0) })}
        className="input tabular-nums"
      />
    </Field>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled reports"
        description="Compliance reports emailed to your team on a recurring schedule."
        actions={
          <button onClick={openCreate} className="btn btn-primary">
            <Plus />
            Schedule report
          </button>
        }
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            label="Filter by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => {
              if (value === statusFilter) return;
              setFilter({ isActive: value === 'all' ? undefined : value === 'active' });
            }}
            className="self-start sm:self-auto"
          />
          <p className="text-[13px] tabular-nums text-fg-subtle">
            {loading ? 'Loading…' : `${formatNumber(reports.length)} ${reports.length === 1 ? 'report' : 'reports'}`}
          </p>
        </div>

        {!loading && reports.length === 0 ? (
          filter.isActive !== undefined ? (
            <EmptyState
              icon={Search}
              title={filter.isActive ? 'No active reports' : 'No paused reports'}
              description="Switch the filter to see your other reports."
              action={
                <button onClick={() => setFilter({})} className="btn btn-secondary">
                  Show all reports
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={CalendarClock}
              title="No scheduled reports"
              description="Schedule a report to email compliance results to your team automatically."
              action={
                <button onClick={openCreate} className="btn btn-secondary">
                  <Plus />
                  Schedule report
                </button>
              }
            />
          )
        ) : (
          <ul className="divide-y divide-line">
            {loading
              ? Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="skeleton h-4 w-48" />
                      <div className="skeleton mt-2 h-3 w-64" />
                      <div className="skeleton mt-3 h-3 w-80 max-w-full" />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-4 lg:w-96 lg:gap-x-6">
                      {[0, 1, 2].map((j) => (
                        <div key={j}>
                          <div className="skeleton h-3 w-12" />
                          <div className="skeleton mt-1.5 h-4 w-20" />
                        </div>
                      ))}
                    </div>
                    <div className="skeleton h-8 w-40" />
                  </li>
                ))
              : reports.map((report) => (
                  <li key={report.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-fg">{report.name}</p>
                        <Badge>{humanize(report.report_type)}</Badge>
                      </div>
                      {report.description && (
                        <p className="mt-0.5 truncate text-[13px] text-fg-subtle" title={report.description}>
                          {report.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-fg-muted">
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                          <span className="sr-only">Schedule:</span>
                          <ScheduleSummary report={report} />
                        </span>
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                          <span className="sr-only">Recipients:</span>
                          <RecipientSummary recipients={report.email_recipients} />
                        </span>
                      </div>
                    </div>

                    <dl className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-4 text-[13px] lg:w-96 lg:gap-x-6">
                      <div>
                        <dt className="text-xs text-fg-subtle">Last run</dt>
                        <dd className="mt-0.5 tabular-nums text-fg lg:whitespace-nowrap">{formatLastRun(report.last_run)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-fg-subtle">Next run</dt>
                        <dd className="mt-0.5 tabular-nums text-fg lg:whitespace-nowrap">
                          {report.is_active ? formatNextRun(report.next_run) : <span className="text-fg-faint">Paused</span>}
                        </dd>
                      </div>
                      <div className="text-right">
                        <dt className="text-xs text-fg-subtle">Runs</dt>
                        <dd className="mt-0.5 tabular-nums text-fg">{formatNumber(report.run_count || 0)}</dd>
                      </div>
                    </dl>

                    <div className="flex shrink-0 items-center justify-between gap-3 lg:justify-end">
                      <label className="inline-flex" title={report.is_active ? 'Pause schedule' : 'Activate schedule'}>
                        <span className="sr-only">Active: {report.name}</span>
                        <Switch
                          checked={report.is_active}
                          onChange={(checked) => handleToggleActive(report, checked)}
                          disabled={togglingId === report.id}
                        />
                      </label>
                      <div className="flex items-center gap-0.5">
                        <IconButton
                          icon={Play}
                          label="Run now"
                          onClick={() => handleRunNow(report.id!)}
                          disabled={runningId === report.id}
                        />
                        <IconButton icon={Pencil} label="Edit report" onClick={() => handleEdit(report)} />
                        <IconButton icon={Trash2} label="Delete report" tone="danger" onClick={() => handleDelete(report.id!)} />
                      </div>
                    </div>
                  </li>
                ))}
          </ul>
        )}
      </Card>

      {/* Create / edit */}
      <Modal
        open={showForm}
        onClose={closeForm}
        size="lg"
        title={editingReport ? 'Edit scheduled report' : 'Schedule report'}
        description={
          editingReport
            ? 'Changes apply from the next scheduled run.'
            : 'Email a compliance report to your team on a recurring schedule.'
        }
        footer={
          <>
            <button type="button" onClick={closeForm} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="report-form" className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />}
              {editingReport ? 'Save changes' : 'Schedule report'}
            </button>
          </>
        }
      >
        <form id="report-form" onSubmit={handleSubmit} className="space-y-6">
          <FormSection title="Details" description="Name the report and choose how much it includes.">
            <Field label="Name" htmlFor="report-name" required>
              <input
                id="report-name"
                type="text"
                value={formData.name ?? ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Report type" htmlFor="report-type" required>
              <select
                id="report-type"
                value={formData.report_type}
                onChange={(e) => setFormData({ ...formData, report_type: e.target.value as ScheduledReport['report_type'] })}
                className="input"
                required
              >
                <option value="summary">Summary</option>
                <option value="detailed">Detailed</option>
              </select>
            </Field>
            <Field label="Description" htmlFor="report-description" className="sm:col-span-2">
              <textarea
                id="report-description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
                placeholder="Who this report is for and what it tracks"
              />
            </Field>
          </FormSection>

          <FormSection
            title="Schedule"
            description="When the report is generated and sent."
            className="border-t border-line pt-6"
          >
            <Field label="Frequency" htmlFor="report-frequency" required>
              <select
                id="report-frequency"
                value={formData.schedule_type}
                onChange={(e) => {
                  const scheduleType = e.target.value as ScheduleType;
                  let config: ScheduleConfig = { hour: 9, minute: 0 };
                  if (scheduleType === 'weekly') {
                    config = { ...config, day_of_week: 0 };
                  } else if (scheduleType === 'monthly') {
                    config = { ...config, day: 1 };
                  }
                  setFormData({
                    ...formData,
                    schedule_type: scheduleType,
                    schedule_config: config,
                  });
                }}
                className="input"
                required
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom (cron)</option>
              </select>
            </Field>
            <Field label="Timezone" htmlFor="report-timezone" help="IANA name, e.g. America/New_York.">
              <input
                id="report-timezone"
                type="text"
                value={formData.timezone ?? ''}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="input"
                placeholder="UTC"
              />
            </Field>

            {formSchedule === 'daily' && (
              <>
                {hourField}
                {minuteField}
              </>
            )}

            {formSchedule === 'weekly' && (
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                <Field label="Day of week" htmlFor="report-weekday">
                  <select
                    id="report-weekday"
                    value={formConfig?.day_of_week || 0}
                    onChange={(e) => setScheduleConfig({ day_of_week: parseInt(e.target.value) })}
                    className="input"
                  >
                    {WEEKDAYS.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </Field>
                {hourField}
                {minuteField}
              </div>
            )}

            {formSchedule === 'monthly' && (
              <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
                <Field
                  label="Day of month"
                  htmlFor="report-day"
                  help={(formConfig?.day ?? 1) > 28 ? 'Months without this day are skipped.' : undefined}
                >
                  <input
                    id="report-day"
                    type="number"
                    min="1"
                    max="31"
                    value={formConfig?.day || 1}
                    onChange={(e) => setScheduleConfig({ day: parseInt(e.target.value) || 1 })}
                    className="input tabular-nums"
                  />
                </Field>
                {hourField}
                {minuteField}
              </div>
            )}

            {formSchedule === 'custom' && (
              <Field
                label="Cron expression"
                htmlFor="report-cron"
                help='Minute, hour, day, month, weekday. Weekday 0 is Monday, so names are clearer: "0 9 * * mon-fri" runs at 09:00 on weekdays.'
                className="sm:col-span-2"
              >
                <input
                  id="report-cron"
                  type="text"
                  value={formConfig?.cron_expression || ''}
                  onChange={(e) => setScheduleConfig({ cron_expression: e.target.value })}
                  className="input font-mono text-[13px]"
                  placeholder="0 9 * * mon-fri"
                />
              </Field>
            )}

            {formSchedule !== 'custom' && (
              <p className="flex items-center gap-2 text-[13px] text-fg-muted sm:col-span-2">
                <CalendarClock className="h-4 w-4 shrink-0 text-fg-faint" aria-hidden="true" />
                <span>
                  {describeSchedule(formSchedule, formConfig)}{' '}
                  <span className="text-fg-subtle">· {formData.timezone || 'UTC'}</span>
                </span>
              </p>
            )}
          </FormSection>

          <FormSection
            title="Recipients and content"
            description="Recipients get the report as a PDF attachment."
            className="border-t border-line pt-6"
          >
            <Field
              label="Recipients"
              htmlFor="report-recipients"
              required
              help="Press Enter or select Add. Separate several addresses with commas."
              className="sm:col-span-2"
            >
              <div className="flex gap-2">
                <input
                  id="report-recipients"
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="input flex-1"
                  placeholder="name@company.com"
                  onKeyDown={(e) => {
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
              {recipients.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Recipients">
                  {recipients.map((email, idx) => (
                    <li
                      key={`${idx}-${email}`}
                      className="inline-flex max-w-full items-center gap-1 rounded-md bg-surface-subtle py-0.5 pl-2 pr-0.5 text-[13px] text-fg ring-1 ring-inset ring-line"
                    >
                      <span className="truncate">{email}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        aria-label={`Remove ${email}`}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded text-fg-faint transition-colors hover:bg-surface-muted hover:text-fg"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
            <Field
              label="Email subject"
              htmlFor="report-subject"
              help="Leave blank to use the default subject."
              className="sm:col-span-2"
            >
              <input
                id="report-subject"
                type="text"
                value={formData.email_subject || ''}
                onChange={(e) => setFormData({ ...formData, email_subject: e.target.value })}
                className="input"
                placeholder={`Automated Compliance Report: ${formData.name?.trim() || 'report name'}`}
              />
            </Field>
            <div className="sm:col-span-2">
              <Switch
                checked={formData.is_active ?? false}
                onChange={(checked) => setFormData({ ...formData, is_active: checked })}
                label="Active"
                description="Send this report on its schedule. Paused reports can still be run manually."
              />
            </div>
          </FormSection>
        </form>
      </Modal>
    </div>
  );
}
