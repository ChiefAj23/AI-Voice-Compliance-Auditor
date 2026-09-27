import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartTooltip from './charts/ChartTooltip';
import { useChartTheme } from '../utils/chart';
import { formatDuration, humanize } from '../utils/format';
import { Card, CardBody, CardHeader } from './ui';

interface SentimentTimelineProps {
  timeline: any;
}

export default function SentimentTimeline({ timeline }: SentimentTimelineProps) {
  const t = useChartTheme();
  const timelineData = timeline.timeline || [];
  const overallMetrics = timeline.overall_metrics || {};

  const chartData = timelineData.map((seg: any) => ({
    time: seg.start_time,
    compliance: seg.compliance_score,
    sentiment: seg.sentiment?.score || 0,
    segment: seg.segment_id,
  }));

  const metrics = [
    { label: 'Segments', value: overallMetrics.total_segments || 0 },
    { label: 'Average sentiment', value: (overallMetrics.average_sentiment_score || 0).toFixed(2) },
    { label: 'Trend', value: humanize(overallMetrics.sentiment_trend || 'stable') },
    {
      label: 'Compliance range',
      value: `${overallMetrics.compliance_range?.min?.toFixed(0) || 0}–${overallMetrics.compliance_range?.max?.toFixed(0) || 100}`,
    },
  ];

  const timeAxis = {
    dataKey: 'time',
    type: 'number' as const,
    domain: ['dataMin', 'dataMax'] as [string, string],
    tickFormatter: (value: number) => formatDuration(value),
    ...t.axis,
  };
  const labelFormatter = (value: string | number) => `At ${formatDuration(Number(value))}`;

  return (
    <Card>
      <CardHeader
        title="Sentiment and compliance over the call"
        description="Scores for each transcript segment, plotted against call time."
      />
      <CardBody className="space-y-8">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg bg-surface-subtle px-4 py-3">
              <dt className="kpi-label">{metric.label}</dt>
              <dd className="mt-1 text-lg font-semibold text-fg">{metric.value}</dd>
            </div>
          ))}
        </dl>

        <div>
          <h3 className="section-title">Compliance score</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid {...t.grid} />
                <XAxis {...timeAxis} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={40} {...t.axis} />
                <ReferenceLine
                  y={70}
                  stroke={t.colors.axis}
                  strokeDasharray="4 4"
                  label={{ value: 'Review threshold', position: 'insideBottomRight', fill: t.tick, fontSize: 11 }}
                />
                <Tooltip
                  content={<ChartTooltip labelFormatter={labelFormatter} valueFormatter={(v) => v.toFixed(1)} />}
                  cursor={t.cursor}
                />
                <Area
                  type="monotone"
                  dataKey="compliance"
                  name="Compliance"
                  stroke={t.series[0]}
                  strokeWidth={2}
                  fill={t.series[0]}
                  fillOpacity={0.1}
                  activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="section-title">Sentiment score</h3>
          <p className="mt-0.5 text-xs text-fg-subtle">From −1 (negative) to 1 (positive).</p>
          <div className="mt-3 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <CartesianGrid {...t.grid} />
                <XAxis {...timeAxis} />
                <YAxis domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]} width={40} {...t.axis} />
                <ReferenceLine y={0} stroke={t.colors.axis} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={labelFormatter} valueFormatter={(v) => v.toFixed(2)} />}
                  cursor={t.cursor}
                />
                <Line
                  type="monotone"
                  dataKey="sentiment"
                  name="Sentiment"
                  stroke={t.series[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
