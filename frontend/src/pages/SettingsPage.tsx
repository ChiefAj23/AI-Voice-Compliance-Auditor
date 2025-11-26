import { useState } from 'react';
import { Settings, Save, AlertCircle, Trash2, Database } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../services/api';

interface ThresholdSettings {
  compliance_critical: number;
  compliance_warning: number;
  toxicity_critical: number;
  toxicity_warning: number;
  keyword_count_warning: number;
  keyword_count_critical: number;
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [settings, setSettings] = useState<ThresholdSettings>({
    compliance_critical: 50,
    compliance_warning: 70,
    toxicity_critical: 0.7,
    toxicity_warning: 0.5,
    keyword_count_warning: 5,
    keyword_count_critical: 10,
  });

  const [saved, setSaved] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetOptions, setResetOptions] = useState({
    reset_analyses: true,
    reset_users: false,
    reset_rules: false,
    reset_schedules: false,
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSave = () => {
    // In a real app, this would save to backend
    localStorage.setItem('alertThresholds', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateSetting = (key: keyof ThresholdSettings, value: number) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleResetDatabase = async () => {
    if (!confirm('⚠️ WARNING: This will permanently delete data from the database!\n\nAre you absolutely sure you want to proceed?')) {
      return;
    }

    const confirmText = resetOptions.reset_users ? 'DELETE ALL USERS' : 'RESET DATABASE';
    if (prompt(`Type "${confirmText}" to confirm:`) !== confirmText) {
      alert('Confirmation text does not match. Reset cancelled.');
      return;
    }

    setResetLoading(true);
    try {
      await usersApi.resetDatabase({
        confirm: true,
        ...resetOptions,
      });
      alert('Database reset successfully! The page will reload.');
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to reset database');
    } finally {
      setResetLoading(false);
      setShowResetConfirm(false);
    }
  };

  const isAdmin = currentUser && (currentUser.is_superuser || currentUser.roles.includes('admin'));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">⚙️ Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Configure alert thresholds and compliance rules.
        </p>
      </div>

      {/* Alert Thresholds */}
      <div className="card mb-6">
        <div className="flex items-center mb-4">
          <AlertCircle className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
          <h2 className="text-xl font-semibold dark:text-white">Alert Thresholds</h2>
        </div>

        <div className="space-y-6">
          {/* Compliance Thresholds */}
          <div>
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Compliance Score Thresholds</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label dark:text-gray-300">
                  Critical Alert (Below)
                </label>
                <input
                  type="number"
                  value={settings.compliance_critical}
                  onChange={(e) => updateSetting('compliance_critical', Number(e.target.value))}
                  className="input"
                  min="0"
                  max="100"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Alerts will be triggered when compliance score drops below this value
                </p>
              </div>
              <div>
                <label className="label dark:text-gray-300">
                  Warning Alert (Below)
                </label>
                <input
                  type="number"
                  value={settings.compliance_warning}
                  onChange={(e) => updateSetting('compliance_warning', Number(e.target.value))}
                  className="input"
                  min="0"
                  max="100"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Warnings will be triggered when compliance score drops below this value
                </p>
              </div>
            </div>
          </div>

          {/* Toxicity Thresholds */}
          <div>
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Toxicity Score Thresholds</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label dark:text-gray-300">
                  Critical Alert (Above)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.toxicity_critical}
                  onChange={(e) => updateSetting('toxicity_critical', Number(e.target.value))}
                  className="input"
                  min="0"
                  max="1"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Critical alerts when toxicity exceeds this value (0.0 - 1.0)
                </p>
              </div>
              <div>
                <label className="label dark:text-gray-300">
                  Warning Alert (Above)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.toxicity_warning}
                  onChange={(e) => updateSetting('toxicity_warning', Number(e.target.value))}
                  className="input"
                  min="0"
                  max="1"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Warnings when toxicity exceeds this value (0.0 - 1.0)
                </p>
              </div>
            </div>
          </div>

          {/* Keyword Thresholds */}
          <div>
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Keyword Detection Thresholds</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label dark:text-gray-300">
                  Warning (Count)
                </label>
                <input
                  type="number"
                  value={settings.keyword_count_warning}
                  onChange={(e) => updateSetting('keyword_count_warning', Number(e.target.value))}
                  className="input"
                  min="0"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Warning when this many problematic keywords are detected
                </p>
              </div>
              <div>
                <label className="label dark:text-gray-300">
                  Critical (Count)
                </label>
                <input
                  type="number"
                  value={settings.keyword_count_critical}
                  onChange={(e) => updateSetting('keyword_count_critical', Number(e.target.value))}
                  className="input"
                  min="0"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Critical alert when this many problematic keywords are detected
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            className="btn btn-primary flex items-center"
          >
            <Save className="mr-2 h-5 w-5" />
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
              About Alert Thresholds
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-400">
              These settings control when alerts and warnings are triggered during audio analysis.
              Critical alerts require immediate attention, while warnings indicate areas that may need review.
              Adjust these values based on your organization's compliance requirements.
            </p>
          </div>
        </div>
      </div>

      {/* Database Reset - Admin Only */}
      {isAdmin && (
        <div className="card mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center mb-4">
            <Database className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
            <h2 className="text-xl font-semibold dark:text-white text-red-900 dark:text-red-300">
              Database Management
            </h2>
          </div>

          <div className="space-y-4">
            <div className="bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                    ⚠️ Dangerous Operation
                  </h3>
                  <p className="text-sm text-red-800 dark:text-red-400 mb-2">
                    Resetting the database will permanently delete selected data. This action cannot be undone.
                    Make sure you have backups before proceeding.
                  </p>
                  <p className="text-sm font-medium text-red-900 dark:text-red-300">
                    You are logged in as an administrator.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetOptions.reset_analyses}
                  onChange={(e) => setResetOptions({ ...resetOptions, reset_analyses: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">Reset Analysis Records</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetOptions.reset_rules}
                  onChange={(e) => setResetOptions({ ...resetOptions, reset_rules: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">Reset Compliance Rules</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetOptions.reset_schedules}
                  onChange={(e) => setResetOptions({ ...resetOptions, reset_schedules: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-gray-700 dark:text-gray-300">Reset Scheduled Reports & Webhooks</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={resetOptions.reset_users}
                  onChange={(e) => setResetOptions({ ...resetOptions, reset_users: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-red-700 dark:text-red-400 font-medium">
                  Reset All Users (Full Database Reset)
                </span>
              </label>
            </div>

            <button
              onClick={handleResetDatabase}
              disabled={resetLoading || (!resetOptions.reset_analyses && !resetOptions.reset_users && !resetOptions.reset_rules && !resetOptions.reset_schedules)}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {resetLoading ? 'Resetting...' : 'Reset Selected Database Tables'}
            </button>
          </div>
        </div>
      )}

      {/* Developer Credit */}
      <div className="mt-8 card bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800">
        <div className="text-center py-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Developed with passion and dedication
          </p>
          <p className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
            ✨ Abhijeet Solanki ✨
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            AI Voice Compliance Auditor
          </p>
        </div>
      </div>
    </div>
  );
}
