import { useState, useEffect } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, FlaskConical, Pencil, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiService } from '../services/api';
import type { ComplianceRule } from '../services/api';
import { formatNumber, humanize } from '../utils/format';
import { severityTone } from '../utils/status';
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
  StatCard,
  Switch,
  useConfirm,
  useToast,
} from '../components/ui';
import { errorDetail } from '../utils/errors';

type RuleType = ComplianceRule['rule_type'];
type StatusFilter = 'all' | 'active' | 'paused';

interface RuleTestMatch {
  text: string;
  start: number;
  end: number;
  context?: string;
}

/** Response of POST /compliance_rules/{id}/test (RuleResult.to_dict in api/compliance_rules.py). */
interface RuleTestResult {
  matched: boolean;
  message?: string | null;
  matches?: RuleTestMatch[];
}

const RULE_TYPES: { value: RuleType; label: string }[] = [
  { value: 'keyword', label: 'Keyword list' },
  { value: 'regex', label: 'Regular expression' },
  { value: 'sentiment', label: 'Sentiment' },
  { value: 'toxicity', label: 'Toxicity score' },
  { value: 'emotion', label: 'Emotion' },
  { value: 'compliance_score', label: 'Compliance score' },
  { value: 'custom', label: 'Custom expression' },
];

const CONDITIONS = [
  { value: 'contains', label: 'Contains' },
  { value: 'matches', label: 'Matches' },
  { value: 'equals', label: 'Equals' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'greater_than_or_equal', label: 'Greater than or equal' },
  { value: 'less_than', label: 'Less than' },
  { value: 'less_than_or_equal', label: 'Less than or equal' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
];

const THRESHOLD_TYPES: RuleType[] = ['toxicity', 'compliance_score'];
const SCORE_TYPES: RuleType[] = ['sentiment', 'toxicity', 'emotion', 'compliance_score'];

// Score rules only understand these comparisons. Any other condition falls back to the
// rule type's default operator and threshold, mirroring api/compliance_rules.py.
const COMPARISONS: Record<string, string> = {
  greater_than: '>',
  greater_than_or_equal: '>=',
  less_than: '<',
  less_than_or_equal: '<=',
};

const newRule = (): Partial<ComplianceRule> => ({
  name: '',
  description: '',
  rule_type: 'keyword',
  pattern: '',
  condition: 'contains',
  threshold: undefined,
  severity: 'warning',
  category: '',
  is_active: true,
  priority: 0,
  config: {},
});

function ruleTypeLabel(type: string): string {
  return RULE_TYPES.find((t) => t.value === type)?.label ?? humanize(type);
}

/** What a rule looks for: its pattern, or the comparison a score rule applies. */
function ruleCriterion(rule: ComplianceRule): string | null {
  if (THRESHOLD_TYPES.includes(rule.rule_type)) {
    const toxicity = rule.rule_type === 'toxicity';
    const operator = COMPARISONS[rule.condition] ?? (toxicity ? '>' : '<');
    return `${operator} ${rule.threshold ?? (toxicity ? 0.5 : 70)}`;
  }
  return rule.pattern?.trim() || null;
}

function testHelp(type: RuleType): string {
  if (SCORE_TYPES.includes(type)) {
    return 'Score rules are tested against a neutral baseline (toxicity 0, compliance 100), not against this text.';
  }
  if (type === 'custom') return 'Passed to your expression as text. Scores use a neutral baseline.';
  return 'Paste a line or two from a call transcript.';
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

/** Bolds the matched text inside the snippet the API returns around each match. */
function MatchContext({ context, text }: { context: string; text: string }) {
  const index = text ? context.indexOf(text) : -1;
  if (index === -1) return <>{context}</>;
  return (
    <>
      {context.slice(0, index)}
      <span className="font-semibold">{text}</span>
      {context.slice(index + text.length)}
    </>
  );
}

function TestOutcome({ severity, result }: { severity: ComplianceRule['severity']; result: RuleTestResult }) {
  const matches = result.matches ?? [];
  let className: string;
  let Icon: LucideIcon;
  let title: string;
  let summary: string;

  if (result.matched) {
    const critical = severity === 'critical';
    className = critical ? 'callout callout-danger' : 'callout callout-warning';
    Icon = critical ? AlertOctagon : AlertTriangle;
    title = 'Rule matched';
    summary = result.message || `This text would be flagged as ${severity}.`;
  } else if (result.message) {
    // A non-match only carries a message when the rule could not run (bad pattern, empty keyword list).
    className = 'callout callout-warning';
    Icon = AlertTriangle;
    title = 'Rule could not be evaluated';
    summary = result.message;
  } else {
    className = 'callout callout-success';
    Icon = CheckCircle2;
    title = 'No match';
    summary = 'This text passes the rule.';
  }

  return (
    <div className={className} role="status">
      <Icon aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 break-words">{summary}</p>
        {matches.length > 0 && (
          <ul className="mt-3 space-y-2.5">
            {matches.map((match, idx) => (
              <li key={idx}>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="code-chip">{match.text}</code>
                  <span className="text-xs tabular-nums opacity-80">
                    Position {match.start}–{match.end}
                  </span>
                </div>
                {match.context && (
                  <p className="mt-1 break-words text-xs opacity-80">
                    <MatchContext context={match.context} text={match.text} />
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiSkeleton({ hint = false }: { hint?: boolean }) {
  return <span className={hint ? 'skeleton inline-block h-3 w-24 align-middle' : 'skeleton inline-block h-7 w-10 align-middle'} />;
}

export default function ComplianceRulesPage() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [filter, setFilter] = useState<{ category?: string; isActive?: boolean }>({});
  const [testResult, setTestResult] = useState<{ rule: ComplianceRule; result?: RuleTestResult } | null>(null);
  const [testText, setTestText] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const [formData, setFormData] = useState<Partial<ComplianceRule>>(newRule);

  useEffect(() => {
    loadRules();
  }, [filter]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await apiService.getComplianceRules(
        filter.category,
        filter.isActive
      );
      setRules(response.rules);
    } catch (error) {
      console.error('Failed to load rules:', error);
      toast.error('Could not load compliance rules', errorDetail(error) ?? 'Check that the API is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingRule?.id) {
        await apiService.updateComplianceRule(editingRule.id, formData);
      } else {
        await apiService.createComplianceRule(formData);
      }
      toast.success(editingRule?.id ? 'Rule updated' : 'Rule created', formData.name);
      setShowForm(false);
      setEditingRule(null);
      resetForm();
      loadRules();
    } catch (error) {
      console.error('Failed to save rule:', error);
      toast.error('Could not save rule', errorDetail(error));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: ComplianceRule) => {
    setEditingRule(rule);
    setFormData(rule);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const rule = rules.find((r) => r.id === id);
    const confirmed = await confirm({
      title: 'Delete this rule?',
      description: rule
        ? `"${rule.name}" will be removed and will no longer run on new calls. This can't be undone.`
        : "This can't be undone.",
      confirmLabel: 'Delete rule',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteComplianceRule(id);
      toast.success('Rule deleted');
      loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      toast.error('Could not delete rule', errorDetail(error));
    }
  };

  const handleTest = async (rule: ComplianceRule) => {
    if (!testText.trim()) {
      toast.warning('Enter sample text to test', 'Paste a line from a call transcript, then run the test.');
      return;
    }
    setTesting(true);
    try {
      const result = await apiService.testComplianceRule(rule.id!, testText);
      // Ignore a late response if the dialog was closed or switched to another rule meanwhile.
      setTestResult((current) => (current?.rule.id === rule.id ? { rule: rule, result } : current));
    } catch (error) {
      console.error('Failed to test rule:', error);
      toast.error('Test failed', errorDetail(error));
    } finally {
      setTesting(false);
    }
  };

  const handleToggleActive = async (rule: ComplianceRule, isActive: boolean) => {
    if (rule.id == null) return;
    setTogglingId(rule.id);
    try {
      const updated = await apiService.updateComplianceRule(rule.id, { is_active: isActive });
      setRules((current) => current.map((r) => (r.id === rule.id ? { ...r, ...updated, is_active: isActive } : r)));
      toast.success(isActive ? 'Rule activated' : 'Rule paused', rule.name);
    } catch (error) {
      console.error('Failed to update rule:', error);
      toast.error('Could not update rule', errorDetail(error));
    } finally {
      setTogglingId(null);
    }
  };

  const resetForm = () => {
    setFormData(newRule());
  };

  const openCreate = () => {
    resetForm();
    setEditingRule(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRule(null);
    resetForm();
  };

  const openTest = (rule: ComplianceRule) => {
    setTestText('');
    setTestResult({ rule });
  };

  const closeTest = () => {
    setTestResult(null);
    setTestText('');
  };

  const hasFilters = filter.category !== undefined || filter.isActive !== undefined;
  const statusFilter: StatusFilter = filter.isActive === undefined ? 'all' : filter.isActive ? 'active' : 'paused';
  // Keep the selected category listed even when the current results don't include it.
  const categories = Array.from(
    new Set([...rules.map((r) => r.category), filter.category].filter((c): c is string => Boolean(c)))
  ).sort((a, b) => a.localeCompare(b));

  const activeCount = rules.filter((r) => r.is_active).length;
  const countBySeverity = (severity: ComplianceRule['severity']) => rules.filter((r) => r.severity === severity).length;
  const categoryHint =
    categories.length === 0 ? 'No categories' : `${categories.length} ${categories.length === 1 ? 'category' : 'categories'}`;

  const ruleType = formData.rule_type;
  const tested = testResult?.rule;
  const testedCriterion = tested ? ruleCriterion(tested) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance rules"
        description="Active rules run on every analyzed call. Matches appear in the results and can trigger notifications."
        actions={
          <button onClick={openCreate} className="btn btn-primary">
            <Plus />
            Create rule
          </button>
        }
      />

      {(loading || rules.length > 0 || hasFilters) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Rules"
            value={loading ? <KpiSkeleton /> : formatNumber(rules.length)}
            hint={loading ? <KpiSkeleton hint /> : hasFilters ? 'Matching current filters' : categoryHint}
          />
          <StatCard
            label="Active"
            value={loading ? <KpiSkeleton /> : formatNumber(activeCount)}
            hint={loading ? <KpiSkeleton hint /> : `${formatNumber(rules.length - activeCount)} paused`}
          />
          <StatCard
            label="Critical"
            value={loading ? <KpiSkeleton /> : formatNumber(countBySeverity('critical'))}
            hint={
              loading ? (
                <KpiSkeleton hint />
              ) : (
                `${formatNumber(countBySeverity('warning'))} warning · ${formatNumber(countBySeverity('info'))} info`
              )
            }
          />
        </div>
      )}

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <select
            value={filter.category || ''}
            onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
            aria-label="Filter by category"
            className="input sm:w-52"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <SegmentedControl
            label="Filter by status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(value) => {
              if (value === statusFilter) return;
              setFilter({ ...filter, isActive: value === 'all' ? undefined : value === 'active' });
            }}
            className="self-start sm:self-auto"
          />
          {hasFilters && (
            <button onClick={() => setFilter({})} className="btn btn-ghost self-start sm:ml-auto sm:self-auto">
              Clear filters
            </button>
          )}
        </div>

        {!loading && rules.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No matching rules"
              description="Try another category or status."
              action={
                <button onClick={() => setFilter({})} className="btn btn-secondary">
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="No compliance rules yet"
              description="Create a rule to flag phrases, patterns or scores in every analyzed call."
              action={
                <button onClick={openCreate} className="btn btn-secondary">
                  <Plus />
                  Create rule
                </button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table data-table-hover">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Detection</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th className="text-right">Priority</th>
                  <th>Active</th>
                  <th className="text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }, (_, i) => (
                      <tr key={i}>
                        <td>
                          <div className="skeleton h-4 w-40" />
                          <div className="skeleton mt-2 h-3 w-56" />
                        </td>
                        <td>
                          <div className="skeleton h-4 w-28" />
                          <div className="skeleton mt-2 h-4 w-36" />
                        </td>
                        <td><div className="skeleton h-5 w-16" /></td>
                        <td><div className="skeleton h-4 w-20" /></td>
                        <td><div className="skeleton ml-auto h-4 w-6" /></td>
                        <td><div className="skeleton h-5 w-9 rounded-full" /></td>
                        <td />
                      </tr>
                    ))
                  : rules.map((rule) => {
                      const criterion = ruleCriterion(rule);
                      return (
                        <tr key={rule.id}>
                          <td>
                            <div className="max-w-xs">
                              <p className="truncate font-medium text-fg">{rule.name}</p>
                              {rule.description && (
                                <p className="mt-0.5 truncate text-xs text-fg-subtle" title={rule.description}>
                                  {rule.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td>
                            <p className="whitespace-nowrap text-fg-muted">{ruleTypeLabel(rule.rule_type)}</p>
                            {criterion && (
                              <code className="code-chip mt-1 inline-block max-w-[14rem] truncate align-top" title={criterion}>
                                {criterion}
                              </code>
                            )}
                          </td>
                          <td>
                            <Badge tone={severityTone(rule.severity)}>{humanize(rule.severity)}</Badge>
                          </td>
                          <td className="whitespace-nowrap text-fg-muted">
                            {rule.category || <span className="text-fg-faint">—</span>}
                          </td>
                          <td className="text-right tabular-nums text-fg-muted">{rule.priority}</td>
                          <td>
                            <label className="inline-flex" title={rule.is_active ? 'Pause rule' : 'Activate rule'}>
                              <span className="sr-only">Active: {rule.name}</span>
                              <Switch
                                checked={rule.is_active}
                                onChange={(checked) => handleToggleActive(rule, checked)}
                                disabled={togglingId === rule.id}
                              />
                            </label>
                          </td>
                          <td>
                            <div className="flex items-center justify-end gap-0.5">
                              <IconButton icon={FlaskConical} label="Test rule" onClick={() => openTest(rule)} />
                              <IconButton icon={Pencil} label="Edit rule" onClick={() => handleEdit(rule)} />
                              <IconButton icon={Trash2} label="Delete rule" tone="danger" onClick={() => handleDelete(rule.id!)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / edit */}
      <Modal
        open={showForm}
        onClose={closeForm}
        size="lg"
        title={editingRule ? 'Edit rule' : 'Create rule'}
        description={editingRule ? 'Changes apply to calls analyzed from now on.' : 'Active rules run on every new analysis.'}
        footer={
          <>
            <button type="button" onClick={closeForm} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" form="rule-form" className="btn btn-primary" disabled={saving}>
              {saving && <Spinner />}
              {editingRule ? 'Save changes' : 'Create rule'}
            </button>
          </>
        }
      >
        <form id="rule-form" onSubmit={handleSubmit} className="space-y-6">
          <FormSection title="Basics" description="Name the rule and group it with related checks.">
            <Field label="Name" htmlFor="rule-name" required>
              <input
                id="rule-name"
                type="text"
                value={formData.name ?? ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Category" htmlFor="rule-category" help="Used to filter and group rules.">
              <input
                id="rule-category"
                type="text"
                list="rule-category-options"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input"
                placeholder="e.g. Language"
              />
              <datalist id="rule-category-options">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </Field>
            <Field label="Description" htmlFor="rule-description" className="sm:col-span-2">
              <textarea
                id="rule-description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
                placeholder="What this rule catches and why it matters"
              />
            </Field>
          </FormSection>

          <FormSection
            title="Detection"
            description="What the rule looks for in each call."
            className="border-t border-line pt-6"
          >
            <Field label="Rule type" htmlFor="rule-type" required>
              <select
                id="rule-type"
                value={formData.rule_type}
                onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as RuleType })}
                className="input"
                required
              >
                {RULE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Condition" htmlFor="rule-condition" required>
              <select
                id="rule-condition"
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="input"
                required
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond.value} value={cond.value}>
                    {cond.label}
                  </option>
                ))}
              </select>
            </Field>

            {(ruleType === 'keyword' || ruleType === 'regex') && (
              <Field
                label={ruleType === 'regex' ? 'Regex pattern' : 'Keywords'}
                htmlFor="rule-pattern"
                required
                help={
                  ruleType === 'regex'
                    ? 'Python regular expression. Case-sensitive; start with (?i) to ignore case.'
                    : 'Separate keywords with commas. Matching ignores case.'
                }
                className="sm:col-span-2"
              >
                <textarea
                  id="rule-pattern"
                  value={formData.pattern || ''}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="input font-mono text-[13px]"
                  rows={3}
                  placeholder={
                    ruleType === 'regex'
                      ? 'e.g. (?:credit|debit)\\s+card'
                      : 'e.g. profanity, inappropriate, banned word'
                  }
                  required
                />
              </Field>
            )}

            {(ruleType === 'sentiment' || ruleType === 'emotion' || ruleType === 'custom') && (
              <Field
                label={ruleType === 'sentiment' ? 'Sentiment' : ruleType === 'emotion' ? 'Emotions' : 'Expression'}
                htmlFor="rule-pattern"
                required
                help={
                  ruleType === 'sentiment'
                    ? "Compared with the call's overall sentiment label."
                    : ruleType === 'emotion'
                    ? 'Separate emotions with commas.'
                    : 'Python expression. Use text, sentiment, emotion, toxicity_score and compliance_score.'
                }
                className="sm:col-span-2"
              >
                <input
                  id="rule-pattern"
                  type="text"
                  value={formData.pattern || ''}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className={ruleType === 'custom' ? 'input font-mono text-[13px]' : 'input'}
                  required
                  placeholder={
                    ruleType === 'sentiment'
                      ? 'e.g. NEGATIVE'
                      : ruleType === 'emotion'
                      ? 'e.g. anger, fear, disgust'
                      : 'e.g. toxicity_score > 0.7'
                  }
                />
              </Field>
            )}

            {(ruleType === 'toxicity' || ruleType === 'compliance_score') && (
              <Field
                label="Threshold"
                htmlFor="rule-threshold"
                required
                help={ruleType === 'toxicity' ? 'Toxicity is scored from 0 to 1.' : 'Compliance is scored from 0 to 100.'}
              >
                <input
                  id="rule-threshold"
                  type="number"
                  step="0.01"
                  value={formData.threshold ?? ''}
                  onChange={(e) => {
                    // Keep 0 as a valid threshold; only an empty field clears it.
                    const threshold = parseFloat(e.target.value);
                    setFormData({ ...formData, threshold: Number.isNaN(threshold) ? undefined : threshold });
                  }}
                  className="input"
                  required
                />
              </Field>
            )}
          </FormSection>

          <FormSection
            title="Handling"
            description="How matches are flagged and the order rules run in."
            className="border-t border-line pt-6"
          >
            <Field label="Severity" htmlFor="rule-severity" required>
              <select
                id="rule-severity"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as ComplianceRule['severity'] })}
                className="input"
                required
              >
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </Field>
            <Field label="Priority" htmlFor="rule-priority" help="Higher priority rules are evaluated first.">
              <input
                id="rule-priority"
                type="number"
                value={formData.priority || 0}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="input tabular-nums"
              />
            </Field>
            <div className="sm:col-span-2">
              <Switch
                checked={formData.is_active ?? false}
                onChange={(checked) => setFormData({ ...formData, is_active: checked })}
                label="Active"
                description="Run this rule on every new analysis."
              />
            </div>
          </FormSection>
        </form>
      </Modal>

      {/* Test */}
      <Modal
        open={testResult !== null}
        onClose={closeTest}
        size="lg"
        title="Test rule"
        description={tested ? `Check how "${tested.name}" handles sample text.` : undefined}
        footer={
          <>
            <button type="button" onClick={closeTest} className="btn btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={() => tested && handleTest(tested)}
              className="btn btn-primary"
              disabled={testing}
            >
              {testing ? <Spinner /> : <FlaskConical />}
              Run test
            </button>
          </>
        }
      >
        {tested && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
              <span>{ruleTypeLabel(tested.rule_type)}</span>
              {testedCriterion && (
                <code className="code-chip max-w-full truncate" title={testedCriterion}>
                  {testedCriterion}
                </code>
              )}
              <Badge tone={severityTone(tested.severity)}>{humanize(tested.severity)}</Badge>
            </div>
            <Field label="Sample text" htmlFor="rule-test-text" help={testHelp(tested.rule_type)}>
              <textarea
                id="rule-test-text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                className="input"
                rows={5}
                placeholder="Type or paste text from a call"
              />
            </Field>
            {testResult?.result && <TestOutcome severity={tested.severity} result={testResult.result} />}
          </div>
        )}
      </Modal>
    </div>
  );
}
