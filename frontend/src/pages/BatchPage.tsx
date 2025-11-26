import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileAudio, Loader2, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';

interface BatchResult {
  filename: string;
  analysis?: any;
  error?: string;
}

export default function BatchPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [progress, setProgress] = useState(0);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.wav', '.mp3', '.m4a'],
    },
    onDrop: (acceptedFiles) => {
      setFiles((prev) => [...prev, ...acceptedFiles]);
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      const result = await apiService.batchAnalyze(files);

      // Map results
      const mappedResults: BatchResult[] = files.map((file, index) => {
        const fileResult = result.results?.find((r: any) => r.filename === file.name);
        const error = result.errors?.find((e: any) => e.filename === file.name);

        return {
          filename: file.name,
          analysis: fileResult?.analysis,
          error: error?.error || fileResult ? undefined : 'Processing failed',
        };
      });

      setResults(mappedResults);
      setProgress(100);
    } catch (error: any) {
      console.error('Batch processing error:', error);
      setResults(
        files.map((file) => ({
          filename: file.name,
          error: error.response?.data?.detail || error.message || 'Processing failed',
        }))
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const clearAll = () => {
    setFiles([]);
    setResults([]);
    setProgress(0);
  };

  const successful = results.filter((r) => r.analysis && !r.error).length;
  const failed = results.filter((r) => r.error).length;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📦 Batch Processing</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload and analyze multiple audio files at once for efficient bulk processing.
        </p>
      </div>

      {/* Upload Area */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-4 dark:text-white">Upload Multiple Files</h2>

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4
            ${isDragActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
            }
          `}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
          {isDragActive ? (
            <p className="text-primary-600 dark:text-primary-400">Drop the audio files here...</p>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Drag and drop multiple audio files here, or click to select
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">Supports WAV, MP3, M4A</p>
            </>
          )}
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {files.length} file(s) selected
              </p>
              <button
                onClick={clearAll}
                className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                Clear All
              </button>
            </div>
            {files.map((file, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between"
              >
                <div className="flex items-center flex-1">
                  <FileAudio className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Process Button */}
        {files.length > 0 && !isProcessing && (
          <button
            onClick={handleProcess}
            className="btn btn-primary w-full mt-4"
          >
            <Upload className="mr-2 h-5 w-5" />
            Process All Files ({files.length})
          </button>
        )}

        {/* Progress */}
        {isProcessing && (
          <div className="mt-4">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Processing...
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      {results.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Processing Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Files</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{results.length}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-sm text-green-600 dark:text-green-400 mb-1">Successful</p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">{successful}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400 mb-1">Failed</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">{failed}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results Detail */}
      {results.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 dark:text-white">Detailed Results</h2>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  result.error
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      {result.error ? (
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                      )}
                      <p className="font-medium text-gray-900 dark:text-white">{result.filename}</p>
                    </div>
                    {result.error ? (
                      <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
                    ) : result.analysis ? (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Compliance</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {result.analysis.compliance_score?.toFixed(2) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Sentiment</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {result.analysis.sentiment || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Emotion</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {result.analysis.emotion || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Toxicity</p>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {((result.analysis.toxicity_score || 0) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
