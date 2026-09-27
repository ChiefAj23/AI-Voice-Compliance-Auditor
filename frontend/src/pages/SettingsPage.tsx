import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usersApi } from '../services/api';
import Logo from '../components/Logo';
import {
  Badge,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  PageHeader,
  Spinner,
  Switch,
  useConfirm,
  useToast,
} from '../components/ui';
import { errorDetail } from '../utils/errors';

interface ThresholdSettings {
  compliance_critical: number;
  compliance_warning: number;
  toxicity_critical: number;
  toxicity_warning: number;
  keyword_count_warning: number;
  keyword_count_critical: number;
}

interface ThresholdField {
  key: keyof ThresholdSettings;
  label: string;
  help: string;
  min: string;
  max?: string;
  step?: string;
}

const THRESHOLD_GROUPS: { title: string; description: string; fields: ThresholdField[] }[] = [
  {
    title: 'Compliance score',
    description: 'Scores run from 0 to 100. Alerts fire when a score drops below a threshold.',
    fields: [
      {
        key: 'compliance_warning',
        label: 'Warning below',
        help: 'Raise a warning when the score drops below this value.',
        min: '0',
        max: '100',
      },
      {
        key: 'compliance_critical',
        label: 'Critical below',
        help: 'Raise a critical alert when the score drops below this value.',
        min: '0',
        max: '100',
      },
    ],
  },
  {
    title: 'Toxicity',
    description: 'A probability from 0.0 to 1.0. Alerts fire when toxicity rises above a threshold.',
    fields: [
      {
        key: 'toxicity_warning',
        label: 'Warning above',
        help: 'Raise a warning when toxicity exceeds this value.',
        min: '0',
        max: '1',
        step: '0.1',
      },
      {
        key: 'toxicity_critical',
        label: 'Critical above',
        help: 'Raise a critical alert when toxicity exceeds this value.',
        min: '0',
        max: '1',
        step: '0.1',
      },
    ],
  },
  {
    title: 'Keyword detection',
    description: 'Problematic keywords detected in a single call.',
    fields: [
      {
        key: 'keyword_count_warning',
        label: 'Warning count',
        help: 'Raise a warning when this many problematic keywords are detected.',
        min: '0',
      },
      {
        key: 'keyword_count_critical',
        label: 'Critical count',
        help: 'Raise a critical alert when this many problematic keywords are detected.',
        min: '0',
      },
    ],
  },
];

type ResetOption = 'reset_analyses' | 'reset_rules' | 'reset_schedules' | 'reset_users';

// Descriptions mirror what POST /api/admin/reset-database drops for each option.
// `deletes` feeds the confirm dialog; the full reset has its own wording there.
const RESET_OPTIONS: { key: ResetOption; label: string; description: string; deletes?: string }[] = [
  {
    key: 'reset_analyses',
    label: 'Analysis records',
    description: 'Every analyzed call, with its comments and tag assignments.',
    deletes: 'All analysis records, including their comments and tag assignments',
  },
  {
    key: 'reset_rules',
    label: 'Compliance rules',
    description: 'Every compliance rule used to score calls.',
    deletes: 'All compliance rules',
  },
  {
    key: 'reset_schedules',
    label: 'Scheduled reports and webhooks',
    description: 'Scheduled reports, webhooks and notification configurations.',
    deletes: 'All scheduled reports, webhooks and notification configurations',
  },
  {
    key: 'reset_users',
    label: 'All users',
    description: 'Drops every table, users and teams included, then recreates the default roles and admin account.',
  },
];

