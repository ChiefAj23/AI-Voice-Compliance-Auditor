import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiService } from '../services/api';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function StatisticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [daysRange, setDaysRange] = useState(30);

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
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No statistics available.</p>
        </div>
      </div>
    );
  }

  const sentimentData = Object.entries(stats.sentiment_distribution || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const emotionData = Object.entries(stats.emotion_distribution || {}).map(([name, value]) => ({
    name,
    value,
  }));

  const trendsData = (stats.trends || []).map((t: any) => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    average: t.average_compliance,
    min: t.min_compliance,
    max: t.max_compliance,
    count: t.count,
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📈 Statistics & Trends</h1>
          <p className="text-gray-600 dark:text-gray-400">
            View analytics and trends over time.
          </p>
        </div>
        <select
          value={daysRange}
          onChange={(e) => setDaysRange(Number(e.target.value))}
          className="input w-48"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Analyses</p>
            <BarChart3 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.total_analyses || 0}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Compliance</p>
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.average_compliance?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Min Compliance</p>
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.min_compliance?.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Max Compliance</p>
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.max_compliance?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Sentiment Distribution */}
        {sentimentData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Sentiment Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Emotion Distribution */}
        {emotionData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 dark:text-white">Emotion Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={emotionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {emotionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Compliance Trends */}
      {trendsData.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Compliance Score Trends</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" domain={[0, 100]} />
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
                dataKey="average"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Average Compliance"
              />
              <Line
                type="monotone"
                dataKey="min"
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Min Compliance"
              />
              <Line
                type="monotone"
                dataKey="max"
                stroke="#10b981"
                strokeWidth={1}
                strokeDasharray="5 5"
                name="Max Compliance"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Count */}
      {trendsData.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 dark:text-white">Daily Analysis Count</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" name="Analyses per Day" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
