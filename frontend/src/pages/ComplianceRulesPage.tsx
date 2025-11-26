import { useState, useEffect } from 'react';
import { apiService, ComplianceRule } from '../services/api';
import { Plus, Edit2, Trash2, Play, CheckCircle2, XCircle, AlertTriangle, Info, Filter, X } from 'lucide-react';

export default function ComplianceRulesPage() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [filter, setFilter] = useState<{ category?: string; isActive?: boolean }>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [testText, setTestText] = useState('');

  const [formData, setFormData] = useState<Partial<ComplianceRule>>({
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
      alert('Failed to load compliance rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRule?.id) {
        await apiService.updateComplianceRule(editingRule.id, formData);
      } else {
        await apiService.createComplianceRule(formData);
      }
      setShowForm(false);
      setEditingRule(null);
      resetForm();
      loadRules();
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save compliance rule');
    }
  };

  const handleEdit = (rule: ComplianceRule) => {
    setEditingRule(rule);
    setFormData(rule);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await apiService.deleteComplianceRule(id);
      loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      alert('Failed to delete compliance rule');
    }
  };

  const handleTest = async (rule: ComplianceRule) => {
    if (!testText.trim()) {
      alert('Please enter text to test');
      return;
    }
    try {
      const result = await apiService.testComplianceRule(rule.id!, testText);
      setTestResult({ rule: rule, result });
    } catch (error) {
      console.error('Failed to test rule:', error);
      alert('Failed to test compliance rule');
    }
  };

  const resetForm = () => {
    setFormData({
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
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const ruleTypes = [
    { value: 'keyword', label: 'Keyword List' },
    { value: 'regex', label: 'Regular Expression' },
    { value: 'sentiment', label: 'Sentiment' },
    { value: 'toxicity', label: 'Toxicity Score' },
    { value: 'emotion', label: 'Emotion' },
    { value: 'compliance_score', label: 'Compliance Score' },
    { value: 'custom', label: 'Custom Expression' },
  ];

  const conditions = [
    { value: 'contains', label: 'Contains' },
    { value: 'matches', label: 'Matches' },
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'less_than_or_equal', label: 'Less Than or Equal' },
  ];

  const categories = Array.from(new Set(rules.map((r) => r.category).filter(Boolean)));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Compliance Rules</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingRule(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Rule
        </button>
      </div>

      {/* Filters */}
      <div className="card flex items-center gap-4">
        <Filter className="h-5 w-5 text-gray-500" />
        <select
          value={filter.category || ''}
          onChange={(e) => setFilter({ ...filter, category: e.target.value || undefined })}
          className="input"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <select
          value={filter.isActive === undefined ? '' : filter.isActive.toString()}
          onChange={(e) =>
            setFilter({
              ...filter,
              isActive: e.target.value === '' ? undefined : e.target.value === 'true',
            })
          }
          className="input"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {(filter.category || filter.isActive !== undefined) && (
          <button
            onClick={() => setFilter({})}
            className="text-sm text-gray-600 hover:text-gray-800 flex items-center"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">
            {editingRule ? 'Edit Rule' : 'Create New Rule'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Rule Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Category</label>
                <input
                  type="text"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input"
                  placeholder="e.g., Language, Sentiment"
                />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Rule Type *</label>
                <select
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value as any })}
                  className="input"
                  required
                >
                  {ruleTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Condition *</label>
                <select
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  className="input"
                  required
                >
                  {conditions.map((cond) => (
                    <option key={cond.value} value={cond.value}>
                      {cond.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Severity *</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                  className="input"
                  required
                >
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>

            {(formData.rule_type === 'keyword' || formData.rule_type === 'regex') && (
              <div>
                <label className="label">
                  {formData.rule_type === 'regex' ? 'Regex Pattern' : 'Keywords (comma-separated)'} *
                </label>
                <textarea
                  value={formData.pattern || ''}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="input font-mono"
                  rows={3}
                  placeholder={
                    formData.rule_type === 'regex'
                      ? 'e.g., (?:credit|debit)\\s+card'
                      : 'e.g., profanity, inappropriate, banned word'
                  }
                  required
                />
              </div>
            )}

            {(formData.rule_type === 'sentiment' ||
              formData.rule_type === 'emotion' ||
              formData.rule_type === 'custom') && (
              <div>
                <label className="label">Pattern *</label>
                <input
                  type="text"
                  value={formData.pattern || ''}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  className="input"
                  required
                  placeholder={
                    formData.rule_type === 'sentiment'
                      ? 'e.g., NEGATIVE, POSITIVE'
                      : formData.rule_type === 'emotion'
                      ? 'e.g., anger, fear, disgust'
                      : 'e.g., toxicity_score > 0.7'
                  }
                />
              </div>
            )}

            {(formData.rule_type === 'toxicity' ||
              formData.rule_type === 'compliance_score') && (
              <div>
                <label className="label">Threshold *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.threshold || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, threshold: parseFloat(e.target.value) || undefined })
                  }
                  className="input"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Priority</label>
                <input
                  type="number"
                  value={formData.priority || 0}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  className="input"
                />
                <p className="text-xs text-gray-500 mt-1">Higher priority rules are evaluated first</p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="is_active" className="label mb-0">
                  Active
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRule(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingRule ? 'Update' : 'Create'} Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="text-center py-8">Loading rules...</div>
      ) : rules.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">No compliance rules found. Create your first rule!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`card ${!rule.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityIcon(rule.severity)}
                    <h3 className="text-lg font-semibold">{rule.name}</h3>
                    {!rule.is_active && (
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {rule.description}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>Type: {rule.rule_type}</span>
                    {rule.category && <span>Category: {rule.category}</span>}
                    <span>Severity: {rule.severity}</span>
                    <span>Priority: {rule.priority}</span>
                  </div>
                  {rule.pattern && (
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded font-mono text-xs">
                      {rule.pattern}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(rule)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id!)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Test Dialog */}
      {testResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Test Rule: {testResult.rule.name}</h2>
              <button
                onClick={() => {
                  setTestResult(null);
                  setTestText('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Test Text</label>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="input"
                  rows={4}
                  placeholder="Enter text to test the rule..."
                />
                <button
                  onClick={() => handleTest(testResult.rule)}
                  className="btn-primary mt-2 flex items-center"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run Test
                </button>
              </div>
              {testResult.result && (
                <div>
                  <h3 className="font-semibold mb-2">Test Result:</h3>
                  <div className={`p-4 rounded ${testResult.result.matched ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {testResult.result.matched ? (
                        <XCircle className="h-5 w-5 text-red-600" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      <span className="font-semibold">
                        Rule {testResult.result.matched ? 'Matched' : 'Did Not Match'}
                      </span>
                    </div>
                    {testResult.result.message && (
                      <p className="text-sm">{testResult.result.message}</p>
                    )}
                    {testResult.result.matches && testResult.result.matches.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-semibold">Matches:</p>
                        <ul className="list-disc list-inside text-sm">
                          {testResult.result.matches.map((match: any, idx: number) => (
                            <li key={idx} className="mt-1">
                              "{match.text}" at position {match.start}-{match.end}
                              {match.context && (
                                <div className="text-xs text-gray-600 dark:text-gray-400 ml-4">
                                  ...{match.context}...
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

