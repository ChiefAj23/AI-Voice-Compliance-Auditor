import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Mic, FileAudio, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiService, AnalysisResult } from '../services/api';
import AnalysisResults from '../components/AnalysisResults';

// Store audio file for playback
let currentAudioFile: File | null = null;

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioFileForPlayback, setAudioFileForPlayback] = useState<File | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'audio/*': ['.wav', '.mp3', '.m4a'],
    },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
        setAudioFileForPlayback(acceptedFiles[0]);
        setError(null);
        setAnalysisResult(null);
      }
    },
    multiple: false,
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const file = new File([blob], 'recording.wav', { type: 'audio/wav' });
        setSelectedFile(file);
        setAudioFileForPlayback(file);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setError('Failed to access microphone. Please check permissions.');
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const result = await apiService.analyzeAudio(selectedFile);
      setAnalysisResult(result);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed. Please try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setAnalysisResult(null);
    setError(null);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📊 New Analysis</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload an audio file or record directly to analyze compliance, sentiment, and toxicity.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {/* File Upload/Record Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Upload Tab */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Upload Audio
          </h2>

          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
              }
            `}
          >
            <input {...getInputProps()} />
            <FileAudio className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            {isDragActive ? (
              <p className="text-primary-600 dark:text-primary-400">Drop the audio file here...</p>
            ) : (
              <>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Drag and drop an audio file here, or click to select
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Supports WAV, MP3, M4A</p>
              </>
            )}
          </div>

          {selectedFile && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center justify-between">
              <div className="flex items-center">
                <FileAudio className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-3" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={clearFile}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Record Tab */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Mic className="mr-2 h-5 w-5" />
            Record Audio
          </h2>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Record audio directly using your browser's microphone.
            </p>

            <div className="flex items-center space-x-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="btn btn-primary flex items-center"
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Start Recording
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="btn btn-danger flex items-center"
                >
                  <div className="mr-2 h-5 w-5 bg-white rounded-full animate-pulse" />
                  Stop Recording
                </button>
              )}

              {isRecording && (
                <span className="text-red-600 font-medium animate-pulse">Recording...</span>
              )}
            </div>

            {selectedFile && selectedFile.name === 'recording.wav' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-green-800 text-sm">Recording saved successfully!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analyze Button */}
      {selectedFile && (
        <div className="mb-8">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="btn btn-primary w-full md:w-auto px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <FileAudio className="mr-2 h-5 w-5" />
                Run Compliance Analysis
              </>
            )}
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResult && (
        <AnalysisResults
          result={analysisResult}
          audioFile={audioFileForPlayback || selectedFile}
        />
      )}
    </div>
  );
}

