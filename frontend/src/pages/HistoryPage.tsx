import { useState, useEffect } from 'react';
import { Search, Filter, Download, Trash2, Eye, FileText } from 'lucide-react';
import { apiService, HistoryRecord } from '../services/api';
import { format } from 'date-fns';

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState<number | ''>('');
  const [daysBack, setDaysBack] = useState(30);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;

  useEffect(() => {
    loadHistory();
  }, [page, minScore, maxScore, daysBack]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const params: any = {
        limit,
        offset: (page - 1) * limit,
      };
      if (minScore !== '') params.min_score = minScore;
      if (maxScore !== '') params.max_score = maxScore;
      if (daysBack) params.days_back = daysBack;
      if (searchTerm) params.search = searchTerm;

      const data = await apiService.getHistory(params);
      setRecords(data.records);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
      await apiService.deleteRecord(id);
      loadHistory();
    } catch (error) {
      console.error('Failed to delete record:', error);
      alert('Failed to delete record');
    }
  };

  const handleExportJSON = async (record: HistoryRecord) => {
    try {
      const data = await apiService.exportJSON(record.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis_${record.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export JSON:', error);
    }
  };

  const handleExportPDF = async (record: HistoryRecord) => {
    try {
      const data = await apiService.getRecord(record.id);
      const blob = await apiService.generateReport(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${record.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export PDF:', error);
    }
  };

  const filteredRecords = searchTerm
    ? records.filter((r) =>
        r.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.transcription.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : records;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📜 Analysis History</h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage your audio analysis history.
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold dark:text-white">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="label dark:text-gray-300">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by filename..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && loadHistory()}
                className="input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="label dark:text-gray-300">Min Score</label>
            <input
              type="number"
              placeholder="0"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : '')}
              className="input"
              min="0"
              max="100"
            />
          </div>

          <div>
            <label className="label dark:text-gray-300">Max Score</label>
            <input
              type="number"
              placeholder="100"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value ? Number(e.target.value) : '')}
              className="input"
              min="0"
              max="100"
            />
          </div>

          <div>
            <label className="label dark:text-gray-300">Days Back</label>
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="input"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
          </div>
        </div>

        <button
          onClick={loadHistory}
          className="btn btn-primary mt-4"
        >
          Apply Filters
        </button>
      </div>

      {/* Records Table */}
      <div className="card">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold dark:text-white">
            Records ({total})
          </h2>
          <button
            onClick={async () => {
              try {
                const blob = await apiService.exportCSV({
                  min_score: minScore !== '' ? minScore : undefined,
                  max_score: maxScore !== '' ? maxScore : undefined,
                  days_back: daysBack,
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'analyses_export.csv';
                a.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                console.error('Failed to export CSV:', error);
              }
            }}
            className="btn btn-secondary flex items-center"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No records found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Filename</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Compliance</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Sentiment</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => setSelectedRecord(record)}
                    >
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{record.id}</td>
                      <td className="py-3 px-4 text-gray-900 dark:text-white">{record.filename}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                        {format(new Date(record.created_at), 'MMM dd, yyyy HH:mm')}
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
                        {record.analysis?.sentiment || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecord(record);
                            }}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportPDF(record);
                            }}
                            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="Export PDF"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportJSON(record);
                            }}
                            className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                            title="Export JSON"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(record.id);
                            }}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > limit && (
              <div className="mt-4 flex justify-between items-center">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {Math.ceil(total / limit)}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                  disabled={page >= Math.ceil(total / limit)}
                  className="btn btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Record Details Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold dark:text-white">Record Details</h2>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Filename</p>
                  <p className="font-medium dark:text-white">{selectedRecord.filename}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Date</p>
                  <p className="font-medium dark:text-white">
                    {format(new Date(selectedRecord.created_at), 'PPpp')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Compliance Score</p>
                  <p className="font-medium dark:text-white">
                    {selectedRecord.analysis?.compliance_score?.toFixed(2) || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Sentiment</p>
                  <p className="font-medium dark:text-white">
                    {selectedRecord.analysis?.sentiment || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Transcript</p>
                  <p className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg whitespace-pre-wrap dark:text-white">
                    {selectedRecord.transcription}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
