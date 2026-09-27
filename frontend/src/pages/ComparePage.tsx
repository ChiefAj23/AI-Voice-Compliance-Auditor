import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { FileAudio, GitCompare, Info, Mic, Minus, Search, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiService } from '../services/api';
import type { HistoryRecord } from '../services/api';
import ChartTooltip from '../components/charts/ChartTooltip';
import { useChartTheme } from '../utils/chart';
import { formatDateTime, formatPercent, formatScore, humanize } from '../utils/format';
import { complianceLabel, complianceTone, sentimentLabel, sentimentTone } from '../utils/status';
import type { Tone } from '../utils/status';
import { Badge, Card, CardBody, CardHeader, EmptyState, LoadingState, PageHeader, Spinner, StatCard, useToast } from '../components/ui';
import { errorDetail } from '../utils/errors';
import TableView from '../components/charts/TableView';

const MAX_SELECTED = 10;

/** Keeps both ends of long file names so similar names stay distinguishable on the axis. */
function shortLabel(value: string): string {
  const text = String(value ?? '');
  return text.length > 16 ? `${text.slice(0, 7)}…${text.slice(-7)}` : text;
}

function describeChange(value: number | null | undefined): { text: string; tone: Tone; label: string; icon: LucideIcon } {
  if (value == null || Number.isNaN(value)) return { text: '—', tone: 'neutral', label: 'No data', icon: Minus };
  const rounded = Number(value.toFixed(1));
  if (rounded > 0) return { text: `+${formatScore(rounded)}`, tone: 'success', label: 'Improved', icon: TrendingUp };
  if (rounded < 0) return { text: `−${formatScore(Math.abs(rounded))}`, tone: 'danger', label: 'Declined', icon: TrendingDown };
  return { text: formatScore(0), tone: 'neutral', label: 'No change', icon: Minus };
}

function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-3 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function RecordingCell({ filename, id }: { filename: string; id?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-subtle text-fg-subtle">
        <FileAudio className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="max-w-[18rem] truncate font-medium text-fg" title={filename}>
          {filename}
        </p>
        {id !== undefined && <p className="text-xs tabular-nums text-fg-subtle">ID {id}</p>}
      </div>
    </div>
  );
}

// Sticky header cells lose their bottom border under border-collapse, so draw it as an inset shadow.
const stickyTh = 'sticky top-0 z-10 border-b-0 shadow-[inset_0_-1px_0_rgb(var(--line))]';

