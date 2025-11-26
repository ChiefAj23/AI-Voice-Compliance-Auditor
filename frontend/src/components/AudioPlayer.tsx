import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [highlightedSegment, setHighlightedSegment] = useState<number | null>(null);

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

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
    };
  }, [segments, onTimeUpdate]);

  // Sync with external time updates
  useEffect(() => {
    if (externalTime !== undefined && audioRef.current) {
      audioRef.current.currentTime = externalTime;
    }
  }, [externalTime]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const jumpToSegment = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !segments[index]) return;

    audio.currentTime = segments[index].start;
    setCurrentTime(segments[index].start);
  };

  return (
    <div className="card">
      <audio ref={audioRef} src={audioSrc} />

      {/* Player Controls */}
      <div className="space-y-4">
        {/* Progress Bar */}
        <div>
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => skip(-10)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Rewind 10s"
            >
              <SkipBack className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <button
              onClick={togglePlay}
              className="p-3 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6 ml-1" />
              )}
            </button>
            <button
              onClick={() => skip(10)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Forward 10s"
            >
              <SkipForward className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Volume2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
          </div>
        </div>
      </div>

      {/* Transcript with Highlights */}
      {segments.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">Synchronized Transcript</h3>
          <div className="max-h-96 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
            {segments.map((segment, index) => {
              const isHighlighted = highlightedSegment === index;
              const isPast = currentTime > segment.end;
              const isCurrent = currentTime >= segment.start && currentTime <= segment.end;

              return (
                <div
                  key={index}
                  onClick={() => jumpToSegment(index)}
                  className={`
                    p-3 rounded-lg cursor-pointer transition-all
                    ${isCurrent
                      ? 'bg-primary-100 dark:bg-primary-900/30 border-2 border-primary-500 dark:border-primary-400'
                      : isPast
                      ? 'bg-gray-100 dark:bg-gray-700 opacity-75'
                      : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }
                  `}
                >
                  {segment.speaker && (
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1 block">
                      {segment.speaker}
                    </span>
                  )}
                  <span className={`text-sm ${
                    isCurrent
                      ? 'text-primary-900 dark:text-primary-100 font-medium'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {segment.text}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    [{Math.floor(segment.start)}s - {Math.floor(segment.end)}s]
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

