import { useState, useRef, useEffect, useMemo } from 'react';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import clsx from 'clsx';
import { formatDuration, tidyLabel } from '../utils/format';
import { useChartTheme } from '../utils/chart';
import { Card, CardHeader, IconButton } from './ui';

interface AudioPlayerProps {
  audioUrl: string | File;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: string;
  }>;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
}

export default function AudioPlayer({
  audioUrl,
  segments,
  currentTime: externalTime,
  onTimeUpdate
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [highlightedSegment, setHighlightedSegment] = useState<number | null>(null);
  const { series } = useChartTheme();

  // Speakers keep a fixed color slot in order of first appearance.
  const speakers = useMemo(
    () => Array.from(new Set(segments.map((seg) => seg.speaker).filter((s): s is string => Boolean(s)))),
    [segments],
  );
  const speakerColor = (speaker?: string) => {
    const index = speaker ? speakers.indexOf(speaker) : -1;
    return index >= 0 && index < series.length ? series[index] : undefined;
  };

  // Create object URL if File
  const [audioSrc, setAudioSrc] = useState<string>('');

  useEffect(() => {
    if (audioUrl instanceof File) {
      const url = URL.createObjectURL(audioUrl);
      setAudioSrc(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioSrc(audioUrl);
    }
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);

      // Find current segment
      const currentSeg = segments.findIndex(
        seg => time >= seg.start && time <= seg.end
      );
      setHighlightedSegment(currentSeg >= 0 ? currentSeg : null);
    };

    const updateDuration = () => {
      setDuration(audio.duration);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onPause);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onPause);
    };
  }, [segments, onTimeUpdate]);

  // Sync with external time updates
  useEffect(() => {
    if (externalTime !== undefined && audioRef.current) {
      audioRef.current.currentTime = externalTime;
    }
  }, [externalTime]);

  // Keep the active line visible while playing, scrolling only the transcript list.
  useEffect(() => {
    const list = listRef.current;
    if (!isPlaying || !list || highlightedSegment === null) return;
    const row = list.children[highlightedSegment] as HTMLElement | undefined;
    if (!row) return;
    const top = row.offsetTop;
    if (top < list.scrollTop || top + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
    }
  }, [highlightedSegment, isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const vol = parseFloat(e.target.value);
    audio.volume = vol;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  const jumpToSegment = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !segments[index]) return;

    audio.currentTime = segments[index].start;
    setCurrentTime(segments[index].start);
  };

  return (
    <Card>
      <CardHeader title="Recording" description="Select a line in the transcript to jump to that moment." />
      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      {/* Player controls */}
      <div className="flex items-center gap-2 border-b border-line px-5 py-4 sm:gap-3">
        <IconButton icon={SkipBack} label="Back 10 seconds" onClick={() => skip(-10)} />
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="btn btn-primary h-10 w-10 shrink-0 rounded-full px-0"
        >
          {isPlaying ? <Pause /> : <Play className="translate-x-px" />}
        </button>
        <IconButton icon={SkipForward} label="Forward 10 seconds" onClick={() => skip(10)} />

        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-fg-muted">{formatDuration(currentTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek"
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-accent"
        />
        <span className="w-10 shrink-0 text-xs tabular-nums text-fg-subtle">{formatDuration(duration)}</span>

        <div className="hidden items-center gap-1 sm:flex">
          <IconButton icon={isMuted ? VolumeX : Volume2} label={isMuted ? 'Unmute' : 'Mute'} onClick={toggleMute} />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Volume"
            className="h-1.5 w-20 cursor-pointer accent-accent"
          />
        </div>
      </div>

      {/* Synchronized transcript */}
      {segments.length > 0 && (
        <ol ref={listRef} className="relative max-h-[28rem] divide-y divide-line overflow-y-auto">
          {segments.map((segment, index) => {
            const isCurrent = currentTime >= segment.start && currentTime <= segment.end;
            const isPast = currentTime > segment.end;
            const color = speakerColor(segment.speaker);

            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => jumpToSegment(index)}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={clsx(
                    'flex w-full gap-4 px-5 py-3 text-left transition-colors',
                    isCurrent ? 'bg-accent-subtle/70' : 'hover:bg-surface-subtle',
                  )}
                >
                  <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-fg-subtle">
                    {formatDuration(segment.start)}
                  </span>
                  <span className="min-w-0 flex-1">
                    {segment.speaker && (
                      <span className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-fg-faint"
                          style={color ? { backgroundColor: color } : undefined}
                          aria-hidden="true"
                        />
                        {tidyLabel(segment.speaker)}
                      </span>
                    )}
                    <span
                      className={clsx(
                        'block text-sm leading-6',
                        isCurrent ? 'text-fg' : isPast ? 'text-fg-subtle' : 'text-fg-muted',
                      )}
                    >
                      {segment.text}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
