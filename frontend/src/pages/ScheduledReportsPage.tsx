import { useState, useEffect } from 'react';
import { apiService, ScheduledReport } from '../services/api';
import { Plus, Edit2, Trash2, Play, Calendar, Mail, Clock, Filter, X, CheckCircle2 } from 'lucide-react';

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  const [filter, setFilter] = useState<{ isActive?: boolean }>({});

  const [formData, setFormData] = useState<Partial<ScheduledReport>>({
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
      alert('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingReport?.id) {
        await apiService.updateScheduledReport(editingReport.id, formData);
      } else {
        await apiService.createScheduledReport(formData);
      }
      setShowForm(false);
      setEditingReport(null);
      resetForm();
      loadReports();
    } catch (error) {
      console.error('Failed to save report:', error);
      alert('Failed to save scheduled report');
    }
  };

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report);
    setFormData(report);
    setEmailInput(report.email_recipients?.join(', ') || '');
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;
    try {
      await apiService.deleteScheduledReport(id);
      loadReports();
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert('Failed to delete scheduled report');
    }
  };

  const handleRunNow = async (id: number) => {
    if (!confirm('Run this report now?')) return;
    try {
      await apiService.runScheduledReportNow(id);
      alert('Report execution triggered. Check your email shortly.');
      loadReports();
    } catch (error) {
      console.error('Failed to run report:', error);
      alert('Failed to run scheduled report');
    }
  };

  const resetForm = () => {
    setFormData({
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

  const formatNextRun = (nextRun?: string) => {
    if (!nextRun) return 'Not scheduled';
    return new Date(nextRun).toLocaleString();
  };

  const formatLastRun = (lastRun?: string) => {
    if (!lastRun) return 'Never';
    return new Date(lastRun).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Scheduled Reports</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingReport(null);
            setShowForm(true);
          }}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Schedule
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
            {editingReport ? 'Edit Scheduled Report' : 'Create New Scheduled Report'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Report Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Report Type *</label>
                <select
                  value={formData.report_type}
                  onChange={(e) => setFormData({ ...formData, report_type: e.target.value as any })}
                  className="input"
                  required
                >
                  <option value="summary">Summary</option>
                  <option value="detailed">Detailed</option>
                </select>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Schedule Type *</label>
                <select
                  value={formData.schedule_type}
                  onChange={(e) => {
                    const scheduleType = e.target.value as any;
                    let config = { hour: 9, minute: 0 };
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
                  <option value="custom">Custom (Cron)</option>
                </select>
              </div>
              <div>
                <label className="label">Timezone</label>
                <input
                  type="text"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="input"
                  placeholder="UTC"
                />
              </div>
            </div>

            {formData.schedule_type === 'daily' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.schedule_config?.hour || 9}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, hour: parseInt(e.target.value) || 9 },
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Minute (0-59)</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.schedule_config?.minute || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, minute: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="input"
                  />
                </div>
              </div>
            )}

            {formData.schedule_type === 'weekly' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Day of Week</label>
                  <select
                    value={formData.schedule_config?.day_of_week || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, day_of_week: parseInt(e.target.value) },
                      })
                    }
                    className="input"
                  >
                    <option value="0">Monday</option>
                    <option value="1">Tuesday</option>
                    <option value="2">Wednesday</option>
                    <option value="3">Thursday</option>
                    <option value="4">Friday</option>
                    <option value="5">Saturday</option>
                    <option value="6">Sunday</option>
                  </select>
                </div>
                <div>
                  <label className="label">Hour</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.schedule_config?.hour || 9}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, hour: parseInt(e.target.value) || 9 },
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Minute</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.schedule_config?.minute || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, minute: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="input"
                  />
                </div>
              </div>
            )}

            {formData.schedule_type === 'monthly' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.schedule_config?.day || 1}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, day: parseInt(e.target.value) || 1 },
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Hour</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.schedule_config?.hour || 9}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, hour: parseInt(e.target.value) || 9 },
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Minute</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.schedule_config?.minute || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        schedule_config: { ...formData.schedule_config, minute: parseInt(e.target.value) || 0 },
                      })
                    }
                    className="input"
                  />
                </div>
              </div>
            )}

            {formData.schedule_type === 'custom' && (
              <div>
                <label className="label">Cron Expression (minute hour day month day_of_week)</label>
                <input
                  type="text"
                  value={formData.schedule_config?.cron_expression || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      schedule_config: { ...formData.schedule_config, cron_expression: e.target.value },
                    })
                  }
                  className="input font-mono"
                  placeholder="0 9 * * 1-5"
                />
                <p className="text-xs text-gray-500 mt-1">Example: "0 9 * * 1-5" (9 AM weekdays)</p>
              </div>
            )}

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

            <div>
              <label className="label">Email Subject</label>
              <input
                type="text"
                value={formData.email_subject || ''}
                onChange={(e) => setFormData({ ...formData, email_subject: e.target.value })}
                className="input"
                placeholder="Automated Compliance Report"
              />
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

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingReport(null);
                  resetForm();
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingReport ? 'Update' : 'Create'} Schedule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="text-center py-8">Loading schedules...</div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500">No scheduled reports found. Create your first schedule!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className={`card ${!report.is_active ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold">{report.name}</h3>
                    {report.is_active ? (
                      <span className="text-xs bg-green-200 dark:bg-green-800 px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">Inactive</span>
                    )}
                  </div>
                  {report.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{report.description}</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Schedule:</span>{' '}
                      <span className="font-semibold capitalize">{report.schedule_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Report Type:</span>{' '}
                      <span className="font-semibold capitalize">{report.report_type}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Run Count:</span>{' '}
                      <span className="font-semibold">{report.run_count || 0}</span>
                    </div>
                    <div>
                      <Clock className="h-4 w-4 inline mr-1" />
                      <span className="text-gray-600 dark:text-gray-400">Next Run:</span>{' '}
                      <span className="font-semibold">{formatNextRun(report.next_run)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Last Run:</span>{' '}
                      <span className="font-semibold">{formatLastRun(report.last_run)}</span>
                    </div>
                    <div>
                      <Mail className="h-4 w-4 inline mr-1" />
                      <span className="text-gray-600 dark:text-gray-400">
                        {report.email_recipients?.length || 0} Recipient(s)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRunNow(report.id!)}
                    className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                    title="Run Now"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(report)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(report.id!)}
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
    </div>
  );
}

