import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import clsx from 'clsx';
import { FileAudio, UploadCloud, X } from 'lucide-react';
import { apiService } from '../services/api';
import { formatPercent, formatScore, humanize } from '../utils/format';
import { complianceLabel, complianceTone, sentimentLabel, sentimentTone } from '../utils/status';
import { Badge, Card, CardBody, CardFooter, CardHeader, IconButton, PageHeader, Spinner, useToast } from '../components/ui';

interface BatchResult {
  filename: string;
  analysis?: any;
  error?: string;
}

const toMegabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
const pluralFiles = (count: number) => `${count} ${count === 1 ? 'file' : 'files'}`;

export default function BatchPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const toast = useToast();

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.wav', '.mp3', '.m4a'],
    },
    onDrop: (acceptedFiles) => {
      setFiles((prev) => [...prev, ...acceptedFiles]);
    },
    onDropRejected: (rejections) => {
      toast.warning(`${pluralFiles(rejections.length)} skipped`, 'Only WAV, MP3 and M4A files can be added.');
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setResults([]);

    try {
      const result = await apiService.batchAnalyze(files);

      // Map results
      const mappedResults: BatchResult[] = files.map((file) => {
        const fileResult = result.results?.find((r: any) => r.filename === file.name);
        const error = result.errors?.find((e: any) => e.filename === file.name);

        return {
          filename: file.name,
          analysis: fileResult?.analysis,
          error: error?.error || (fileResult ? undefined : 'Processing failed'),
        };
      });

      setResults(mappedResults);

      const succeededCount = mappedResults.filter((r) => r.analysis && !r.error).length;
      const failedCount = mappedResults.filter((r) => r.error).length;
      if (failedCount > 0) {
        toast.warning('Batch finished with errors', `${succeededCount} analyzed, ${failedCount} failed.`);
      } else {
        toast.success('Batch complete', `${pluralFiles(succeededCount)} analyzed.`);
      }
    } catch (error: any) {
      console.error('Batch processing error:', error);
      const detail = error.response?.data?.detail;
      const message: string = (typeof detail === 'string' && detail) || error.message || 'Processing failed';
      setResults(
        files.map((file) => ({
          filename: file.name,
          error: message,
        }))
      );
      toast.error('Batch failed', message);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setFiles([]);
    setResults([]);
  };

  const successful = results.filter((r) => r.analysis && !r.error).length;
  const failed = results.filter((r) => r.error).length;
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <div>
      <PageHeader
        title="Batch processing"
        description="Analyze many recordings in one run and review the results together."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Upload recordings"
            description="Add up to 50 files per batch. Each one is transcribed, scored and saved to history."
          />
          <CardBody className="space-y-4">
            <div
              {...getRootProps({
                className: clsx(
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center outline-none transition-colors duration-150',
                  'focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/15',
                  isDragActive
                    ? 'border-accent bg-accent-subtle/40'
                    : 'border-line-strong bg-surface-subtle/40 hover:border-accent hover:bg-accent-subtle/40',
                ),
              })}
            >
              <input {...getInputProps()} />
              <span
                className={clsx(
                  'grid h-10 w-10 place-items-center rounded-lg border border-line bg-surface shadow-xs',
                  isDragActive ? 'text-accent-fg' : 'text-fg-subtle',
                )}
              >
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-sm font-medium text-fg">
                {isDragActive ? (
                  'Release to add the files'
                ) : (
                  <>
                    Drop audio files or <span className="text-accent-fg">browse</span>
                  </>
                )}
              </p>
              <p className="mt-1 text-xs text-fg-subtle">WAV, MP3 or M4A</p>
            </div>

            {files.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-subtle px-4 py-1.5">
                  <p className="text-xs font-medium text-fg-subtle">
                    <span className="tabular-nums">{pluralFiles(files.length)}</span> selected
                    <span className="mx-1.5 text-fg-faint" aria-hidden="true">·</span>
                    <span className="tabular-nums">{toMegabytes(totalBytes)} MB</span>
                  </p>
                  <button type="button" onClick={clearAll} className="btn btn-ghost btn-sm -mr-2">
                    Clear all
                  </button>
                </div>
                <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-subtle text-fg-subtle">
                        <FileAudio className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs tabular-nums text-fg-subtle">{toMegabytes(file.size)} MB</p>
                      </div>
                      <IconButton icon={X} label={`Remove ${file.name}`} onClick={() => removeFile(index)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>

          {files.length > 0 && (
            <CardFooter className="flex-col items-stretch sm:flex-row sm:items-center">
              <p role="status" className="text-[13px] text-fg-subtle">
                {isProcessing
                  ? 'Transcribing and scoring. Large batches can take several minutes.'
                  : 'Successful analyses are saved to history.'}
              </p>
              <button type="button" onClick={handleProcess} disabled={isProcessing} className="btn btn-primary">
                {isProcessing && <Spinner />}
                {isProcessing ? `Analyzing ${pluralFiles(files.length)}…` : `Analyze ${pluralFiles(files.length)}`}
              </button>
            </CardFooter>
          )}
        </Card>

        {results.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader
              title="Results"
              description={`${pluralFiles(results.length)} processed in this batch.`}
              actions={
                <>
                  <Badge tone={successful > 0 ? 'success' : 'neutral'} dot>
                    <span className="tabular-nums">{successful}</span> succeeded
                  </Badge>
                  <Badge tone={failed > 0 ? 'danger' : 'neutral'} dot>
                    <span className="tabular-nums">{failed}</span> failed
                  </Badge>
                </>
              }
            />
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Status</th>
                    <th>Compliance</th>
                    <th>Sentiment</th>
                    <th>Emotion</th>
                    <th className="text-right">Toxicity</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => {
                    const score = result.analysis?.compliance_score;
                    const sentiment = result.analysis?.sentiment;
                    const emotion = result.analysis?.emotion;
                    return (
                      <tr key={`${result.filename}-${index}`}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface-subtle text-fg-subtle">
                              <FileAudio className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <p className="max-w-[18rem] truncate font-medium text-fg" title={result.filename}>
                              {result.filename}
                            </p>
                          </div>
                        </td>
                        <td>
                          {result.error ? (
                            <Badge tone="danger" dot>
                              Failed
                            </Badge>
                          ) : result.analysis ? (
                            <Badge tone="success" dot>
                              Analyzed
                            </Badge>
                          ) : (
                            <Badge tone="neutral" dot>
                              No result
                            </Badge>
                          )}
                        </td>
                        {result.error ? (
                          <td colSpan={4} className="min-w-[16rem] text-[13px] text-fg-muted">
                            {result.error}
                          </td>
                        ) : (
                          <>
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
                            <td className="text-fg-muted">
                              {emotion ? humanize(emotion) : <span className="text-fg-faint">—</span>}
                            </td>
                            <td className="text-right tabular-nums text-fg-muted">
                              {formatPercent(result.analysis?.toxicity_score)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
