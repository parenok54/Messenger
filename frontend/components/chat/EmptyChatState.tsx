'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface EmptyChatStateProps {
  placeholderText: string;
}

const AMBIENT_DOTS = [
  { top: '14%', left: '18%', size: 3, delay: '0s', dur: '14s', opacity: 0.7 },
  { top: '22%', left: '78%', size: 2.5, delay: '2s', dur: '18s', opacity: 0.6 },
  { top: '38%', left: '12%', size: 2, delay: '4s', dur: '16s', opacity: 0.5 },
  { top: '64%', left: '84%', size: 3, delay: '1s', dur: '20s', opacity: 0.75 },
  { top: '76%', left: '22%', size: 2.5, delay: '3s', dur: '15s', opacity: 0.65 },
  { top: '84%', left: '68%', size: 2, delay: '5s', dur: '17s', opacity: 0.5 },
  { top: '18%', left: '48%', size: 2, delay: '2.5s', dur: '19s', opacity: 0.55 },
  { top: '82%', left: '42%', size: 3, delay: '1.5s', dur: '13s', opacity: 0.7 },
  { top: '48%', left: '90%', size: 2, delay: '3.5s', dur: '21s', opacity: 0.5 },
  { top: '32%', left: '32%', size: 2.5, delay: '0.8s', dur: '16s', opacity: 0.6 },
  { top: '60%', left: '16%', size: 2, delay: '4.2s', dur: '18s', opacity: 0.45 },
  { top: '70%', left: '72%', size: 2.5, delay: '2.8s', dur: '14s', opacity: 0.65 },
];

export function EmptyChatState({ placeholderText }: EmptyChatStateProps) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex h-full flex-1 flex-col items-center justify-center tg-chat-bg text-gray-400 select-none overflow-hidden"
    >
      {/* Interactive mouse spotlight illuminating the dots */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out"
        style={{
          opacity: isHovered ? 1 : 0.35,
          background: `radial-gradient(600px circle at ${mousePos.x}% ${mousePos.y}%, rgba(42, 171, 238, 0.12), transparent 70%)`,
        }}
      />

      {/* Subtle floating glowing particles / star dots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {AMBIENT_DOTS.map((dot, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-[#2AABEE] animate-float-dot"
            style={{
              width: `${dot.size}px`,
              height: `${dot.size}px`,
              top: dot.top,
              left: dot.left,
              opacity: dot.opacity,
              animationDelay: dot.delay,
              animationDuration: dot.dur,
              boxShadow: '0 0 8px rgba(42, 171, 238, 0.7)',
            }}
          />
        ))}
      </div>

      {/* Center animated emblem */}
      <div className="relative z-10 flex flex-col items-center space-y-4">
        <div className="relative">
          {/* Pulsing ambient halo behind icon */}
          <div className="absolute -inset-4 rounded-full bg-[#2AABEE]/20 blur-xl animate-icon-glow pointer-events-none" />

          <div className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-[#17212b]/90 border border-white/10 shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-[#2AABEE]/50 hover:shadow-[0_0_30px_rgba(42,171,238,0.35)] cursor-default">
            <Send
              size={28}
              className="text-[#2AABEE] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </div>
        </div>

        <span className="rounded-full bg-[#17212b]/85 px-4 py-1.5 text-xs font-medium text-gray-300 border border-white/10 shadow-lg backdrop-blur-md transition-all duration-300 hover:border-white/20">
          {placeholderText}
        </span>
      </div>
    </div>
  );
}
