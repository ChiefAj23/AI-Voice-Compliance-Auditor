import { useState, useEffect } from 'react';
import { GitCompare, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';
import { apiService, HistoryRecord } from '../services/api';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ComparePage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const data = await apiService.getHistory({ limit: 100 });
      setRecords(data.records);
    } catch (error) {
      console.error('Failed to load records:', error);
    }
  };

  const toggleSelection = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      if (selectedIds.length < 10) {
        setSelectedIds([...selectedIds, id]);
      } else {
        alert('Maximum 10 records can be compared at once');
      }
    }
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      alert('Please select at least 2 records to compare');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.compareAnalyses(selectedIds);
      setComparison(result);
    } catch (error) {
      console.error('Failed to compare:', error);
      alert('Failed to compare analyses');
    } finally {
      setLoading(false);
    }
  };

  const comparisonData = comparison?.records?.map((r: any) => ({
    name: r.filename || `Record ${r.id}`,
    compliance: r.analysis?.compliance_score || 0,
    toxicity: (r.analysis?.toxicity_score || 0) * 100,
  })) || [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">⚖️ Compare Analyses</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Compare two or more audio analyses side-by-side to identify patterns and trends.
        </p>
      </div>

      {/* Record Selection */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Select Records to Compare</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select 2-10 records to compare. Currently selected: {selectedIds.length}
        </p>

        {records.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No records available. Analyze some audio files first.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
            {records.map((record) => {
              const isSelected = selectedIds.includes(record.id);
              return (
                <div
                  key={record.id}
                  onClick={() => toggleSelection(record.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">
                        {record.filename}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {format(new Date(record.created_at), 'MMM dd, yyyy HH:mm')}
                      </p>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          Compliance: <span className="font-semibold dark:text-white">
                            {(record.analysis?.compliance_score || 0).toFixed(2)}
                          </span>
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {record.analysis?.sentiment || 'N/A'}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedIds.length >= 2 && (
          <button
            onClick={handleCompare}
            disabled={loading || selectedIds.length < 2}
            className="btn btn-primary mt-6 w-full disabled:opacity-50"
          >
            <GitCompare className="mr-2 h-5 w-5" />
            {loading ? 'Comparing...' : `Compare ${selectedIds.length} Records`}
          </button>
        )}
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">📊 Comparison Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Records Compared</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {comparison.summary?.count || 0}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Avg Compliance</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {comparison.metrics?.compliance?.average?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Range</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {comparison.metrics?.compliance?.range?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className={`rounded-lg p-4 ${
                (comparison.metrics?.compliance?.improvement || 0) >= 0
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-red-50 dark:bg-red-900/20'
              }`}>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Improvement</p>
                <div className="flex items-center">
                  {(comparison.metrics?.compliance?.improvement || 0) >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                  )}
                  <p className={`text-2xl font-bold ${
                    (comparison.metrics?.compliance?.improvement || 0) >= 0
                      ? 'text-green-700 dark:text-green-300'
                      : 'text-red-700 dark:text-red-300'
                  }`}>
                    {comparison.metrics?.compliance?.improvement?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Chart */}
          {comparisonData.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4 dark:text-white">📈 Compliance Score Comparison</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#6b7280" angle={-45} textAnchor="end" height={100} />
                  <YAxis stroke="#6b7280" domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="compliance" fill="#3b82f6" name="Compliance Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed Comparison Table */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">📋 Detailed Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Record</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Compliance</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Toxicity</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Sentiment</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Emotion</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.records?.map((record: any, index: number) => (
                    <tr
                      key={index}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-white">
                        {record.filename || `Record ${record.id}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-sm font-medium ${
                          (record.analysis?.compliance_score || 0) >= 75
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                            : (record.analysis?.compliance_score || 0) >= 50
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                        }`}>
                          {(record.analysis?.compliance_score || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {((record.analysis?.toxicity_score || 0) * 100).toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {record.analysis?.sentiment || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {record.analysis?.emotion || 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