/** Two-column settings row on large screens: heading and description left, content right. */
function SettingsSection({ title, description, children }: { title: ReactNode; description: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-x-8 gap-y-4 py-8 first:pt-0 last:pb-0 lg:grid-cols-3">
      <div>
        <h2 className="section-title">{title}</h2>
        <p className="mt-1 text-[13px] leading-5 text-fg-subtle">{description}</p>
      </div>
      <div className="min-w-0 lg:col-span-2">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
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
  const [confirmInput, setConfirmInput] = useState('');

  const handleSave = () => {
    // In a real app, this would save to backend
    localStorage.setItem('alertThresholds', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateSetting = (key: keyof ThresholdSettings, value: number) => {
    setSettings({ ...settings, [key]: value });
  };

  const confirmText = resetOptions.reset_users ? 'DELETE ALL USERS' : 'RESET DATABASE';
  const nothingSelected =
    !resetOptions.reset_analyses && !resetOptions.reset_users && !resetOptions.reset_rules && !resetOptions.reset_schedules;
  const selectedCount = RESET_OPTIONS.filter((option) => resetOptions[option.key]).length;

  const handleResetDatabase = async () => {
    if (confirmInput !== confirmText) {
      toast.error('Confirmation text does not match', 'Reset cancelled.');
      return;
    }

    const confirmed = await confirm({
      title: resetOptions.reset_users ? 'Reset the entire database?' : 'Reset the selected data?',
      description: resetOptions.reset_users ? (
        <p>
          Every table is dropped, including all users, teams, analyses, compliance rules, scheduled reports and
          webhooks. Only the default roles and admin account are recreated. This can't be undone.
        </p>
      ) : (
        <>
          <p>This permanently deletes:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {RESET_OPTIONS.filter((option) => option.key !== 'reset_users' && resetOptions[option.key]).map((option) => (
              <li key={option.key}>{option.deletes}</li>
            ))}
          </ul>
          <p className="mt-2">This can't be undone.</p>
        </>
      ),
      confirmLabel: resetOptions.reset_users ? 'Reset everything' : 'Reset data',
      tone: 'danger',
    });
    if (!confirmed) return;

    setResetLoading(true);
    try {
      await usersApi.resetDatabase({
        confirm: true,
        ...resetOptions,
      });
      toast.success('Database reset', 'Reloading the app…');
      // Leave the toast on screen briefly; the reload replaces the old blocking alert.
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      toast.error('Could not reset the database', errorDetail(error));
      setResetLoading(false);
    }
  };

  const isAdmin = currentUser && (currentUser.is_superuser || currentUser.roles.includes('admin'));

  return (
    <div>
      <PageHeader title="Settings" description="Configure when analyses raise alerts." />

      <div className="divide-y divide-line">
        <SettingsSection
          title="Alert thresholds"
          description="Decide when an analysis raises an alert. Critical alerts need immediate attention; warnings flag calls that may need review."
        >
          <Card>
            <div className="divide-y divide-line">
              {THRESHOLD_GROUPS.map((group) => (
                <div key={group.title} className="p-5">
                  <h3 className="section-title">{group.title}</h3>
                  <p className="mt-0.5 text-[13px] text-fg-subtle">{group.description}</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {group.fields.map((field) => (
                      <Field key={field.key} label={field.label} htmlFor={`threshold-${field.key}`} help={field.help}>
                        <input
                          id={`threshold-${field.key}`}
                          type="number"
                          value={settings[field.key]}
                          onChange={(e) => updateSetting(field.key, Number(e.target.value))}
                          className="input"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <CardFooter>
              <p className="text-[13px] text-fg-subtle">Saved in this browser only.</p>
              <button type="button" onClick={handleSave} className="btn btn-primary">
                {saved ? <Check /> : <Save />}
                {saved ? 'Saved' : 'Save changes'}
              </button>
            </CardFooter>
          </Card>
        </SettingsSection>

        {/* Database reset - admin only */}
        {isAdmin && (
          <SettingsSection
            title="Data management"
            description="Administrator tools for the audit database. Only administrators see this section."
          >
            <Card>
              <CardHeader
                title={<span className="text-red-600 dark:text-red-400">Danger zone</span>}
                description="Resetting permanently deletes the selected data and can't be undone. Make sure you have a backup first."
              />
              <CardBody className="space-y-5">
                <div className="divide-y divide-line rounded-lg border border-line">
                  {RESET_OPTIONS.map((option) => (
                    <div key={option.key} className="flex items-start justify-between gap-4 px-4 py-3">
                      <Switch
                        checked={resetOptions[option.key]}
                        onChange={(checked) => setResetOptions({ ...resetOptions, [option.key]: checked })}
                        label={option.label}
                        description={option.description}
                        disabled={resetLoading}
                      />
                      {option.key === 'reset_users' && <Badge tone="danger">Full reset</Badge>}
                    </div>
                  ))}
                </div>

                <Field
                  label={
                    <>
                      Type <span className="code-chip">{confirmText}</span> to confirm
                    </>
                  }
                  htmlFor="reset-confirmation"
                >
                  <input
                    id="reset-confirmation"
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={resetLoading}
                    className="input font-mono text-[13px]"
                  />
                </Field>
              </CardBody>
              <CardFooter>
                <p className="text-[13px] text-fg-subtle">
                  {nothingSelected
                    ? 'Select at least one data set to reset.'
                    : resetOptions.reset_users
                      ? 'Full reset selected.'
                      : `${selectedCount} selected`}
                </p>
                <button
                  type="button"
                  onClick={handleResetDatabase}
                  disabled={resetLoading || nothingSelected || confirmInput !== confirmText}
                  className="btn btn-danger"
                >
                  {resetLoading ? <Spinner /> : <Trash2 />}
                  {resetLoading ? 'Resetting…' : 'Reset database'}
                </button>
              </CardFooter>
            </Card>
          </SettingsSection>
        )}

        <SettingsSection title="About" description="Product information and credits.">
          <Card>
            <CardBody className="flex items-center gap-4">
              <Logo className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <p className="section-title">Voice Compliance Auditor</p>
                <p className="mt-0.5 text-[13px] text-fg-subtle">
                  Developed by <span className="font-medium text-fg-muted">Abhijeet Solanki</span>
                </p>
              </div>
            </CardBody>
          </Card>
        </SettingsSection>
      </div>
    </div>
  );
}
