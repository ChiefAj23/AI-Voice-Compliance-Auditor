import { useState, useEffect } from 'react';
import { apiService, Webhook } from '../services/api';
import { Plus, Edit2, Trash2, Play, Filter, X, CheckCircle2, XCircle, Webhook as WebhookIcon } from 'lucide-react';

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [filter, setFilter] = useState<{ isActive?: boolean }>({});
  const [testResult, setTestResult] = useState<any>(null);

  const [formData, setFormData] = useState<Partial<Webhook>>({
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

  const [bearerToken, setBearerToken] = useState('');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');

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
      alert('Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        auth_config: Object.keys(authConfig).length > 0 ? authConfig : undefined,
      };

      if (editingWebhook?.id) {
        await apiService.updateWebhook(editingWebhook.id, webhookData);
      } else {
        await apiService.createWebhook(webhookData);
      }
      setShowForm(false);
      setEditingWebhook(null);
      resetForm();
      loadWebhooks();
    } catch (error) {
      console.error('Failed to save webhook:', error);
      alert('Failed to save webhook');
    }
  };

  const handleEdit = (webhook: Webhook) => {
    setEditingWebhook(webhook);
    setFormData(webhook);
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
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    try {
      await apiService.deleteWebhook(id);
      loadWebhooks();
    } catch (error) {
      console.error('Failed to delete webhook:', error);
      alert('Failed to delete webhook');
    }
  };

  const handleTest = async (webhook: Webhook) => {
    try {
      const result = await apiService.testWebhook(webhook.id!);
      setTestResult({ webhook: webhook, result });
    } catch (error) {
      console.error('Failed to test webhook:', error);
      alert('Failed to test webhook');
    }
  };

  const resetForm = () => {
    setFormData({
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
    setBearerToken('');
    setBasicUsername('');
    setBasicPassword('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Webhooks</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingWebhook(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Webhook
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
            {editingWebhook ? 'Edit Webhook' : 'Create New Webhook'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Webhook Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">HTTP Method *</label>
                <select
                  value={formData.method}
                  onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                  className="input"
                  required
                >
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Webhook URL *</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="input font-mono"
                placeholder="https://your-webhook-url.com/endpoint"
                required
              />
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Authentication Type</label>
                <select
                  value={formData.auth_type}
                  onChange={(e) => setFormData({ ...formData, auth_type: e.target.value as any })}
                  className="input"
                >
                  <option value="none">None</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                </select>
              </div>
            </div>

            {formData.auth_type === 'bearer' && (
              <div>
                <label className="label">Bearer Token</label>
                <input
                  type="password"
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  className="input font-mono"
                  placeholder="your-bearer-token"
                />
              </div>
            )}

            {formData.auth_type === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    value={basicUsername}
                    onChange={(e) => setBasicUsername(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    value={basicPassword}
                    onChange={(e) => setBasicPassword(e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Trigger Conditions</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.trigger_on_critical}
                    onChange={(e) => setFormData({ ...formData, trigger_on_critical: e.target.checked })}
                    className="mr-2"
                  />
                  Trigger on Critical Alerts
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.trigger_on_warning}
                    onChange={(e) => setFormData({ ...formData, trigger_on_warning: e.target.checked })}
                    className="mr-2"
                  />
                  Trigger on Warning Alerts
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.trigger_on_compliance_low}
                    onChange={(e) => setFormData({ ...formData, trigger_on_compliance_low: e.target.checked })}
                    className="mr-2"
                  />
                  Trigger on Low Compliance Score
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.trigger_on_custom_rule}
                    onChange={(e) => setFormData({ ...formData, trigger_on_custom_rule: e.target.checked })}
                    className="mr-2"
                  />
                  Trigger on Custom Rule Violations
                </label>
              </div>
              {formData.trigger_on_compliance_low && (
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
              <h3 className="font-semibold mb-2">Payload Options</h3>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.include_transcription}
                    onChange={(e) => setFormData({ ...formData, include_transcription: e.target.checked })}
                    className="mr-2"
                  />
                  Include Transcription
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.include_analysis}
                    onChange={(e) => setFormData({ ...formData, include_analysis: e.target.checked })}
                    className="mr-2"
                  />
                  Include Analysis Data
                </label>
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
                  setEditingWebhook(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingWebhook ? 'Update' : 'Create'} Webhook
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="text-center py-8">Loading webhooks...</div>
      ) : webhooks.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">No webhooks found. Create your first webhook!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className={`card ${!webhook.is_active ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <WebhookIcon className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold">{webhook.name}</h3>
                    {webhook.is_active ? (
                      <span className="text-xs bg-green-200 dark:bg-green-800 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Inactive</span>
                    )}
                  </div>
                  {webhook.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{webhook.description}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">URL:</span>{' '}
                      <span className="font-mono text-purple-600 dark:text-purple-400">{webhook.url}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Method:</span>{' '}
                      <span className="font-semibold">{webhook.method}</span>
                      <span className="text-gray-600 dark:text-gray-400 ml-4">Auth:</span>{' '}
                      <span className="font-semibold capitalize">{webhook.auth_type}</span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <span className="text-gray-600 dark:text-gray-400">
                        Success: <span className="font-semibold text-green-600">{webhook.success_count || 0}</span>
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        Failures: <span className="font-semibold text-red-600">{webhook.failure_count || 0}</span>
                      </span>
                      {webhook.last_triggered && (
                        <span className="text-gray-600 dark:text-gray-400">
                          Last: {new Date(webhook.last_triggered).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTest(webhook)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Test"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(webhook)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(webhook.id!)}
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
              <h2 className="text-xl font-semibold">Test Result: {testResult.webhook.name}</h2>
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
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-semibold">
                  {testResult.result.success ? 'Success' : 'Failed'}
                </span>
              </div>
              {testResult.result.status_code && (
                <p className="text-sm">Status Code: {testResult.result.status_code}</p>
              )}
              {testResult.result.error && (
                <p className="text-sm text-red-600">{testResult.result.error}</p>
              )}
              {testResult.result.response && (
                <div className="mt-2">
                  <p className="text-sm font-semibold">Response:</p>
                  <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded mt-1 overflow-auto max-h-32">
                    {testResult.result.response}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

