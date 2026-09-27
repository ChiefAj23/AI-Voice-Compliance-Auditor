import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Copy,
  FileAudio,
  Info,
  ListChecks,
  MessagesSquare,
  User,
} from 'lucide-react';
import type { AnalysisResult } from '../services/api';
import { formatDateTime, formatDuration, formatNumber, formatPercent, formatScore, humanize, methodLabel, tidyLabel } from '../utils/format';
import { complianceLabel, complianceTone, sentimentLabel, sentimentTone, severityTone, toneText, toxicityTone } from '../utils/status';
import type { Tone } from '../utils/status';
import { useChartTheme } from '../utils/chart';
import ComplianceGauge from './ComplianceGauge';
import SentimentTimeline from './SentimentTimeline';
import AudioPlayer from './AudioPlayer';
import Comments from './Comments';
import Tags from './Tags';
import { Badge, Card, CardBody, CardHeader, EmptyState, Tabs, useToast } from './ui';
import type { TabItem } from './ui';

interface AnalysisResultsProps {
  result: AnalysisResult;
  audioFile?: File | null;
}

type TabId = 'overview' | 'transcript' | 'conversation' | 'collaboration';

const toxicityHint: Partial<Record<Tone, string>> = {
  success: 'Within normal range',
  warning: 'Above warning threshold',
  danger: 'Above critical threshold',
};

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="kpi-label">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-fg">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-fg-subtle">{hint}</dd>}
    </div>
  );
}