export default function ComparePage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const t = useChartTheme();

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await apiService.getHistory({ limit: 100 });
      setRecords(data.records);
    } catch (error) {
      console.error('Failed to load records:', error);
      toast.error('Could not load analyses', 'Check that the API is running and try again.');
    } finally {
      setRecordsLoading(false);
    }
  };

  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      if (selectedIds.length < MAX_SELECTED) {
        setSelectedIds([...selectedIds, id]);
      } else {
        toast.warning(`You can compare up to ${MAX_SELECTED} analyses`, 'Clear one before selecting another.');
      }
    }
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      toast.warning('Select at least two analyses', `Pick 2 to ${MAX_SELECTED} analyses to compare.`);
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.compareAnalyses(selectedIds);
      setComparison(result);
    } catch (error) {
      console.error('Failed to compare:', error);
      toast.error('Comparison failed', errorDetail(error));
    } finally {
      setLoading(false);
    }
  };

  const comparisonData = comparison?.records?.map((r: any) => ({
    name: r.filename || `Record ${r.id}`,
    compliance: r.analysis?.compliance_score || 0,
    toxicity: (r.analysis?.toxicity_score || 0) * 100,
  })) || [];

  const query = searchTerm.trim().toLowerCase();
  const visibleRecords = query
    ? records.filter(
        (r) =>
          (r.filename ?? '').toLowerCase().includes(query) ||
          (r.transcription ?? '').toLowerCase().includes(query) ||
          String(r.id) === query
      )
    : records;

  const selectedCount = selectedIds.length;
  const compareLabel = loading
    ? 'Comparing…'
    : selectedCount >= 2
      ? `Compare ${selectedCount} analyses`
      : 'Compare analyses';

  // The comparison belongs to the ids (and order) it was run with; flag when the selection moves on.
  const comparedIds: number[] = comparison?.records?.map((r: any) => r.id) ?? [];
  const selectionChanged =
    comparison !== null &&
    (comparedIds.length !== selectedIds.length || comparedIds.some((id, i) => id !== selectedIds[i]));

  const compliance = comparison?.metrics?.compliance;
  const change = describeChange(compliance?.improvement);
  const series = [
    { key: 'compliance', label: 'Compliance score', color: t.series[0] },
    { key: 'toxicity', label: 'Toxicity (%)', color: t.series[1] },
  ];

  return (
    <div>
      <PageHeader
        title="Compare analyses"
        description={`Select 2 to ${MAX_SELECTED} analyses to compare their scores side by side.`}
      />

      <div className="space-y-6">
        {/* Record selection */}
        <Card className="overflow-hidden">
          {!recordsLoading && records.length === 0 ? (
            <EmptyState
              icon={GitCompare}
              title="No analyses to compare yet"
              description="Analyze a few calls first, then come back to compare them."
              action={
                <Link to="/" className="btn btn-primary">
                  <Mic />
                  New analysis
                </Link>
              }
            />
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
                  <input
                    type="search"
                    placeholder="Search file name or transcript"
                    aria-label="Search analyses"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input pl-9"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 lg:justify-end">
                  <p className="mr-1 text-[13px] tabular-nums text-fg-subtle" aria-live="polite">
                    {selectedCount} of {MAX_SELECTED} selected
                  </p>
                  <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                      <button type="button" onClick={() => setSelectedIds([])} className="btn btn-ghost">
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCompare}
                      disabled={loading || selectedCount < 2}
                      className="btn btn-primary"
                    >
                      {loading ? <Spinner /> : <GitCompare />}
                      {compareLabel}
                    </button>
                  </div>
                </div>
              </div>

              {!recordsLoading && visibleRecords.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No matching analyses"
                  description="Try a different file name, phrase or record ID."
                  action={
                    <button type="button" onClick={() => setSearchTerm('')} className="btn btn-secondary">
                      Clear search
                    </button>
                  }
                />
              ) : (
                <div className="max-h-[28rem] overflow-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className={clsx(stickyTh, 'w-10 pr-0')}>
                          <span className="sr-only">Select</span>
                        </th>
                        <th className={stickyTh}>Recording</th>
                        <th className={stickyTh}>Analyzed</th>
                        <th className={stickyTh}>Compliance</th>
                        <th className={stickyTh}>Sentiment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recordsLoading
                        ? Array.from({ length: 5 }, (_, i) => (
                            <tr key={i}>
                              <td className="w-10 pr-0"><div className="skeleton h-4 w-4" /></td>
                              <td>
                                <div className="skeleton h-4 w-48" />
                                <div className="skeleton mt-2 h-3 w-16" />
                              </td>
                              <td><div className="skeleton h-4 w-32" /></td>
                              <td><div className="skeleton h-5 w-28" /></td>
                              <td><div className="skeleton h-5 w-16" /></td>
                            </tr>
                          ))
                        : visibleRecords.map((record) => {
                            const isSelected = selectedIds.includes(record.id);
                            const score = record.analysis?.compliance_score;
                            const sentiment = record.analysis?.sentiment;
                            return (
                              <tr
                                key={record.id}
                                onClick={() => toggleSelection(record.id)}
                                className={clsx(
                                  'cursor-pointer transition-colors duration-100',
                                  isSelected ? 'bg-accent-subtle/50' : 'hover:bg-surface-subtle/70',
                                )}
                              >
                                <td className="w-10 pr-0">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelection(record.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`Select ${record.filename}`}
                                    className="h-4 w-4 cursor-pointer align-middle"
                                  />
                                </td>
                                <td>
                                  <RecordingCell filename={record.filename} id={record.id} />
                                </td>
                                <td className="whitespace-nowrap tabular-nums text-fg-muted">
                                  {formatDateTime(record.created_at)}
                                </td>
                                <td>
                                  <div className="flex items-center gap-2.5">
                                    <span className="w-9 font-medium tabular-nums">{formatScore(score)}</span>
                                    <Badge tone={complianceTone(score)} dot>
                                      {complianceLabel(score)}
                                    </Badge>
                                  </div>
                                </td>
                                <td>
                                  {sentiment ? (
                                    <Badge tone={sentimentTone(sentiment)}>{sentimentLabel(sentiment)}</Badge>
                                  ) : (
                                    <span className="text-fg-faint">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Comparison results */}
        {comparison ? (
          <div className={clsx('space-y-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
            {selectionChanged && !loading && (
              <div className="callout callout-info">
                <Info />
                <div>
                  {selectedCount >= 2
                    ? 'Your selection has changed. Compare again to update these results.'
                    : 'These results are from your previous selection. Select at least two analyses to compare again.'}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Analyses compared" value={comparison.summary?.count || 0} />
              <StatCard
                label="Average compliance"
                value={formatScore(compliance?.average)}
                hint={
                  <Badge tone={complianceTone(compliance?.average)} dot>
                    {complianceLabel(compliance?.average)}
                  </Badge>
                }
              />
              <StatCard
                label="Score range"
                value={formatScore(compliance?.range)}
                hint={
                  <span className="tabular-nums">
                    {formatScore(compliance?.min)} to {formatScore(compliance?.max)}
                  </span>
                }
              />
              <StatCard
                label="Change"
                value={change.text}
                icon={change.icon}
                hint={
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={change.tone}>{change.label}</Badge>
                    Last selected vs. first
                  </span>
                }
              />
            </div>

            {comparisonData.length > 0 && (
              <Card>
                <CardHeader
                  title="Compliance and toxicity"
                  description="Each analysis in the order you selected it, on a shared 0–100 scale."
                />
                <CardBody>
                  <ChartLegend items={series} />
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={comparisonData}
                        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
                        barGap={2}
                        barCategoryGap="28%"
                      >
                        <CartesianGrid {...t.grid} />
                        <XAxis dataKey="name" tickFormatter={shortLabel} {...t.axis} />
                        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={40} {...t.axis} />
                        <Tooltip
                          content={<ChartTooltip valueFormatter={(v) => v.toFixed(1)} />}
                          cursor={{ fill: t.grid.stroke, fillOpacity: 0.6 }}
                        />
                        {series.map((s) => (
                          <Bar
                            key={s.key}
                            dataKey={s.key}
                            name={s.label}
                            fill={s.color}
                            radius={[4, 4, 0, 0]}
                            barSize={20}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
                <TableView>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Analysis</th>
                        <th className="text-right">Compliance score</th>
                        <th className="text-right">Toxicity (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonData.map((row: { name: string; compliance: number; toxicity: number }, index: number) => (
                        <tr key={`${row.name}-${index}`}>
                          <td className="text-fg">{row.name}</td>
                          <td className="text-right tabular-nums text-fg-muted">{row.compliance.toFixed(1)}</td>
                          <td className="text-right tabular-nums text-fg-muted">{row.toxicity.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableView>
              </Card>
            )}

            <Card className="overflow-hidden">
              <CardHeader title="Detailed comparison" description="Scores and labels for each analysis, in selection order." />
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Recording</th>
                      <th>Compliance</th>
                      <th className="text-right">Toxicity</th>
                      <th>Sentiment</th>
                      <th>Emotion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.records?.map((record: any, index: number) => {
                      const score = record.analysis?.compliance_score;
                      const sentiment = record.analysis?.sentiment;
                      const emotion = record.analysis?.emotion;
                      return (
                        <tr key={record.id ?? index}>
                          <td>
                            <RecordingCell filename={record.filename || `Record ${record.id}`} id={record.id} />
                          </td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span className="w-9 font-medium tabular-nums">{formatScore(score)}</span>
                              <Badge tone={complianceTone(score)} dot>
                                {complianceLabel(score)}
                              </Badge>
                            </div>
                          </td>
                          <td className="text-right tabular-nums text-fg-muted">
                            {formatPercent(record.analysis?.toxicity_score)}
                          </td>
                          <td>
                            {sentiment ? (
                              <Badge tone={sentimentTone(sentiment)}>{sentimentLabel(sentiment)}</Badge>
                            ) : (
                              <span className="text-fg-faint">—</span>
                            )}
                          </td>
                          <td className="text-fg-muted">
                            {emotion ? humanize(emotion) : <span className="text-fg-faint">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : loading ? (
          <Card>
            <LoadingState label="Comparing analyses…" />
          </Card>
        ) : (
          (recordsLoading || records.length > 0) && (
            <Card>
              {selectedCount < 2 ? (
                <EmptyState
                  icon={GitCompare}
                  title="Select at least two analyses"
                  description={
                    selectedCount === 1
                      ? `1 selected. Pick at least one more, up to ${MAX_SELECTED} in total.`
                      : `Pick 2 to ${MAX_SELECTED} analyses from the list above to see their scores side by side.`
                  }
                />
              ) : (
                <EmptyState
                  icon={GitCompare}
                  title="Ready to compare"
                  description={`${selectedCount} analyses selected. Run the comparison to see scores, a chart and a detailed table.`}
                  action={
                    <button type="button" onClick={handleCompare} className="btn btn-secondary">
                      <GitCompare />
                      {`Compare ${selectedCount} analyses`}
                    </button>
                  }
                />
              )}
            </Card>
          )
        )}
      </div>
    </div>
  );
}
