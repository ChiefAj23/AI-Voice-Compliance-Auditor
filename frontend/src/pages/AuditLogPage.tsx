import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText, Search, ShieldAlert } from 'lucide-react';
import { auditApi } from '../services/api';
import type { AuditLogRecord } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTime } from '../utils/format';
import { Badge, Card, EmptyState, Field, PageHeader, Spinner } from '../components/ui';
import { errorDetail } from '../utils/errors';

const PAGE = 50;

const ACTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'auth.login', label: 'Sign-ins' },
  { value: 'auth.change_password', label: 'Password changes' },
  { value: 'user.', label: 'User accounts' },
  { value: 'POST', label: 'Creates' },
  { value: 'PUT', label: 'Updates' },
  { value: 'DELETE', label: 'Deletes' },
];

/** What an action reads as: "POST /compliance_rules" -> "Create · compliance rules". */
function describe(action: string): string {
  const named: Record<string, string> = {
    'auth.login': 'Sign in',
    'auth.change_password': 'Password change',
    // Nouns, so each reads right beside either outcome ("Call analysis · Failed").
    'user.create': 'New user',
    'POST /analyze_audio': 'Call analysis',
    'POST /analyze_batch': 'Batch analysis',
  };
  if (named[action]) return named[action];
  const [method, path = ''] = action.split(' ');
  const verb: Record<string, string> = { POST: 'Create', PUT: 'Update', PATCH: 'Update', DELETE: 'Delete' };
  const resource = path.replace(/^\/api\//, '/').replace(/^\//, '').split('/')[0]?.replace(/[_-]/g, ' ');
  return `${verb[method] ?? method} · ${resource || path}`;
}

export default function AuditLogPage() {
  const { hasPermission } = useAuth();
  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [username, setUsername] = useState('');
  const [action, setAction] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const allowed = hasPermission('audit:read');

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError('');
    try {
      const data = await auditApi.list({ skip, limit: PAGE, username: username || undefined, action: action || undefined, status: status || undefined });
      setRecords(data.records);
      setTotal(data.total);
    } catch (err) {
      setError(errorDetail(err) || 'The audit log could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [allowed, skip, username, action, status]);

  useEffect(() => {
    load();
  }, [load]);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Audit log" description="Who did what, when, and from where." />
        <EmptyState icon={ShieldAlert} title="Administrators only" description="Reading the audit log needs the audit:read permission." />
      </>
    );
  }

  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + PAGE, total);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every sign-in and every change, with the account, the time and the client address. Request bodies are never stored."
        actions={
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden="true" />
            Refresh
          </button>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Field label="User" htmlFor="audit-user">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
              <input
                id="audit-user"
                className="input pl-9"
                placeholder="username"
                value={username}
                onChange={(e) => {
                  setSkip(0);
                  setUsername(e.target.value.trim());
                }}
              />
            </div>
          </Field>
          <Field label="Action" htmlFor="audit-action">
            <select id="audit-action" className="input" value={action} onChange={(e) => { setSkip(0); setAction(e.target.value); }}>
              {ACTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Outcome" htmlFor="audit-status">
            <select id="audit-status" className="input" value={status} onChange={(e) => { setSkip(0); setStatus(e.target.value); }}>
              <option value="">All</option>
              <option value="success">Succeeded</option>
              <option value="failure">Failed</option>
            </select>
          </Field>
        </div>
      </Card>

      {error && (
        <div className="callout callout-danger mb-4" role="alert">
          <ShieldAlert />
          <p>{error}</p>
        </div>
      )}

      <Card>
        {loading && records.length === 0 ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-fg-muted">
            <Spinner /> Loading the audit log…
          </div>
        ) : records.length === 0 ? (
          <EmptyState icon={ScrollText} title="Nothing recorded yet" description="Sign-ins and changes will appear here as they happen." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>What</th>
                  <th>Where</th>
                  <th>Outcome</th>
                  <th>From</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap tabular-nums text-fg-muted">{formatDateTime(row.timestamp, { naive: 'utc' })}</td>
                    <td className="font-medium text-fg">{row.username ?? <span className="text-fg-subtle">anonymous</span>}</td>
                    <td>
                      <span className="text-fg">{describe(row.action)}</span>
                      <span className="ml-2 font-mono text-xs text-fg-subtle">{row.action}</span>
                    </td>
                    <td className="text-fg-muted">
                      {row.resource_type ? `${row.resource_type.replace(/[_-]/g, ' ')}${row.resource_id ? ` #${row.resource_id}` : ''}` : '—'}
                    </td>
                    <td>
                      <Badge tone={row.status === 'success' ? 'success' : 'danger'} dot>
                        {row.status === 'success' ? 'Succeeded' : 'Failed'}
                      </Badge>
                    </td>
                    <td className="font-mono text-xs text-fg-muted">{row.ip_address ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-fg-muted">
          <span>
            {from}–{to} of {total}
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary btn-sm" disabled={skip === 0 || loading} onClick={() => setSkip(Math.max(0, skip - PAGE))}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Newer
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={to >= total || loading} onClick={() => setSkip(skip + PAGE)}>
              Older <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}
