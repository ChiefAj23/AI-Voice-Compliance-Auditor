import { useState, useEffect } from 'react';
import { apiService, NotificationConfig } from '../services/api';
import { Plus, Edit2, Trash2, Play, Filter, X, CheckCircle2, Bell, Mail } from 'lucide-react';

export default function NotificationsPage() {
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<NotificationConfig | null>(null);
  const [filter, setFilter] = useState<{ isActive?: boolean }>({});
  const [testResult, setTestResult] = useState<any>(null);

  const [formData, setFormData] = useState<Partial<NotificationConfig>>({
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

  const [emailInput, setEmailInput] = useState('');

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
      alert('Failed to load notification configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingConfig?.id) {
        await apiService.updateNotificationConfig(editingConfig.id, formData);
      } else {
        await apiService.createNotificationConfig(formData);
      }
      setShowForm(false);
      setEditingConfig(null);
      resetForm();
      loadConfigs();
    } catch (error) {
      console.error('Failed to save notification config:', error);
      alert('Failed to save notification configuration');
    }
  };

  const handleEdit = (config: NotificationConfig) => {
    setEditingConfig(config);
    setFormData(config);
    setEmailInput(config.email_recipients?.join(', ') || '');
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this notification configuration?')) return;
    try {
      await apiService.deleteNotificationConfig(id);
      loadConfigs();
    } catch (error) {
      console.error('Failed to delete notification config:', error);
      alert('Failed to delete notification configuration');
    }
  };

  const handleTest = async (config: NotificationConfig) => {
    try {
      const result = await apiService.testNotificationConfig(config.id!);
      setTestResult({ config: config, result });
    } catch (error) {
      console.error('Failed to test notification:', error);
      alert('Failed to test notification');
    }
  };

  const resetForm = () => {
    setFormData({
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Email Notifications</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingConfig(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Configuration
        </button>
      </div>

      {/* Filters */}
      <div className="card flex items-center gap-4">
        <Filter className="h-5 w-5 text-gray-500" />
        <select
          value={filter.isActive === undefined ? '' : filter.isActive.toString()}
          onChange={(e) =>
            setFilter({
              isActive: e.target.value === '' ? undefined : e.target.value === 'true',
            })
          }
          className="input"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {filter.isActive !== undefined && (
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
            {editingConfig ? 'Edit Notification Configuration' : 'Create New Notification Configuration'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Configuration Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Rate Limit (minutes) *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.rate_limit_minutes || 60}
                  onChange={(e) => setFormData({ ...formData, rate_limit_minutes: parseInt(e.target.value) || 60 })}
                  className="input"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Max 1 email per N minutes</p>
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

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Email Recipients *</h3>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="input flex-1"
                  placeholder="email@example.com (comma-separated for multiple)"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmail();
                    }
                  }}
                />
                <button type="button" onClick={addEmail} className="btn-secondary">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.email_recipients?.map((email, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded text-sm flex items-center gap-2"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeEmail(email)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Notification Triggers</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notify_on_critical}
                    onChange={(e) => setFormData({ ...formData, notify_on_critical: e.target.checked })}
                    className="mr-2"
                  />
                  Notify on Critical Alerts
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notify_on_warning}
                    onChange={(e) => setFormData({ ...formData, notify_on_warning: e.target.checked })}
                    className="mr-2"
                  />
                  Notify on Warning Alerts
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notify_on_compliance_low}
                    onChange={(e) => setFormData({ ...formData, notify_on_compliance_low: e.target.checked })}
                    className="mr-2"
                  />
                  Notify on Low Compliance Score
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notify_on_custom_rule}
                    onChange={(e) => setFormData({ ...formData, notify_on_custom_rule: e.target.checked })}
                    className="mr-2"
                  />
                  Notify on Custom Rule Violations
                </label>
              </div>
              {formData.notify_on_compliance_low && (
                <div className="mt-4">
                  <label className="label">Min Compliance Score Threshold</label>
                  <input
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
                    className="input"
                    placeholder="70 (default)"
                  />
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Email Template</h3>
              <div>
                <label className="label">Email Subject Template</label>
                <input
                  type="text"
                  value={formData.email_subject_template || ''}
                  onChange={(e) => setFormData({ ...formData, email_subject_template: e.target.value })}
                  className="input"
                  placeholder="Compliance Alert - Voice Audit"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Placeholders: {'{{compliance_score}}'}, {'{{timestamp}}'}
                </p>
              </div>
              <div className="mt-4">
                <label className="label">Email Body Template (HTML)</label>
                <textarea
                  value={formData.email_body_template || ''}
                  onChange={(e) => setFormData({ ...formData, email_body_template: e.target.value })}
                  className="input font-mono"
                  rows={8}
                  placeholder="Leave empty for default template"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Placeholders: {'{{compliance_score}}'}, {'{{toxicity_score}}'}, {'{{alerts_count}}'}, {'{{timestamp}}'}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <label htmlFor="is_active" className="label mb-0">Active</label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingConfig(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingConfig ? 'Update' : 'Create'} Configuration
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Configs List */}
      {loading ? (
        <div className="text-center py-8">Loading configurations...</div>
      ) : configs.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">No notification configurations found. Create your first configuration!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.id} className={`card ${!config.is_active ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="h-5 w-5 text-orange-600" />
                    <h3 className="text-lg font-semibold">{config.name}</h3>
                    {config.is_active ? (
                      <span className="text-xs bg-green-200 dark:bg-green-800 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Inactive</span>
                    )}
                  </div>
                  {config.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{config.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <Mail className="h-4 w-4 inline mr-1" />
                      <span className="text-gray-600 dark:text-gray-400">
                        {config.email_recipients?.length || 0} Recipient(s)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Rate Limit:</span>{' '}
                      <span className="font-semibold">{config.rate_limit_minutes} min</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Sent:</span>{' '}
                      <span className="font-semibold">{config.sent_count || 0} times</span>
                    </div>
                    {config.last_sent && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Last Sent:</span>{' '}
                        <span className="font-semibold">{new Date(config.last_sent).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest(config)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Test"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(config)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id!)}
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

      {/* Test Result Modal */}
      {testResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="card max-w-2xl w-full m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Test Result: {testResult.config.name}</h2>
              <button
                onClick={() => setTestResult(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className={`p-4 rounded-lg ${testResult.result.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.result.success ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold">Email Sent Successfully</span>
                  </>
                ) : (
                  <>
                    <X className="h-5 w-5 text-red-600" />
                    <span className="font-semibold">Failed to Send Email</span>
                  </>
                )}
              </div>
              {testResult.result.success && testResult.result.recipients && (
                <p className="text-sm">
                  Sent to: {testResult.result.recipients.join(', ')}
                </p>
              )}
              {testResult.result.error && (
                <p className="text-sm text-red-600">{testResult.result.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

