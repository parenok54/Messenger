'use client';

import React, { useEffect, useCallback } from 'react';
import { X, Download, ChevronLeft, ChevronRight } from 'lucide-react';

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  fileName?: string | null;
  senderName?: string | null;
  createdAt?: string | null;
}

interface MediaLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaItems: MediaItem[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function MediaLightboxModal({
  isOpen,
  onClose,
  mediaItems,
  currentIndex,
  onNavigate,
}: MediaLightboxModalProps) {
  const currentItem = mediaItems[currentIndex];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < mediaItems.length - 1) {
        onNavigate(currentIndex + 1);
      }
    },
    [isOpen, currentIndex, mediaItems.length, onClose, onNavigate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !currentItem) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/92 backdrop-blur-md animate-menu-in"
      onClick={onClose}
    >
      {/* Top Header */}
      <div
        className="flex h-16 items-center justify-between px-6 bg-gradient-to-b from-black/70 to-transparent z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col text-white">
          <span className="font-medium text-sm">
            {currentItem.senderName || 'Медиафайл'}
          </span>
          <span className="text-xs text-gray-400">
            {mediaItems.length > 1
              ? `${currentIndex + 1} из ${mediaItems.length}`
              : currentItem.fileName || ''}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Download button */}
          <a
            href={currentItem.url}
            download={currentItem.fileName || 'media'}
            target="_blank"
            rel="noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition active:scale-95"
            title="Скачать"
          >
            <Download size={20} />
          </a>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition active:scale-95"
            title="Закрыть (Esc)"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Center Media View */}
      <div
        className="relative flex flex-1 items-center justify-center px-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev Arrow */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 hover:scale-105 transition shadow-xl"
            title="Предыдущее"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Next Arrow */}
        {currentIndex < mediaItems.length - 1 && (
          <button
            type="button"
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/90 hover:scale-105 transition shadow-xl"
            title="Следующее"
          >
            <ChevronRight size={28} />
          </button>
        )}

        {/* Media content */}
        {currentItem.type === 'image' ? (
          <img
            src={currentItem.url}
            alt={currentItem.fileName || 'Preview'}
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
          />
        ) : (
          <video
            src={currentItem.url}
            controls
            autoPlay
            className="max-h-[82vh] max-w-[90vw] rounded-lg shadow-2xl"
          />
        )}
      </div>

      {/* Bottom Bar Thumbnail or Spacing */}
      <div className="h-12 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  );
}