function SeverityIcon({ level }: { level?: string }) {
  const tone = severityTone(level);
  const Icon = tone === 'danger' ? AlertTriangle : tone === 'warning' ? AlertCircle : Info;
  return <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneText[tone]}`} aria-hidden="true" />;
}

/** A context snippet with one ellipsis on each trimmed side, whatever the backend sent. */
function excerpt(context: string): string {
  const text = context.trim().replace(/^(\.\.\.|…)\s*/, '').replace(/\s*(\.\.\.|…)$/, '');
  return `…${text}…`;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Context snippet with every occurrence of the matched phrase highlighted. */
function HighlightedContext({ context, text }: { context: string; text: string }) {
  if (!text) return <>{context}</>;
  const parts = context.split(new RegExp(`(${escapeRegExp(text)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === text.toLowerCase() ? (
          <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-fg dark:bg-amber-400/25">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function StatList({ entries }: { entries: [string, any][] }) {
  if (entries.length === 0) return <span className="text-fg-faint">—</span>;
  return (
    <ul className="space-y-0.5 text-[13px] font-normal">
      {entries.map(([key, value]) => (
        <li key={key} className="flex justify-between gap-3">
          <span className="truncate text-fg-muted">{humanize(key)}</span>
          <span className="tabular-nums text-fg">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AnalysisResults({ result, audioFile }: AnalysisResultsProps) {
  const [tab, setTab] = useState<TabId>('overview');
  const toast = useToast();
  const { series } = useChartTheme();
  const analysis = result.analysis;
  const alerts = result.alerts;
  const rules = result.custom_compliance_rules ?? [];
  const language = result.language;
  const languageName =
    language?.final_language_name || language?.whisper_language_name || language?.text_language_name || 'Unknown';
  const diarization = result.speaker_diarization;
  const conversation = result.conversation_analysis;
  const actionItems = result.action_items?.action_items ?? [];
  const topics = result.topics?.topics ?? [];
  const hasSummary = Boolean(result.summary?.summary);
  const hasIntent = Boolean(result.intent?.primary_intent);
  const hasFindings = Boolean(alerts?.has_alerts) || rules.length > 0;

  // The 0–100 score only reflects emotion and toxicity, so the verdict also weighs threshold
  // alerts and matched policy rules: a critical rule match outranks a high score.
  const matchedRules = rules.filter((rule: any) => rule.matched !== false);
  const criticalFindings =
    (alerts?.critical ?? 0) + matchedRules.filter((rule: any) => severityTone(rule.severity) === 'danger').length;
  const warningFindings =
    (alerts?.warning ?? 0) + matchedRules.filter((rule: any) => severityTone(rule.severity) === 'warning').length;
  const findingCount = (alerts?.total ?? 0) + matchedRules.length;
  const verdict =
    criticalFindings > 0
      ? { tone: 'danger' as const, label: criticalFindings === 1 ? 'Critical finding' : `${criticalFindings} critical findings` }
      : warningFindings > 0
        ? { tone: 'warning' as const, label: 'Needs review' }
        : { tone: complianceTone(analysis.compliance_score), label: complianceLabel(analysis.compliance_score) };

  const duration = Math.max(
    0,
    ...(result.speaker_timeline ?? []).map((seg) => seg.end),
    ...(result.sentiment_timeline?.timeline ?? []).map((seg: any) => Number(seg.end_time) || 0),
  );

  const playerSegments =
    result.speaker_timeline && result.speaker_timeline.length > 0
      ? result.speaker_timeline.map((seg) => ({ start: seg.start, end: seg.end, text: seg.text, speaker: seg.speaker }))
      : result.sentiment_timeline?.timeline
        ? result.sentiment_timeline.timeline.map((seg: any) => ({ start: seg.start_time, end: seg.end_time, text: seg.text }))
        : null;

  const tabs: TabItem<TabId>[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'conversation', label: 'Conversation' },
    ...(result.record_id ? [{ id: 'collaboration' as const, label: 'Comments and tags' }] : []),
  ];

  const copyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(result.transcription);
      toast.success('Transcript copied');
    } catch {
      toast.error('Could not copy the transcript');
    }
  };

  const wordCount = result.transcription ? result.transcription.trim().split(/\s+/).length : 0;
  const speakerStats = Object.entries(diarization?.speaker_stats || {});

  return (
    <div className="space-y-6">
      {/* Verdict */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-subtle text-fg-subtle">
              <FileAudio className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-fg">{audioFile?.name ?? 'Analysis result'}</h2>
              <p className="text-[13px] text-fg-subtle">
                {[
                  result.record_id ? `Record ${result.record_id}` : null,
                  duration > 0 ? `${formatDuration(duration)} long` : null,
                  languageName !== 'Unknown' ? languageName : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Analysis complete'}
              </p>
            </div>
          </div>
          <Badge tone={verdict.tone} dot className="self-start sm:self-auto">
            {verdict.label}
          </Badge>
        </div>

        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
          <div>
            <p className="kpi-label">Compliance score</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight text-fg">{formatScore(analysis.compliance_score)}</span>
              <span className="text-sm text-fg-subtle">/ 100</span>
            </p>
            <div className="mt-5">
              <ComplianceGauge score={analysis.compliance_score} />
            </div>
            <p className="mt-1 text-xs text-fg-subtle">Review below 70 · critical below 50</p>
          </div>

          <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            <Metric
              label="Sentiment"
              value={<Badge tone={sentimentTone(analysis.sentiment)}>{sentimentLabel(analysis.sentiment)}</Badge>}
              hint={`${formatPercent(analysis.sentiment_confidence)} confidence`}
            />
            <Metric
              label="Emotion"
              value={humanize(analysis.emotion)}
              hint={`${formatPercent(analysis.emotion_confidence)} confidence`}
            />
            <Metric
              label="Toxicity"
              value={formatPercent(analysis.toxicity_score)}
              hint={toxicityHint[toxicityTone(analysis.toxicity_score)] ?? 'Not scored'}
            />
            <Metric
              label="Language"
              value={languageName}
              hint={language ? `${formatPercent(language.confidence)} confidence` : undefined}
            />
            <Metric
              label="Speakers"
              value={diarization?.num_speakers_detected ?? '—'}
              hint={diarization ? `${diarization.segments.length} segments` : undefined}
            />
            <Metric
              label="Findings"
              value={findingCount}
              hint={`${criticalFindings} critical · ${warningFindings} warning`}
            />
          </dl>
        </div>
      </Card>

      {/* Findings */}
      {hasFindings ? (
        <Card>
          <CardHeader
            title="Findings"
            description="Alerts and policy rules triggered by this call."
            actions={
              <div className="flex gap-1.5">
                {criticalFindings > 0 && <Badge tone="danger">{criticalFindings} critical</Badge>}
                {warningFindings > 0 && <Badge tone="warning">{warningFindings} warning</Badge>}
              </div>
            }
          />
          <ul className="divide-y divide-line">
            {alerts?.alerts?.map((alert, idx) => (
              <li key={`alert-${idx}`} className="flex gap-3 px-5 py-4">
                <SeverityIcon level={alert.level} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-fg">{alert.message}</p>
                    <Badge tone={severityTone(alert.level)}>{humanize(alert.level)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-fg-subtle">
                    {humanize(alert.metric)}: <span className="tabular-nums">{alert.value}</span> · threshold{' '}
                    <span className="tabular-nums">{alert.threshold}</span> ·{' '}
                    {formatDateTime(alert.timestamp, { naive: 'local' })}
                  </p>
                </div>
              </li>
            ))}
            {rules.map((rule: any, idx: number) => (
              <li key={`rule-${idx}`} className="flex gap-3 px-5 py-4">
                <SeverityIcon level={rule.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-fg">{rule.rule_name}</p>
                    <Badge tone={severityTone(rule.severity)}>{humanize(rule.severity)}</Badge>
                    <Badge>{rule.matched === false ? 'Not triggered' : 'Policy rule'}</Badge>
                  </div>
                  {rule.message && !rule.matches?.length && typeof rule.value !== 'boolean' && (
                    <p className="mt-1 text-sm text-fg-muted">{rule.message}</p>
                  )}
                  {rule.matches && rule.matches.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-fg-subtle">
                        {rule.matches.length} {rule.matches.length === 1 ? 'match' : 'matches'}
                      </p>
                      <div className="max-h-40 space-y-2 overflow-y-auto">
                        {rule.matches.map((match: any, matchIdx: number) => (
                          <blockquote
                            key={matchIdx}
                            className="rounded-md border border-line bg-surface-subtle px-3 py-2 text-[13px] leading-5 text-fg-muted"
                          >
                            {match.context ? (
                              <HighlightedContext context={match.context} text={match.text} />
                            ) : (
                              <mark className="rounded bg-amber-200/70 px-0.5 text-fg dark:bg-amber-400/25">{match.text}</mark>
                            )}
                          </blockquote>
                        ))}
                      </div>
                    </div>
                  )}
                  {typeof rule.value === 'number' && (
                    <p className="mt-1 text-xs text-fg-subtle">
                      Value: <span className="tabular-nums">{String(rule.value)}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="callout callout-success">
          <CheckCircle2 />
          <p>No alerts or policy rule matches were raised for this call.</p>
        </div>
      )}

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {/* Overview */}
      <div hidden={tab !== 'overview'}>
        {hasSummary || hasIntent || actionItems.length > 0 || topics.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {hasSummary && result.summary && (
                <Card>
                  <CardHeader
                    title="Summary"
                    description={methodLabel(result.summary.model) ? `Generated with ${methodLabel(result.summary.model)}` : undefined}
                  />
                  <CardBody>
                    <p className="whitespace-pre-line text-sm leading-6 text-fg">{result.summary.summary}</p>
                    <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-subtle">
                      <div>
                        <dt className="inline">Transcript </dt>
                        <dd className="inline tabular-nums text-fg-muted">{formatNumber(result.summary.word_count)} words</dd>
                      </div>
                      <div>
                        <dt className="inline">Summary </dt>
                        <dd className="inline tabular-nums text-fg-muted">
                          {formatNumber(result.summary.summary_word_count)} words
                        </dd>
                      </div>
                      <div>
                        <dt className="inline">Compression </dt>
                        <dd className="inline tabular-nums text-fg-muted">{formatPercent(result.summary.compression_ratio)}</dd>
                      </div>
                    </dl>
                  </CardBody>
                </Card>
              )}

              {actionItems.length > 0 && result.action_items && (
                <Card>
                  <CardHeader
                    title="Action items"
                    description="Commitments and follow-ups detected in the conversation."
                    actions={<Badge>{actionItems.length} found</Badge>}
                  />
                  {result.action_items.statistics && (
                    <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
                      <Metric label="Total items" value={result.action_items.statistics.total} />
                      <Metric label="With deadlines" value={result.action_items.statistics.with_deadlines} />
                      <Metric
                        label="By type"
                        value={<StatList entries={Object.entries(result.action_items.statistics.by_type || {})} />}
                      />
                      <Metric
                        label="By assignee"
                        value={<StatList entries={Object.entries(result.action_items.statistics.by_assignee || {})} />}
                      />
                    </dl>
                  )}
                  <ul className="divide-y divide-line">
                    {actionItems.map((item: any, idx: number) => (
                      <li key={idx} className="flex gap-3 px-5 py-4">
                        <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-accent-fg" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-fg">{item.text}</p>
                            <Badge tone="accent">{humanize(item.item_type)}</Badge>
                            <span className="text-xs tabular-nums text-fg-subtle">
                              {formatPercent(item.confidence, 0)} confidence
                            </span>
                          </div>
                          {(item.assigned_to || item.deadline) && (
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-subtle">
                              {item.assigned_to && (
                                <span className="inline-flex items-center gap-1">
                                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                                  {item.assigned_to}
                                </span>
                              )}
                              {item.deadline && (
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                                  Due {item.deadline}
                                </span>
                              )}
                            </div>
                          )}
                          {item.context && <p className="mt-2 text-[13px] italic text-fg-subtle">“{excerpt(item.context)}”</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {topics.length > 0 && result.topics && (
                <Card>
                  <CardHeader
                    title="Topics"
                    description={`${result.topics.num_topics} ${result.topics.num_topics === 1 ? 'topic' : 'topics'} detected${methodLabel(result.topics.method) ? ` with ${methodLabel(result.topics.method)}` : ''}`}
                  />
                  <ul className="divide-y divide-line">
                    {topics.map((topic: any) => (
                      <li key={topic.topic_id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex flex-wrap gap-1.5">
                            {topic.keywords.map((keyword: string, idx: number) => (
                              <span key={idx} className="badge badge-neutral">
                                {keyword}
                              </span>
                            ))}
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-fg-subtle">
                            Topic {topic.topic_id} · {formatPercent(topic.importance, 0)}
                          </span>
                        </div>
                        <div className="mt-2.5 h-1.5 rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.min(100, topic.importance * 100)}%` }}
                          />
                        </div>
                        {topic.representative_sentence && (
                          <p className="mt-2.5 text-[13px] text-fg-subtle">“{topic.representative_sentence}”</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            {hasIntent && result.intent && (
              <Card className="self-start">
                <CardHeader title="Intent" description={methodLabel(result.intent.method) ? `Detected with ${methodLabel(result.intent.method)}` : undefined} />
                <CardBody>
                  <p className="kpi-label">Primary intent</p>
                  <p className="mt-1 text-lg font-semibold text-fg">{humanize(result.intent.primary_intent)}</p>
                  <p className="text-xs tabular-nums text-fg-subtle">
                    {formatPercent(result.intent.confidence)} confidence
                  </p>

                  {result.intent.all_intents && result.intent.all_intents.length > 0 && (
                    <ul className="mt-5 space-y-3">
                      {result.intent.all_intents.map((intent: any, idx: number) => (
                        <li key={idx}>
                          <div className="flex justify-between gap-3 text-[13px]">
                            <span className="text-fg-muted">{humanize(intent.intent)}</span>
                            <span className="tabular-nums text-fg-subtle">{formatPercent(intent.confidence, 0)}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.min(100, intent.confidence * 100)}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {result.intent.matched_keywords && result.intent.matched_keywords.length > 0 && (
                    <div className="mt-5 border-t border-line pt-4">
                      <p className="kpi-label mb-2">Matched keywords</p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.intent.matched_keywords.slice(0, 10).map((keyword: string, idx: number) => (
                          <span key={idx} className="badge badge-neutral">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={ListChecks}
              title="No insights for this call"
              description="Summary, topics, intent and action items appear here when the models find them."
            />
          </Card>
        )}
      </div>

      {/* Transcript */}
      <div hidden={tab !== 'transcript'} className="space-y-6">
        {audioFile && playerSegments && playerSegments.length > 0 && (
          <AudioPlayer audioUrl={audioFile} segments={playerSegments} />
        )}
        <Card>
          <CardHeader
            title="Full transcript"
            description={`${formatNumber(wordCount)} words`}
            actions={
              <button type="button" onClick={copyTranscript} className="btn btn-secondary btn-sm">
                <Copy />
                Copy
              </button>
            }
          />
          <CardBody>
            <p className="whitespace-pre-wrap text-sm leading-7 text-fg-muted">
              {result.transcription || 'No transcript was produced.'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Conversation */}
      <div hidden={tab !== 'conversation'} className="space-y-6">
        {(diarization && diarization.num_speakers_detected > 0) || conversation ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {diarization && diarization.num_speakers_detected > 0 && (
              <Card>
                <CardHeader title="Speakers" description="Share of talk time by speaker." />
                <CardBody>
                  <div className="flex gap-8">
                    <div>
                      <p className="kpi-label">Speakers detected</p>
                      <p className="kpi-value mt-1">{diarization.num_speakers_detected}</p>
                    </div>
                    <div>
                      <p className="kpi-label">Segments</p>
                      <p className="kpi-value mt-1">{diarization.segments.length}</p>
                    </div>
                  </div>
                  {speakerStats.length > 0 && (
                    <ul className="mt-6 space-y-3">
                      {speakerStats.map(([speaker, stats]: [string, any], idx) => (
                        <li key={speaker}>
                          <div className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="flex items-center gap-2 text-fg-muted">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: series[idx] ?? series[series.length - 1] }}
                                aria-hidden="true"
                              />
                              {tidyLabel(speaker)}
                            </span>
                            <span className="tabular-nums text-fg">
                              {stats.percentage}%
                              {stats.total_time !== undefined && (
                                <span className="ml-1.5 text-fg-subtle">{formatDuration(stats.total_time)}</span>
                              )}
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Number(stats.percentage) || 0)}%`,
                                backgroundColor: series[idx] ?? series[series.length - 1],
                              }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )}

            {conversation && (
              <Card className="self-start">
                <CardHeader title="Conversation dynamics" description="How the exchange flowed between speakers." />
                <dl className="grid grid-cols-2 gap-px bg-line">
                  <Metric label="Total turns" value={conversation.summary?.total_turns || 0} />
                  <Metric label="Interruptions" value={conversation.interruptions?.count || 0} />
                  <Metric label="Quality" value={humanize(conversation.summary?.conversation_quality || 'unknown')} />
                  <Metric label="Balance score" value={conversation.summary?.balance_score?.toFixed(1) || '0.0'} />
                </dl>
              </Card>
            )}
          </div>
        ) : null}

        {language && (
          <Card>
            <CardHeader title="Language detection" description={language.model_used ? `Model: ${language.model_used}` : undefined} />
            <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
              <Metric
                label="Detected language"
                value={languageName}
                hint={
                  language.agreement !== undefined
                    ? language.agreement
                      ? 'Audio and text detection agree'
                      : 'Audio and text detection differ'
                    : undefined
                }
              />
              <Metric
                label="Confidence"
                value={formatPercent(language.confidence)}
                hint={
                  language.whisper_confidence && language.text_confidence
                    ? `Audio ${formatPercent(language.whisper_confidence, 0)} · text ${formatPercent(language.text_confidence, 0)}`
                    : undefined
                }
              />
              <Metric
                label="Language code"
                value={
                  <span className="font-mono text-sm">
                    {language.final_detected || language.whisper_detected || language.text_detected || 'N/A'}
                  </span>
                }
              />
            </dl>
            {language.all_possible_languages && language.all_possible_languages.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-5 py-3">
                <span className="mr-1 text-xs text-fg-subtle">Other candidates</span>
                {language.all_possible_languages.slice(0, 5).map((lang, idx) => (
                  <span key={idx} className="badge badge-neutral">
                    {lang.name} <span className="tabular-nums text-fg-subtle">{formatPercent(lang.confidence, 0)}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>
        )}

        {result.sentiment_timeline && result.sentiment_timeline.timeline && (
          <SentimentTimeline timeline={result.sentiment_timeline} />
        )}

        {!diarization?.num_speakers_detected && !conversation && !language && !result.sentiment_timeline?.timeline && (
          <Card>
            <EmptyState
              icon={MessagesSquare}
              title="No conversation analysis"
              description="Speaker, language and timeline details appear here when available."
            />
          </Card>
        )}
      </div>

      {/* Collaboration */}
      {result.record_id && (
        <div hidden={tab !== 'collaboration'}>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Comments analysisId={result.record_id} />
            </div>
            <div>
              <Tags analysisId={result.record_id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
