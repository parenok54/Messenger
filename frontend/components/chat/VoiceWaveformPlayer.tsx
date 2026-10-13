'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause } from 'lucide-react';

interface VoiceWaveformPlayerProps {
  fileUrl: string;
  isMe: boolean;
}

// Простой детерминированный генератор псевдо-случайных высот волны на основе URL
function generateWaveformBars(seed: string, count = 32): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.sin((hash + i * 17) * 0.15) * 10000;
    const val = x - Math.floor(x);
    // Высота от 20% до 100%
    bars.push(Math.round(20 + val * 80));
  }
  return bars;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const SPEEDS = [1, 1.5, 2];

export function VoiceWaveformPlayer({ fileUrl, isMe }: VoiceWaveformPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bars = useMemo(() => generateWaveformBars(fileUrl, 32), [fileUrl]);

  useEffect(() => {
    const audio = new Audio(fileUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [fileUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const targetTime = (index / bars.length) * duration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIdx);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[nextIdx];
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const activeBarIndex = Math.floor(progress * bars.length);

  return (
    <div className="flex items-center space-x-3 py-1 select-none min-w-[210px] sm:min-w-[240px]">
      {/* Кнопка Play/Pause */}
      <button
        type="button"
        onClick={togglePlay}
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 shadow-md ${
          isMe
            ? 'bg-white text-[#2b5278] hover:bg-gray-100 active:scale-95'
            : 'bg-[#2AABEE] text-white hover:bg-[#229ed9] active:scale-95'
        }`}
        title={isPlaying ? 'Пауза' : 'Слушать'}
      >
        {isPlaying ? (
          <Pause size={18} className="fill-current" />
        ) : (
          <Play size={18} className="fill-current translate-x-0.5" />
        )}
      </button>

      {/* Волна и таймер */}
      <div className="flex flex-1 flex-col justify-center space-y-1">
        {/* Интерактивные полоски Waveform */}
        <div
          className="flex h-7 items-center space-x-[2.5px] cursor-pointer py-1"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            if (audioRef.current && duration) {
              audioRef.current.currentTime = clickRatio * duration;
              setCurrentTime(clickRatio * duration);
            }
          }}
        >
          {bars.map((heightPercent, idx) => {
            const isPassed = idx <= activeBarIndex;
            return (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSeek(idx);
                }}
                className={`w-[3px] rounded-full transition-colors duration-150 ${
                  isPassed
                    ? isMe
                      ? 'bg-white'
                      : 'bg-[#2AABEE]'
                    : isMe
                    ? 'bg-white/35 hover:bg-white/60'
                    : 'bg-gray-600 hover:bg-gray-500'
                }`}
                style={{ height: `${heightPercent}%` }}
              />
            );
          })}
        </div>

        {/* Время и кнопка скорости */}
        <div className="flex items-center justify-between text-[11px] font-medium opacity-85">
          <span>{isPlaying ? formatTime(currentTime) : formatTime(duration || currentTime)}</span>

          <button
            type="button"
            onClick={cycleSpeed}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
              isMe
                ? 'bg-white/20 hover:bg-white/30 text-white'
                : 'bg-gray-700/60 hover:bg-gray-700 text-[#2AABEE]'
            }`}
            title="Скорость воспроизведения"
          >
            {SPEEDS[speedIndex]}x
          </button>
        </div>
      </div>
    </div>
  );
}
