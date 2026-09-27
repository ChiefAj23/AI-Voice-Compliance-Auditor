import { useEffect, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, FileAudio, Languages, ListChecks, Mic, ShieldCheck, Sparkles, Square, UploadCloud, Users, X } from 'lucide-react';
import clsx from 'clsx';
import { apiService } from '../services/api';
import type { AnalysisResult } from '../services/api';
import AnalysisResults from '../components/AnalysisResults';
import { Card, CardFooter, CardHeader, PageHeader, SegmentedControl, Spinner } from '../components/ui';

type Source = 'upload' | 'record';

const pipeline = [
  { icon: Languages, title: 'Transcription', text: 'Whisper speech-to-text with language detection.' },
  { icon: ShieldCheck, title: 'Compliance scoring', text: 'An overall score plus your custom policy rules.' },
  { icon: Sparkles, title: 'Risk signals', text: 'Sentiment, emotion and toxicity for each segment.' },
  { icon: Users, title: 'Conversation dynamics', text: 'Speakers, turns, interruptions and balance.' },
  { icon: ListChecks, title: 'Insights', text: 'Summary, topics, intent and action items.' },
];

export default function HomePage() {
  const [source, setSource] = useState<Source>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioFileForPlayback, setAudioFileForPlayback] = useState<File | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (analysisResult) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [analysisResult]);

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
    <div className="space-y-6">
      <PageHeader
        title="New analysis"
        description="Upload a call recording or record one in the browser to score compliance, sentiment and risk."
      />

      {error && (
        <div className="callout callout-danger" role="alert">
          <AlertTriangle />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Audio source"
            description="One recording per analysis."
            actions={
              <SegmentedControl
                label="Audio source"
                options={[
                  { value: 'upload', label: 'Upload' },
                  { value: 'record', label: 'Record' },
                ]}
                value={source}
                onChange={setSource}
              />
            }
          />

          <div className="p-5">
            {source === 'upload' ? (
              <div
                {...getRootProps()}
                className={clsx(
                  'flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center transition-colors',
                  isDragActive
                    ? 'border-accent bg-accent-subtle/50'
                    : 'border-line-strong bg-surface-subtle/40 hover:border-accent/60 hover:bg-surface-subtle',
                )}
              >
                <input {...getInputProps()} />
                <span className="grid h-11 w-11 place-items-center rounded-lg border border-line bg-surface text-fg-subtle shadow-xs">
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="mt-4 text-sm font-medium text-fg">
                  {isDragActive ? (
                    'Drop the recording to upload it'
                  ) : (
                    <>
                      Drop a recording here, or <span className="text-accent-fg">browse</span>
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs text-fg-subtle">WAV, MP3 or M4A</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-surface-subtle/40 px-6 py-10 text-center">
                {isRecording ? (
                  <>
                    <span className="relative grid h-14 w-14 place-items-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-red-500/20" aria-hidden="true" />
                      <span className="relative grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white">
                        <Mic className="h-6 w-6" aria-hidden="true" />
                      </span>
                    </span>
                    <p className="mt-4 text-sm font-medium text-fg" role="status">
                      Recording…
                    </p>
                    <p className="mt-1 text-xs text-fg-subtle">Stop when the conversation is finished.</p>
                    <button onClick={stopRecording} className="btn btn-danger mt-5">
                      <Square />
                      Stop recording
                    </button>
                  </>
                ) : (
                  <>
                    <span className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-fg-subtle shadow-xs">
                      <Mic className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-sm font-medium text-fg">Record from your microphone</p>
                    <p className="mt-1 text-xs text-fg-subtle">Your browser will ask for microphone access.</p>
                    <button onClick={startRecording} className="btn btn-primary mt-5">
                      <Mic />
                      Start recording
                    </button>
                  </>
                )}
              </div>
            )}

            {selectedFile && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-line px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent-subtle text-accent-fg">
                  <FileAudio className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{selectedFile.name}</p>
                  <p className="text-xs tabular-nums text-fg-subtle">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    {selectedFile.name === 'recording.wav' && ' · recorded in the browser'}
                  </p>
                </div>
                <button onClick={clearFile} disabled={isAnalyzing} className="btn btn-ghost btn-sm">
                  <X />
                  Remove
                </button>
              </div>
            )}
          </div>

          <CardFooter>
            <p className="text-xs text-fg-subtle">
              {isAnalyzing
                ? 'Transcribing and scoring. Longer calls can take a minute.'
                : selectedFile
                  ? 'Ready to analyze.'
                  : 'Add a recording to continue.'}
            </p>
            <button onClick={handleAnalyze} disabled={!selectedFile || isAnalyzing} className="btn btn-primary">
              {isAnalyzing && <Spinner />}
              {isAnalyzing ? 'Analyzing…' : 'Run analysis'}
            </button>
          </CardFooter>
        </Card>

        <Card className="self-start">
          <CardHeader title="What every analysis includes" />
          <ul className="space-y-4 p-5">
            {pipeline.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface-subtle text-fg-muted">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-fg">{title}</p>
                  <p className="text-[13px] text-fg-subtle">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {analysisResult && (
        <div ref={resultsRef} className="scroll-mt-20">
          <AnalysisResults result={analysisResult} audioFile={audioFileForPlayback || selectedFile} />
        </div>
      )}
    </div>
  );
}
