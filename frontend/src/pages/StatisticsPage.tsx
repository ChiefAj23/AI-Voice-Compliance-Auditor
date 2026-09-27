import { useState, useEffect, useMemo } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, isValid, parseISO } from 'date-fns';
import clsx from 'clsx';
import { apiService } from '../services/api';
import ChartTooltip from '../components/charts/ChartTooltip';
import { useChartTheme } from '../utils/chart';
import { formatNumber, formatScore, humanize } from '../utils/format';
import { complianceLabel, complianceTone, sentimentName } from '../utils/status';
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, SegmentedControl, StatCard, useToast } from '../components/ui';
import TableView from '../components/charts/TableView';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: '1 year' },
];

const MAX_EMOTIONS = 6;

type Polarity = 'negative' | 'neutral' | 'positive';

function polarityOf(key: string): Polarity | null {
  const k = sentimentName(key);
  if (k.startsWith('neg')) return 'negative';
  if (k.startsWith('neu')) return 'neutral';
  if (k.startsWith('pos')) return 'positive';
  return null;
}

// Dates arrive as "YYYY-MM-DD"; parseISO keeps them on the local calendar day.
function shortDate(value: string) {
  const date = parseISO(value);
  return isValid(date) ? format(date, 'MMM d') : value;
}

function toEntries(distribution: Record<string, number> | undefined) {
  return Object.entries(distribution || {})
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value);
}

