'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore, useLanguageStore } from '@/store/useStore';
import { LanguageSelector } from '@/components/LanguageSelector';
import toast from 'react-hot-toast';
import { Send, KeyRound, Phone, UserCheck, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const setRefreshToken = useAuthStore((s) => s.setRefreshToken);
  const { t, lang } = useLanguageStore();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState(lang === 'ky' ? '+996' : '+7');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(true);
  const [existingDisplayName, setExistingDisplayName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      router.push('/');
    }
  }, [router]);

  // Обновляем дефолтный префикс при смене языка, если номер еще не введён
  useEffect(() => {
    if (step === 'phone') {
      if (phone === '+7' || phone === '+996' || phone === '+1') {
        if (lang === 'ky') setPhone('+996');
        else if (lang === 'en') setPhone('+1');
        else setPhone('+7');
      }
    }
  }, [lang, step]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 9) {
      toast.error(t.invalidPhone);
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.sendCode(phone);
      setIsNewUser(Boolean(res.data?.is_new));
      setExistingDisplayName(res.data?.display_name || null);
      if (res.data?.code) {
        setDevCode(res.data.code);
        setCode(res.data.code); // автозаполнение для удобства разработки
        toast.success(`${t.otpLabel}: ${res.data.code}`, { duration: 8000 });
      } else {
        toast.success(t.codeSent);
      }
      setStep('otp');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      toast.error(t.emptyCode);
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verify(phone, code, displayName || undefined);
      setToken(res.data.access_token);
      setRefreshToken(res.data.refresh_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      toast.success(t.loginSuccess);
      router.push('/');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f17] p-4 select-none">
      {/* ─── Анимированный Градиентный Фон ────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Плавающая сфера 1: Telegram Blue */}
        <div className="absolute -top-20 -left-20 h-[480px] w-[480px] rounded-full bg-[#2AABEE]/20 blur-[130px] animate-orb-1" />
        {/* Плавающая сфера 2: Глубокий ультрамарин */}
        <div className="absolute top-1/3 -right-24 h-[500px] w-[500px] rounded-full bg-[#1d4ed8]/25 blur-[140px] animate-orb-2" />
        {/* Плавающая сфера 3: Циан / Неоновая бирюза */}
        <div className="absolute -bottom-24 left-1/4 h-[440px] w-[440px] rounded-full bg-[#06b6d4]/18 blur-[120px] animate-orb-3" />
        {/* Микро-паттерн сетка */}
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      {/* ─── Переключатель языка сверху ───────────────────────── */}
      <div className="absolute top-5 right-5 z-20">
        <LanguageSelector />
      </div>

      {/* ─── Стеклянная Карточка Входа ─────────────────────────── */}
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-[#17212b]/85 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl border border-white/10 animate-message">
        <div className="mb-7 text-center">
          <div
            className={`relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-[#2AABEE] to-[#0088cc] text-white shadow-xl shadow-sky-500/25 transition-all duration-500 ${
              step === 'otp' ? 'scale-105 rotate-6' : 'scale-100 rotate-0'
            }`}
          >
            {step === 'phone' ? (
              <Send size={38} className="translate-x-0.5 transition-transform" />
            ) : (
              <KeyRound size={36} className="transition-transform" />
            )}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-sky-500" />
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">{t.loginTitle}</h1>
          <p
            key={step}
            className="mt-2 text-xs sm:text-sm text-gray-400 animate-message transition-all duration-300"
          >
            {step === 'phone' ? t.loginSubtitlePhone : t.loginSubtitleOtp(phone)}
          </p>
        </div>

        {/* ─── Плавный Слайдер Шагов (Горизонтальный переход) ───── */}
        <div className="relative overflow-hidden w-full">
          <div
            className={`flex w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              step === 'phone' ? 'translate-x-0' : '-translate-x-1/2'
            }`}
          >
            {/* ШАГ 1: Ввод номера телефона */}
            <div
              className={`w-1/2 flex-shrink-0 pr-3 transition-opacity duration-300 ${
                step === 'phone' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {t.phoneLabel}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t.phonePlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? t.sending : t.continueBtn}
                </button>
              </form>
            </div>

            {/* ШАГ 2: Подтверждение проверочного кода */}
            <div
              className={`w-1/2 flex-shrink-0 pl-3 transition-opacity duration-300 ${
                step === 'otp' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <form onSubmit={handleVerify} className="space-y-4">
                {devCode && (
                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-center shadow-inner">
                    <p className="text-[11px] font-medium text-sky-400">{t.devCodeLabel}</p>
                    <p className="mt-0.5 font-mono text-2xl font-extrabold tracking-widest text-sky-300">
                      {devCode}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-400">{t.devCodeHint}</p>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {t.otpLabel}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={t.otpPlaceholder}
                      maxLength={6}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-center font-mono text-lg font-bold tracking-widest text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                      required
                    />
                  </div>
                </div>

                {isNewUser ? (
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      {t.nameLabel}
                    </label>
                    <div className="relative">
                      <UserCheck className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t.namePlaceholder}
                        className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                        required
                      />
                    </div>
                  </div>
                ) : existingDisplayName ? (
                  <div className="rounded-2xl bg-[#242f3d]/80 px-4 py-2.5 text-xs text-gray-300 border border-white/5 flex items-center justify-between">
                    <span>{t.welcomeBack}</span>
                    <span className="font-bold text-white text-sm">{existingDisplayName}</span>
                  </div>
                ) : null}

                <div className="flex space-x-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="w-1/3 rounded-2xl bg-gray-800/90 py-3.5 font-medium text-gray-300 hover:bg-gray-700 transition"
                  >
                    {t.backBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? t.checking : t.signInBtn}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
