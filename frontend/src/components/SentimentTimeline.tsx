import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SentimentTimelineProps {
  timeline: any;
}

export default function SentimentTimeline({ timeline }: SentimentTimelineProps) {
  const timelineData = timeline.timeline || [];
  const overallMetrics = timeline.overall_metrics || {};

  const chartData = timelineData.map((seg: any) => ({
    time: seg.start_time,
    compliance: seg.compliance_score,
    sentiment: seg.sentiment?.score || 0,
    segment: seg.segment_id,
  }));

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-6 dark:text-white">📈 Sentiment Timeline</h2>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Segments</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {overallMetrics.total_segments || 0}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Sentiment</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {(overallMetrics.average_sentiment_score || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Trend</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
            {overallMetrics.sentiment_trend || 'stable'}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Compliance Range</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {overallMetrics.compliance_range?.min?.toFixed(0) || 0}-
            {overallMetrics.compliance_range?.max?.toFixed(0) || 100}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-6">
        {/* Compliance Score Over Time */}
        <div>
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Compliance Score Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="time"
                label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }}
                stroke="#6b7280"
              />
              <YAxis
                label={{ value: 'Compliance Score', angle: -90, position: 'insideLeft' }}
                domain={[0, 100]}
                stroke="#6b7280"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="compliance"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="#3b82f6"
                fillOpacity={0.1}
                name="Compliance Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment Score Over Time */}
        <div>
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Sentiment Score Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="time"
                label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }}
                stroke="#6b7280"
              />
              <YAxis
                label={{ value: 'Sentiment Score', angle: -90, position: 'insideLeft' }}
                domain={[-1, 1]}
                stroke="#6b7280"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sentiment"
                stroke="#10b981"
                strokeWidth={2}
                fill="#10b981"
                fillOpacity={0.1}
                name="Sentiment Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