/** One bar per category, sorted, single color; values are printed so nothing hides behind hover. */
function RankedBars({ data, color }: { data: { name: string; value: number }[]; color: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.name}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-fg-muted">{humanize(d.name)}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium text-fg">{formatNumber(d.value)}</span>
              <span className="ml-1.5 text-fg-subtle">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-surface-muted">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState(30);
  const t = useChartTheme();
  const toast = useToast();

  useEffect(() => {
    loadStatistics();
  }, [daysRange]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const data = await apiService.getStatistics(daysRange);
      setStats(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
      toast.error('Could not load statistics');
    } finally {
      setLoading(false);
    }
  };

  const trendsData = useMemo(
    () =>
      (stats?.trends || []).map((trend: any) => ({
        date: trend.date,
        label: shortDate(trend.date),
        average: trend.average_compliance,
        range: [trend.min_compliance, trend.max_compliance],
        min: trend.min_compliance,
        max: trend.max_compliance,
        count: trend.count,
      })),
    [stats],
  );

  const sentimentEntries = useMemo(() => toEntries(stats?.by_sentiment ?? stats?.sentiment_distribution), [stats]);
  const sentimentSplit = useMemo(() => {
    if (sentimentEntries.length === 0 || sentimentEntries.some((e) => polarityOf(e.name) === null)) return null;
    const totals: Record<Polarity, number> = { negative: 0, neutral: 0, positive: 0 };
    sentimentEntries.forEach((e) => {
      totals[polarityOf(e.name) as Polarity] += e.value;
    });
    return totals;
  }, [sentimentEntries]);

  const emotionData = useMemo(() => {
    const entries = toEntries(stats?.by_emotion ?? stats?.emotion_distribution);
    if (entries.length <= MAX_EMOTIONS + 1) return entries;
    const rest = entries.slice(MAX_EMOTIONS).reduce((sum, e) => sum + e.value, 0);
    return [...entries.slice(0, MAX_EMOTIONS), { name: 'other', value: rest }];
  }, [stats]);

  const rangeLabel = RANGES.find((r) => r.value === daysRange)?.label ?? `${daysRange} days`;
  const rangeControl = (
    <SegmentedControl label="Time period" options={RANGES} value={daysRange} onChange={setDaysRange} />
  );

  if (!stats) {
    return (
      <div>
        <PageHeader
          title="Statistics"
          description="Compliance performance and conversation trends across analyzed calls."
          actions={rangeControl}
        />
        {loading ? (
          <div className="space-y-6" aria-busy="true">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="card">
                  <div className="skeleton h-3.5 w-24" />
                  <div className="skeleton mt-3 h-7 w-16" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="card h-80 lg:col-span-2">
                <div className="skeleton h-full w-full" />
              </div>
              <div className="card h-80">
                <div className="skeleton h-full w-full" />
              </div>
            </div>
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={BarChart3}
              title="Statistics are unavailable"
              description="The analytics service didn't respond. Check that the API is running."
              action={
                <button onClick={loadStatistics} className="btn btn-secondary">
                  <RefreshCw />
                  Try again
                </button>
              }
            />
          </Card>
        )}
      </div>
    );
  }

  const total = stats.total_analyses || 0;
  const polarityOrder: Polarity[] = ['negative', 'neutral', 'positive'];
  const splitTotal = sentimentSplit ? polarityOrder.reduce((sum, p) => sum + sentimentSplit[p], 0) : 0;

  return (
    <div>
      <PageHeader
        title="Statistics"
        description="Compliance performance and conversation trends across analyzed calls."
        actions={rangeControl}
      />

      {/* Refetches keep the previous frame, dimmed, instead of flashing a loader. */}
      <div className={clsx('space-y-6 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Analyses" value={formatNumber(total)} hint={`Last ${rangeLabel}`} />
          <StatCard
            label="Average compliance"
            value={formatScore(stats.average_compliance)}
            hint={
              <Badge tone={complianceTone(stats.average_compliance)} dot>
                {complianceLabel(stats.average_compliance)}
              </Badge>
            }
          />
          <StatCard label="Lowest score" value={formatScore(stats.min_compliance)} hint="Single lowest call" />
          <StatCard label="Highest score" value={formatScore(stats.max_compliance)} hint="Single highest call" />
        </div>

        {total === 0 && trendsData.length === 0 ? (
          <Card>
            <EmptyState
              icon={BarChart3}
              title="No analyses in this period"
              description="Try a longer time period, or analyze a call to start building trends."
            />
          </Card>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader
                  title="Compliance trend"
                  description="Daily average score, with the lowest-to-highest range for each day."
                  actions={
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                      <span className="flex items-center gap-1.5">
                        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: t.series[0] }} aria-hidden="true" />
                        Daily average
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-3 rounded-sm" style={{ backgroundColor: t.series[0], opacity: 0.2 }} aria-hidden="true" />
                        Daily range
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 border-t border-dashed" style={{ borderColor: t.tick }} aria-hidden="true" />
                        Review threshold (70)
                      </span>
                    </div>
                  }
                />
                <CardBody>
                  {trendsData.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={trendsData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                          <CartesianGrid {...t.grid} />
                          <XAxis dataKey="label" minTickGap={24} {...t.axis} />
                          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={40} {...t.axis} />
                          <ReferenceLine y={70} stroke={t.tick} strokeOpacity={0.6} strokeDasharray="4 4" />
                          <Tooltip content={<ChartTooltip valueFormatter={(v) => v.toFixed(1)} />} cursor={t.cursor} />
                          <Area
                            type="monotone"
                            dataKey="range"
                            name="Daily range"
                            stroke="none"
                            fill={t.series[0]}
                            fillOpacity={0.12}
                            activeDot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="average"
                            name="Daily average"
                            stroke={t.series[0]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="py-16 text-center text-sm text-fg-subtle">No daily data for this period.</p>
                  )}
                </CardBody>
                {trendsData.length > 0 && (
                  <TableView>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th className="text-right">Average</th>
                          <th className="text-right">Lowest</th>
                          <th className="text-right">Highest</th>
                          <th className="text-right">Analyses</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trendsData.map((row: any) => (
                          <tr key={row.date}>
                            <td className="text-fg-muted">{row.label}</td>
                            <td className="text-right tabular-nums">{formatScore(row.average)}</td>
                            <td className="text-right tabular-nums">{formatScore(row.min)}</td>
                            <td className="text-right tabular-nums">{formatScore(row.max)}</td>
                            <td className="text-right tabular-nums">{formatNumber(row.count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableView>
                )}
              </Card>

              <Card className="self-start">
                <CardHeader title="Sentiment" description="How customers sounded across all calls." />
                <CardBody>
                  {sentimentSplit && splitTotal > 0 ? (
                    <>
                      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Sentiment split">
                        {polarityOrder.map((p) =>
                          sentimentSplit[p] > 0 ? (
                            <div
                              key={p}
                              style={{ width: `${(sentimentSplit[p] / splitTotal) * 100}%`, backgroundColor: t.polarity[p] }}
                            />
                          ) : null,
                        )}
                      </div>
                      <ul className="mt-5 space-y-2.5">
                        {[...polarityOrder].reverse().map((p) => (
                          <li key={p} className="flex items-center justify-between gap-3 text-[13px]">
                            <span className="flex items-center gap-2 text-fg-muted">
                              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.polarity[p] }} aria-hidden="true" />
                              {humanize(p)}
                            </span>
                            <span className="tabular-nums">
                              <span className="font-medium text-fg">{formatNumber(sentimentSplit[p])}</span>
                              <span className="ml-1.5 text-fg-subtle">{Math.round((sentimentSplit[p] / splitTotal) * 100)}%</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : sentimentEntries.length > 0 ? (
                    <RankedBars data={sentimentEntries} color={t.series[0]} />
                  ) : (
                    <p className="py-10 text-center text-sm text-fg-subtle">No sentiment data yet.</p>
                  )}
                </CardBody>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader title="Daily volume" description="Number of calls analyzed each day." />
                <CardBody>
                  {trendsData.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendsData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                          <CartesianGrid {...t.grid} />
                          <XAxis dataKey="label" minTickGap={24} {...t.axis} />
                          <YAxis allowDecimals={false} width={40} {...t.axis} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: t.colors.grid, fillOpacity: 0.6 }} />
                          <Bar dataKey="count" name="Analyses" fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="py-16 text-center text-sm text-fg-subtle">No daily data for this period.</p>
                  )}
                </CardBody>
              </Card>

              <Card className="self-start">
                <CardHeader title="Emotions" description="Dominant emotion detected per call." />
                <CardBody>
                  {emotionData.length > 0 ? (
                    <RankedBars data={emotionData} color={t.series[0]} />
                  ) : (
                    <p className="py-10 text-center text-sm text-fg-subtle">No emotion data yet.</p>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
