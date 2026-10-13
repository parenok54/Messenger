'use client';

import React from 'react';
import { useLanguageStore } from '@/store/useStore';
import { Lang } from '@/lib/i18n';
import { Globe } from 'lucide-react';

const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'ky', label: 'Кыргызча', flag: '🇰🇬' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

interface LanguageSelectorProps {
  compact?: boolean;
}

export function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { lang, setLang } = useLanguageStore();

  return (
    <div className="flex items-center space-x-1 rounded-xl bg-[#17212b]/80 p-1 backdrop-blur-md border border-white/10 shadow-lg">
      <Globe size={14} className="ml-1.5 mr-0.5 text-gray-400" />
      {LANGUAGES.map((l) => {
        const isActive = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            className={`flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
              isActive
                ? 'bg-[#2AABEE] text-white shadow-sm scale-105'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>{l.flag}</span>
            <span>{compact ? l.code.toUpperCase() : l.label}</span>
          </button>
        );
      })}
    </div>
  );
}
