'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore, useLanguageStore } from '@/store/useStore';
import { LanguageSelector } from '@/components/LanguageSelector';
import toast from 'react-hot-toast';
import {
  Send,
  KeyRound,
  Phone,
  UserCheck,
  Lock,
  Eye,
  EyeOff,
  User,
  Zap,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

type AuthTab = 'phone' | 'password' | 'demo';

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const setRefreshToken = useAuthStore((s) => s.setRefreshToken);
  const { t, lang } = useLanguageStore();

  const [activeTab, setActiveTab] = useState<AuthTab>('phone');

  // Phone / OTP state
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState(lang === 'ky' ? '+996' : '+7');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(true);
  const [existingDisplayName, setExistingDisplayName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  // Password auth state
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');

  // Loading state
  const [loading, setLoading] = useState(false);
  const [demoLoadingUser, setDemoLoadingUser] = useState<string | null>(null);

  // OTP inputs refs
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      router.push('/');
    }
  }, [router]);

  // Смена дефолтного кода страны при смене языка
  useEffect(() => {
    if (step === 'phone') {
      if (phone === '+7' || phone === '+996' || phone === '+1') {
        if (lang === 'ky') setPhone('+996');
        else if (lang === 'en') setPhone('+1');
        else setPhone('+7');
      }
    }
  }, [lang, step]);

  // Countdown таймер для повторной отправки кода
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Форматирование телефонного номера на лету
  const handlePhoneChange = (val: string) => {
    // Разрешаем цифры, +, скобки, пробелы и дефисы
    let cleaned = val.replace(/[^\d+]/g, '');
    if (!cleaned.startsWith('+') && cleaned.length > 0) {
      cleaned = '+' + cleaned;
    }
    setPhone(cleaned);
  };

  // ─── OTP Логика ячеек ────────────────────────────────────────────────────────
  const fillOtpCode = (codeStr: string) => {
    const digits = codeStr.replace(/\D/g, '').slice(0, 6).split('');
    const newArr = ['', '', '', '', '', ''];
    digits.forEach((d, i) => {
      newArr[i] = d;
    });
    setOtpDigits(newArr);
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    const digit = val.slice(-1).replace(/\D/g, '');
    const newArr = [...otpDigits];
    newArr[index] = digit;
    setOtpDigits(newArr);

    // Автоматический переход на следующую ячейку
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Если текущая пустая, переходим назад и удаляем предыдущую
        otpInputRefs.current[index - 1]?.focus();
        const newArr = [...otpDigits];
        newArr[index - 1] = '';
        setOtpDigits(newArr);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    fillOtpCode(pasted);
    otpInputRefs.current[5]?.focus();
  };

  // ─── Запросы Auth ────────────────────────────────────────────────────────────

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        fillOtpCode(res.data.code);
        toast.success(`${t.otpLabel}: ${res.data.code}`, { duration: 8000 });
      } else {
        toast.success(t.codeSent);
      }
      setStep('otp');
      setResendTimer(60); // 60 секунд до повтора
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = otpDigits.join('');
    if (fullCode.length < 6) {
      toast.error(t.emptyCode);
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verify(phone, fullCode, displayName || undefined);
      completeLogin(res.data.access_token, res.data.refresh_token);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка верификации');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegisterMode) {
        if (!regUsername || !regDisplayName || !password) {
          toast.error('Заполните все обязательные поля');
          setLoading(false);
          return;
        }
        const res = await authApi.registerPassword({
          username: regUsername,
          display_name: regDisplayName,
          password: password,
        });
        toast.success('Аккаунт успешно создан!');
        completeLogin(res.data.access_token, res.data.refresh_token);
      } else {
        if (!loginIdentifier || !password) {
          toast.error('Введите логин и пароль');
          setLoading(false);
          return;
        }
        const res = await authApi.loginPassword(loginIdentifier, password);
        completeLogin(res.data.access_token, res.data.refresh_token);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (userType: string) => {
    setDemoLoadingUser(userType);
    try {
      const res = await authApi.demoLogin(userType);
      toast.success('Вход под тестовым аккаунтом выполнен!');
      completeLogin(res.data.access_token, res.data.refresh_token);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка демо-входа');
    } finally {
      setDemoLoadingUser(null);
    }
  };

  const completeLogin = (accessToken: string, refreshToken: string) => {
    setToken(accessToken);
    setRefreshToken(refreshToken);
    localStorage.setItem('refresh_token', refreshToken);
    toast.success(t.loginSuccess);
    router.push('/');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0f17] p-4 select-none">
      {/* ─── Анимированный Градиентный Фон ────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 h-[480px] w-[480px] rounded-full bg-[#2AABEE]/20 blur-[130px] animate-orb-1" />
        <div className="absolute top-1/3 -right-24 h-[500px] w-[500px] rounded-full bg-[#1d4ed8]/25 blur-[140px] animate-orb-2" />
        <div className="absolute -bottom-24 left-1/4 h-[440px] w-[440px] rounded-full bg-[#06b6d4]/18 blur-[120px] animate-orb-3" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px]" />
      </div>

      {/* ─── Переключатель языка сверху ───────────────────────── */}
      <div className="absolute top-5 right-5 z-20">
        <LanguageSelector />
      </div>

      {/* ─── Карточка Входа ───────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-[#17212b]/90 p-7 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl border border-white/10">
        
        {/* Заголовок и Логотип */}
        <div className="mb-6 text-center">
          <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2AABEE] to-[#0088cc] text-white shadow-lg shadow-sky-500/25">
            <Send size={30} className="translate-x-0.5" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500" />
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">{t.loginTitle}</h1>
        </div>

        {/* ─── Вкладки Выбора Режима ────────────────────────────── */}
        <div className="mb-6 flex rounded-2xl bg-[#0f1721] p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('phone')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              activeTab === 'phone'
                ? 'bg-[#2AABEE] text-white shadow-md shadow-sky-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Phone size={13} />
            <span>{t.authTabPhone}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              activeTab === 'password'
                ? 'bg-[#2AABEE] text-white shadow-md shadow-sky-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Lock size={13} />
            <span>{t.authTabPassword}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('demo')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-1.5 ${
              activeTab === 'demo'
                ? 'bg-[#2AABEE] text-white shadow-md shadow-sky-500/20'
                : 'text-amber-400/90 hover:text-amber-300'
            }`}
          >
            <Zap size={13} />
            <span>{t.authTabDemo}</span>
          </button>
        </div>

        {/* ─── ТАБ 1: ВХОД ПО ТЕЛЕФОНУ (SMS / OTP) ──────────────── */}
        {activeTab === 'phone' && (
          <div>
            {step === 'phone' ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <p className="text-xs text-gray-400 text-center mb-4">
                  {t.loginSubtitlePhone}
                </p>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {t.phoneLabel}
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder={t.phonePlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner font-mono"
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
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-xs text-gray-400 text-center mb-3">
                  {t.loginSubtitleOtp(phone)}
                </p>

                {devCode && (
                  <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-center shadow-inner">
                    <p className="text-[11px] font-medium text-sky-400">{t.devCodeLabel}</p>
                    <p className="mt-0.5 font-mono text-2xl font-extrabold tracking-widest text-sky-300">
                      {devCode}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-400">{t.devCodeHint}</p>
                  </div>
                )}

                {/* 6 Отдельных Ячеек OTP */}
                <div>
                  <label className="mb-2.5 block text-xs font-semibold text-gray-300 uppercase tracking-wider text-center">
                    {t.otpLabel}
                  </label>
                  <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className={`h-13 w-11 sm:w-12 rounded-xl text-center font-mono text-xl font-bold transition-all shadow-inner border ${
                          digit
                            ? 'border-[#2AABEE] bg-[#223347] text-white shadow-[#2AABEE]/20 shadow-md'
                            : 'border-white/10 bg-[#242f3d]/90 text-white focus:border-[#2AABEE] focus:ring-2 focus:ring-[#2AABEE]/25'
                        } focus:outline-none`}
                      />
                    ))}
                  </div>
                </div>

                {/* Таймер повтора отправки */}
                <div className="text-center pt-1">
                  {resendTimer > 0 ? (
                    <span className="text-xs text-gray-400 flex items-center justify-center space-x-1">
                      <RotateCcw size={12} className="animate-spin text-gray-500" />
                      <span>{t.resendCodeIn(resendTimer)}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendCode()}
                      disabled={loading}
                      className="text-xs text-[#2AABEE] hover:underline font-medium transition"
                    >
                      {t.resendCodeBtn}
                    </button>
                  )}
                </div>

                {/* Новое имя пользователя, если новый */}
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

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('phone')}
                    className="w-1/3 rounded-2xl bg-gray-800/90 py-3.5 font-medium text-gray-300 hover:bg-gray-700 transition"
                  >
                    {t.backBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || otpDigits.join('').length < 6}
                    className="w-2/3 rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50"
                  >
                    {loading ? t.checking : t.signInBtn}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ─── ТАБ 2: ВХОД ПО ЛОГИНУ И ПАРОЛЮ ───────────────────── */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordAuth} className="space-y-4">
            {isRegisterMode ? (
              <>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {t.usernameLabel}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder={t.usernamePlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {t.nameLabel}
                  </label>
                  <div className="relative">
                    <UserCheck className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                    <input
                      type="text"
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {t.loginOrEmailLabel}
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={t.loginOrEmailPlaceholder}
                    className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                {t.passwordLabel}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 text-gray-500" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-11 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50"
            >
              {loading
                ? t.checking
                : isRegisterMode
                ? t.registerBtn
                : t.signInBtn}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-xs text-gray-400 hover:text-[#2AABEE] transition"
              >
                {isRegisterMode ? t.alreadyHaveAccount : t.dontHaveAccount}
              </button>
            </div>
          </form>
        )}

        {/* ─── ТАБ 3: БЫСТРЫЙ ДЕМО-ВХОД (1-CLICK DEMO) ──────────── */}
        {activeTab === 'demo' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 text-center mb-2">
              {t.quickDemoSubtitle}
            </p>

            {/* Карточка 1: Алексей (Lead Dev) */}
            <button
              type="button"
              onClick={() => handleDemoLogin('alex')}
              disabled={Boolean(demoLoadingUser)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#242f3d]/80 hover:bg-[#2c394b] border border-white/5 hover:border-sky-500/40 transition-all text-left group active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center font-bold text-white text-base shadow-md">
                  А
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center space-x-2">
                    <span>Алексей Смирнов</span>
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded-md font-mono">Lead</span>
                  </div>
                  <div className="text-xs text-gray-400">@alex_lead • Lead Fullstack Dev</div>
                </div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-white/5 group-hover:bg-[#2AABEE] text-gray-400 group-hover:text-white flex items-center justify-center transition">
                {demoLoadingUser === 'alex' ? (
                  <RotateCcw size={14} className="animate-spin text-white" />
                ) : (
                  <ArrowRight size={16} />
                )}
              </div>
            </button>

            {/* Карточка 2: Анна (Designer) */}
            <button
              type="button"
              onClick={() => handleDemoLogin('anna')}
              disabled={Boolean(demoLoadingUser)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#242f3d]/80 hover:bg-[#2c394b] border border-white/5 hover:border-purple-500/40 transition-all text-left group active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-purple-600 to-pink-400 flex items-center justify-center font-bold text-white text-base shadow-md">
                  А
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center space-x-2">
                    <span>Анна Ковалёва</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-md font-mono">UI/UX</span>
                  </div>
                  <div className="text-xs text-gray-400">@anna_design • Product Designer</div>
                </div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-white/5 group-hover:bg-[#2AABEE] text-gray-400 group-hover:text-white flex items-center justify-center transition">
                {demoLoadingUser === 'anna' ? (
                  <RotateCcw size={14} className="animate-spin text-white" />
                ) : (
                  <ArrowRight size={16} />
                )}
              </div>
            </button>

            {/* Карточка 3: Тестовый пользователь */}
            <button
              type="button"
              onClick={() => handleDemoLogin('guest')}
              disabled={Boolean(demoLoadingUser)}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-[#242f3d]/80 hover:bg-[#2c394b] border border-white/5 hover:border-emerald-500/40 transition-all text-left group active:scale-[0.99]"
            >
              <div className="flex items-center space-x-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-bold text-white text-base shadow-md">
                  Т
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center space-x-2">
                    <span>Тестовый Пользователь</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-md font-mono">New</span>
                  </div>
                  <div className="text-xs text-gray-400">@guest_tester • Демо-сессия</div>
                </div>
              </div>
              <div className="h-8 w-8 rounded-xl bg-white/5 group-hover:bg-[#2AABEE] text-gray-400 group-hover:text-white flex items-center justify-center transition">
                {demoLoadingUser === 'guest' ? (
                  <RotateCcw size={14} className="animate-spin text-white" />
                ) : (
                  <ArrowRight size={16} />
                )}
              </div>
            </button>

            <div className="mt-4 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-[11px] text-gray-400 flex items-start space-x-2">
              <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>
                Демо-вход мгновенно генерирует валидные JWT-токены и создаёт профиль, если он ещё не существует в базе данных.
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
