import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, FileAudio, FileText, History, Mic, Search, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import type { HistoryRecord } from '../services/api';
import { formatDateTime, formatDuration, formatScore } from '../utils/format';
import { complianceLabel, complianceTone, sentimentLabel, sentimentTone } from '../utils/status';
import { Badge, Card, EmptyState, IconButton, Modal, PageHeader, useConfirm, useToast } from '../components/ui';
import { PrivacyNote, RedactedText } from '../components/RedactedText';

const DEFAULT_DAYS = 30;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState<number | ''>('');
  const [daysBack, setDaysBack] = useState(DEFAULT_DAYS);
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const toast = useToast();
  const confirm = useConfirm();

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
      toast.error('Could not load history', 'Check that the API is running and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (record: HistoryRecord) => {
    const confirmed = await confirm({
      title: 'Delete this analysis?',
      description: `"${record.filename}" and its results will be permanently removed.`,
      confirmLabel: 'Delete analysis',
    });
    if (!confirmed) return;

    try {
      await apiService.deleteRecord(record.id);
      if (selectedRecord?.id === record.id) setSelectedRecord(null);
      toast.success('Analysis deleted');
      loadHistory();
    } catch (error) {
      console.error('Failed to delete record:', error);
      toast.error('Failed to delete record');
    }
  };

  const handleExportJSON = async (record: HistoryRecord) => {
    try {
      const data = await apiService.exportJSON(record.id);
      downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `analysis_${record.id}.json`);
    } catch (error) {
      console.error('Failed to export JSON:', error);
      toast.error('JSON export failed');
    }
  };

  const handleExportPDF = async (record: HistoryRecord) => {
    try {
      const data = await apiService.getRecord(record.id);
      const blob = await apiService.generateReport(data);
      downloadBlob(blob, `report_${record.id}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      toast.error('PDF export failed');
    }
  };

  const handleExportCSV = async () => {
    try {
      const blob = await apiService.exportCSV({
        min_score: minScore !== '' ? minScore : undefined,
        max_score: maxScore !== '' ? maxScore : undefined,
        days_back: daysBack,
      });
      downloadBlob(blob, 'analyses_export.csv');
    } catch (error) {
      console.error('Failed to export CSV:', error);
      toast.error('CSV export failed');
    }
  };

  const filteredRecords = searchTerm
    ? records.filter((r) =>
        r.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.transcription.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : records;

  const hasFilters = searchTerm !== '' || minScore !== '' || maxScore !== '' || daysBack !== DEFAULT_DAYS;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const firstShown = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastShown = Math.min(page * limit, total);

  const clearFilters = () => {
    setSearchTerm('');
    setMinScore('');
    setMaxScore('');
    setDaysBack(DEFAULT_DAYS);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="History"
        description="Every analyzed call, with its compliance score and sentiment."
        actions={
          <button onClick={handleExportCSV} className="btn btn-secondary">
            <Download />
            Export CSV
          </button>
        }
      />

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" aria-hidden="true" />
            <input
              type="search"
              placeholder="Search file name or transcript"
              aria-label="Search analyses"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
              className="input pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              placeholder="Min score"
              aria-label="Minimum compliance score"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value ? Number(e.target.value) : '')}
              className="input w-28"
              min="0"
              max="100"
            />
            <span className="text-fg-faint" aria-hidden="true">–</span>
            <input
              type="number"
              placeholder="Max score"
              aria-label="Maximum compliance score"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value ? Number(e.target.value) : '')}
              className="input w-28"
              min="0"
              max="100"
            />
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              aria-label="Time period"
              className="input w-40"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last year</option>
            </select>
            <button onClick={loadHistory} className="btn btn-secondary">
              Apply
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="btn btn-ghost">
                Clear
              </button>
            )}
          </div>
        </div>

        {!loading && filteredRecords.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No matching analyses"
              description="Try a different search term, score range or time period."
              action={
                <button onClick={clearFilters} className="btn btn-secondary">
                  Clear filters
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={History}
              title="No analyses yet"
              description="Analyzed calls appear here with their scores, sentiment and exports."
              action={
                <Link to="/" className="btn btn-primary">
                  <Mic />
                  New analysis
                </Link>
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table data-table-hover">
                <thead>
                  <tr>
                    <th>Recording</th>
                    <th>Analyzed</th>
                    <th>Compliance</th>
                    <th>Sentiment</th>
                    <th className="text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 5 }, (_, i) => (
                        <tr key={i}>
                          <td>
                            <div className="skeleton h-4 w-48" />
                            <div className="skeleton mt-2 h-3 w-16" />
                          </td>
                          <td><div className="skeleton h-4 w-32" /></td>
                          <td><div className="skeleton h-5 w-28" /></td>
                          <td><div className="skeleton h-5 w-16" /></td>
                          <td />
                        </tr>
                      ))
                    : filteredRecords.map((record) => {
                        const score = record.analysis?.compliance_score;
                        const sentiment = record.analysis?.sentiment;
                        return (
                          <tr key={record.id} className="cursor-pointer" onClick={() => setSelectedRecord(record)}>
                            <td>
                              <div className="flex items-center gap-3">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-subtle text-fg-subtle">
                                  <FileAudio className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-fg">{record.filename}</p>
                                  <p className="text-xs tabular-nums text-fg-subtle">
                                    ID {record.id}
                                    {record.file_duration ? ` · ${formatDuration(record.file_duration)}` : ''}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap tabular-nums text-fg-muted">{formatDateTime(record.created_at)}</td>
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
                            <td>
                              <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                                <IconButton icon={Eye} label="View details" onClick={() => setSelectedRecord(record)} />
                                <IconButton icon={FileText} label="Export PDF" onClick={() => handleExportPDF(record)} />
                                <IconButton icon={Download} label="Export JSON" onClick={() => handleExportJSON(record)} />
                                <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => handleDelete(record)} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
              <p className="text-[13px] tabular-nums text-fg-subtle">
                {loading ? 'Loading…' : `Showing ${firstShown}–${lastShown} of ${total}`}
              </p>
              {total > limit && (
                <div className="flex items-center gap-2">
                  <span className="mr-1 hidden text-[13px] tabular-nums text-fg-subtle sm:inline">
                    Page {page} of {pageCount}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn btn-secondary btn-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    disabled={page >= pageCount}
                    className="btn btn-secondary btn-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <Modal
        open={selectedRecord !== null}
        onClose={() => setSelectedRecord(null)}
        size="lg"
        title={selectedRecord?.filename}
        description={selectedRecord ? `Analyzed ${formatDateTime(selectedRecord.created_at)}` : undefined}
        footer={
          selectedRecord && (
            <>
              <button onClick={() => handleExportJSON(selectedRecord)} className="btn btn-secondary">
                <Download />
                Export JSON
              </button>
              <button onClick={() => handleExportPDF(selectedRecord)} className="btn btn-primary">
                <FileText />
                Export PDF
              </button>
            </>
          )
        }
      >
        {selectedRecord && (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="kpi-label">Record ID</dt>
                <dd className="mt-1 font-medium tabular-nums text-fg">{selectedRecord.id}</dd>
              </div>
              <div>
                <dt className="kpi-label">Compliance</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className="font-medium tabular-nums text-fg">
                    {formatScore(selectedRecord.analysis?.compliance_score)}
                  </span>
                  <Badge tone={complianceTone(selectedRecord.analysis?.compliance_score)} dot>
                    {complianceLabel(selectedRecord.analysis?.compliance_score)}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="kpi-label">Sentiment</dt>
                <dd className="mt-1">
                  {selectedRecord.analysis?.sentiment ? (
                    <Badge tone={sentimentTone(selectedRecord.analysis.sentiment)}>
                      {sentimentLabel(selectedRecord.analysis.sentiment)}
                    </Badge>
                  ) : (
                    <span className="text-fg-faint">—</span>
                  )}
                </dd>
              </div>
            </dl>
            <div>
              <h3 className="section-title mb-2">Transcript</h3>
              {selectedRecord.analysis?.pii && (
                <div className="mb-3">
                  <PrivacyNote privacy={selectedRecord.analysis.pii} />
                </div>
              )}
              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-subtle p-4 text-sm leading-6 text-fg-muted">
                {selectedRecord.transcription ? <RedactedText text={selectedRecord.transcription} /> : 'No transcript available.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
