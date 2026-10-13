'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore, useLanguageStore } from '@/store/useStore';
import { LanguageSelector } from '@/components/LanguageSelector';
import toast from 'react-hot-toast';
import {
  Send,
  Phone,
  Mail,
  UserCheck,
  User,
  Zap,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';

type ViewMode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const setRefreshToken = useAuthStore((s) => s.setRefreshToken);
  const { t, lang } = useLanguageStore();

  // Режим: Вход или Регистрация
  const [viewMode, setViewMode] = useState<ViewMode>('login');

  // ─── LOGIN STATE ─────────────────────────────────────────────────────────────
  const [loginStep, setLoginStep] = useState<'input' | 'otp'>('input');
  const [loginMethod, setLoginMethod] = useState<'phone' | 'email'>('phone');
  const [loginPhone, setLoginPhone] = useState(lang === 'ky' ? '+996' : '+7');
  const [loginEmail, setLoginEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [loginOtpDigits, setLoginOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [loginResendTimer, setLoginResendTimer] = useState(0);

  // Привязка почты для пользователей, ранее регистрировавшихся по номеру
  const [loginNeedsEmail, setLoginNeedsEmail] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [loginNeedEmailMessage, setLoginNeedEmailMessage] = useState('');

  // ─── REGISTER STATE ──────────────────────────────────────────────────────────
  const [regStep, setRegStep] = useState<'input' | 'otp'>('input');
  const [regPhone, setRegPhone] = useState(lang === 'ky' ? '+996' : '+7');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regOtpDigits, setRegOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [regResendTimer, setRegResendTimer] = useState(0);

  // Демо блок & загрузка
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoadingUser, setDemoLoadingUser] = useState<string | null>(null);

  // OTP Refs
  const loginOtpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const regOtpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
      router.push('/');
    }
  }, [router]);

  // Обновление префикса телефона при смене языка
  useEffect(() => {
    const defaultPrefix = lang === 'ky' ? '+996' : lang === 'en' ? '+1' : '+7';
    if (loginPhone === '+7' || loginPhone === '+996' || loginPhone === '+1') {
      setLoginPhone(defaultPrefix);
    }
    if (regPhone === '+7' || regPhone === '+996' || regPhone === '+1') {
      setRegPhone(defaultPrefix);
    }
  }, [lang]);

  // Таймеры повторной отправки
  useEffect(() => {
    if (loginResendTimer <= 0) return;
    const interval = setInterval(() => {
      setLoginResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [loginResendTimer]);

  useEffect(() => {
    if (regResendTimer <= 0) return;
    const interval = setInterval(() => {
      setRegResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [regResendTimer]);

  // ─── OTP Helpers ─────────────────────────────────────────────────────────────
  const fillDigits = (
    codeStr: string,
    setDigits: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const clean = codeStr.replace(/\D/g, '').slice(0, 6).split('');
    const arr = ['', '', '', '', '', ''];
    clean.forEach((d, i) => {
      arr[i] = d;
    });
    setDigits(arr);
  };

  const handleDigitChange = (
    index: number,
    val: string,
    digits: string[],
    setDigits: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    const digit = val.slice(-1).replace(/\D/g, '');
    const newArr = [...digits];
    newArr[index] = digit;
    setDigits(newArr);

    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
    digits: string[],
    setDigits: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        refs.current[index - 1]?.focus();
        const newArr = [...digits];
        newArr[index - 1] = '';
        setDigits(newArr);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (
    e: React.ClipboardEvent,
    setDigits: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>
  ) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    fillDigits(pasted, setDigits);
    refs.current[5]?.focus();
  };

  // ─── LOGIN ACTIONS ───────────────────────────────────────────────────────────
  const handleLoginSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const target = loginMethod === 'phone' ? loginPhone.trim() : loginEmail.trim();
    if (!target) {
      toast.error(loginMethod === 'phone' ? 'Введите номер телефона' : 'Введите адрес эл. почты');
      return;
    }
    if (loginMethod === 'phone' && target.length < 6) {
      toast.error('Введите корректный номер телефона');
      return;
    }
    if (loginMethod === 'email' && (!target.includes('@') || target.length < 5)) {
      toast.error('Введите корректный адрес эл. почты');
      return;
    }

    if (loginNeedsEmail) {
      const cleanLink = linkEmail.trim();
      if (!cleanLink || !cleanLink.includes('@') || cleanLink.length < 5) {
        toast.error('Введите корректный адрес электронной почты для привязки');
        return;
      }
    }

    setLoading(true);
    try {
      const emailToLink = loginNeedsEmail ? linkEmail.trim() : undefined;
      const res = await authApi.sendCode(target, 'login', undefined, undefined, emailToLink);

      // Если аккаунт зарегистрирован ранее по номеру без почты
      if (res.data?.needs_email) {
        setLoginNeedsEmail(true);
        setLoginNeedEmailMessage(
          res.data.detail ||
            'Вы ранее регистрировались по номеру телефона. Сейчас подтверждение работает через почту — пожалуйста, укажите адрес вашей электронной почты для получения кода и привязки к аккаунту.'
        );
        toast('К вашему номеру необходимо привязать почту', { icon: 'ℹ️' });
        return;
      }

      const targetEm = res.data?.target_email || (loginNeedsEmail ? linkEmail.trim() : null);
      setMaskedEmail(targetEm);
      toast.success(
        targetEm
          ? `Код подтверждения отправлен на почту ${targetEm}`
          : 'Код подтверждения отправлен на вашу почту!'
      );
      setLoginOtpDigits(['', '', '', '', '', '']);
      setLoginStep('otp');
      setLoginResendTimer(60);
      setTimeout(() => loginOtpRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = loginOtpDigits.join('');
    if (code.length < 6) {
      toast.error(t.emptyCode);
      return;
    }
    const target = loginMethod === 'phone' ? loginPhone.trim() : loginEmail.trim();
    setLoading(true);
    try {
      const emailToLink = loginNeedsEmail ? linkEmail.trim() : undefined;
      const res = await authApi.verify(
        target,
        code,
        undefined,
        undefined,
        undefined,
        emailToLink
      );
      if (loginNeedsEmail) {
        toast.success('Почта успешно привязана к аккаунту! Добро пожаловать!');
      }
      completeAuth(res.data.access_token, res.data.refresh_token);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка проверки кода');
    } finally {
      setLoading(false);
    }
  };

  // ─── REGISTER ACTIONS ────────────────────────────────────────────────────────
  const handleRegisterSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailClean = regEmail.trim();
    const phoneClean = regPhone.trim();
    const nameClean = regDisplayName.trim();

    if (!nameClean) {
      toast.error('Введите ваше имя');
      return;
    }
    if (!emailClean || !emailClean.includes('@')) {
      toast.error('Введите корректный адрес электронной почты');
      return;
    }
    if (!phoneClean || phoneClean.length < 6) {
      toast.error('Введите номер телефона (обязательно)');
      return;
    }

    setLoading(true);
    try {
      await authApi.sendCode(emailClean, 'register', phoneClean, nameClean);
      toast.success(`Код подтверждения отправлен на почту ${emailClean}`);
      setRegOtpDigits(['', '', '', '', '', '']);
      setRegStep('otp');
      setRegResendTimer(60);
      setTimeout(() => regOtpRefs.current[0]?.focus(), 150);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки кода');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = regOtpDigits.join('');
    if (code.length < 6) {
      toast.error(t.emptyCode);
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verify(
        regEmail.trim(),
        code,
        regDisplayName.trim(),
        regUsername.trim() || undefined,
        regPhone.trim()
      );
      toast.success('Аккаунт успешно создан!');
      completeAuth(res.data.access_token, res.data.refresh_token);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  // ─── DEMO LOGIN ──────────────────────────────────────────────────────────────
  const handleDemoLogin = async (userType: string) => {
    setDemoLoadingUser(userType);
    try {
      const res = await authApi.demoLogin(userType);
      toast.success('Вход под тестовым аккаунтом выполнен!');
      completeAuth(res.data.access_token, res.data.refresh_token);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка демо-входа');
    } finally {
      setDemoLoadingUser(null);
    }
  };

  const completeAuth = (accessToken: string, refreshToken: string) => {
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

      {/* ─── Основная Карточка ─────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-[#17212b]/90 p-7 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl border border-white/10">
        
        {/* Заголовок и Telegram-лого */}
        <div className="mb-6 text-center">
          <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2AABEE] to-[#0088cc] text-white shadow-lg shadow-sky-500/25">
            <Send size={30} className="translate-x-0.5" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500" />
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            {viewMode === 'login' ? t.loginTitle : t.regTitle}
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            {viewMode === 'login'
              ? 'Войдите по номеру телефона или email'
              : t.regSubtitle}
          </p>
        </div>

        {/* ═════════════════════════════════════════════════════════ */}
        {/* РЕЖИМ 1: ВХОД В АККАУНТ                                    */}
        {/* ═════════════════════════════════════════════════════════ */}
        {viewMode === 'login' && (
          <div>
            {loginStep === 'input' ? (
              loginNeedsEmail ? (
                /* ШАГ: ПРИВЯЗКА EMAIL ДЛЯ СТАРЫХ ПОЛЬЗОВАТЕЛЕЙ ПО НОМЕРУ */
                <form onSubmit={handleLoginSendCode} className="space-y-4">
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2 text-left">
                    <div className="flex items-start space-x-2.5">
                      <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} />
                      <div>
                        <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                          Привязка почты к аккаунту
                        </h3>
                        <p className="text-xs text-gray-200 mt-1 leading-relaxed">
                          Вы ранее регистрировались по номеру телефона <span className="font-mono font-semibold text-white">{loginPhone}</span>.
                          Сейчас отправка проверочных кодов работает через email. Укажите вашу почту — мы отправим код и привяжем её к вашему аккаунту.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Ваша электронная почта *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                      <input
                        type="email"
                        value={linkEmail}
                        onChange={(e) => setLinkEmail(e.target.value)}
                        placeholder="your.email@gmail.com"
                        className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                        required
                        autoFocus
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      На эту почту придёт 6-значный проверочный код
                    </p>
                  </div>

                  <div className="flex space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginNeedsEmail(false);
                        setLinkEmail('');
                      }}
                      className="w-1/3 rounded-2xl bg-gray-800/90 py-3.5 font-medium text-gray-300 hover:bg-gray-700 transition text-sm"
                    >
                      {t.backBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !linkEmail}
                      className="w-2/3 rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50 text-sm"
                    >
                      {loading ? t.sending : 'Получить код на почту'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleLoginSendCode} className="space-y-4">
                  {/* Выбор способа входа: По телефону или По почте */}
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Способ входа
                    </label>
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#0f1721] p-1 border border-white/5 mb-3">
                      <button
                        type="button"
                        onClick={() => setLoginMethod('phone')}
                        className={`py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                          loginMethod === 'phone'
                            ? 'bg-[#2AABEE] text-white shadow-md shadow-sky-500/20'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Phone size={13} />
                        <span>По телефону</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoginMethod('email')}
                        className={`py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                          loginMethod === 'email'
                            ? 'bg-[#2AABEE] text-white shadow-md shadow-sky-500/20'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Mail size={13} />
                        <span>По почте</span>
                      </button>
                    </div>
                  </div>

                  {/* Поле ввода */}
                  {loginMethod === 'phone' ? (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        {t.phoneLabel}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                        <input
                          type="text"
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value)}
                          placeholder={t.phonePlaceholder}
                          className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner font-mono"
                          required
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-gray-400">
                        Код подтверждения придёт на привязанную к номеру почту
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                        {t.emailLabel}
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                        <input
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          placeholder={t.emailPlaceholder}
                          className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                          required
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-gray-400">
                        Код подтверждения придёт на указанную почту
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <span>{t.sending}</span>
                    ) : (
                      <>
                        <span>{t.continueBtn}</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )
            ) : (
              /* ШАГ ВВОДА OTP (LOGIN) */
              <form onSubmit={handleLoginVerify} className="space-y-4">
                <div className="rounded-2xl border border-sky-500/20 bg-[#242f3d]/70 p-3.5 text-center flex items-center justify-center space-x-2 text-xs text-sky-200 shadow-inner">
                  <Mail size={16} className="text-[#2AABEE] flex-shrink-0" />
                  <span>
                    {loginNeedsEmail && linkEmail
                      ? `Код отправлен на почту ${linkEmail}. После подтверждения она будет привязана к аккаунту.`
                      : loginMethod === 'phone' && maskedEmail
                      ? `Код подтверждения отправлен на привязанную почту: ${maskedEmail}. Проверьте «Входящие» или «Спам».`
                      : `Код подтверждения отправлен на почту ${loginEmail || maskedEmail || ''}. Проверьте «Входящие» или «Спам».`}
                  </span>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider text-center">
                    {t.otpLabel}
                  </label>
                  <div
                    className="flex justify-between gap-2"
                    onPaste={(e) => handlePaste(e, setLoginOtpDigits, loginOtpRefs)}
                  >
                    {loginOtpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          loginOtpRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) =>
                          handleDigitChange(
                            idx,
                            e.target.value,
                            loginOtpDigits,
                            setLoginOtpDigits,
                            loginOtpRefs
                          )
                        }
                        onKeyDown={(e) =>
                          handleDigitKeyDown(
                            idx,
                            e,
                            loginOtpDigits,
                            setLoginOtpDigits,
                            loginOtpRefs
                          )
                        }
                        className={`h-13 w-11 sm:w-12 rounded-xl text-center font-mono text-xl font-bold transition-all shadow-inner border ${
                          digit
                            ? 'border-[#2AABEE] bg-[#223347] text-white shadow-[#2AABEE]/20 shadow-md'
                            : 'border-white/10 bg-[#242f3d]/90 text-white focus:border-[#2AABEE] focus:ring-2 focus:ring-[#2AABEE]/25'
                        } focus:outline-none`}
                      />
                    ))}
                  </div>
                </div>

                {/* Таймер повторной отправки */}
                <div className="text-center pt-1">
                  {loginResendTimer > 0 ? (
                    <span className="text-xs text-gray-400 flex items-center justify-center space-x-1">
                      <RotateCcw size={12} className="animate-spin text-gray-500" />
                      <span>{t.resendCodeIn(loginResendTimer)}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleLoginSendCode()}
                      disabled={loading}
                      className="text-xs text-[#2AABEE] hover:underline font-medium transition"
                    >
                      {t.resendCodeBtn}
                    </button>
                  )}
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('input');
                      setLoginOtpDigits(['', '', '', '', '', '']);
                    }}
                    className="w-1/3 rounded-2xl bg-gray-800/90 py-3.5 font-medium text-gray-300 hover:bg-gray-700 transition text-sm"
                  >
                    {t.backBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || loginOtpDigits.join('').length < 6}
                    className="w-2/3 rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50 text-sm"
                  >
                    {loading ? t.checking : t.signInBtn}
                  </button>
                </div>
              </form>
            )}

            {/* ─── КНОПКА ПЕРЕХОДА НА РЕГИСТРАЦИЮ (СНИЗУ ВХОДА) ─── */}
            <div className="mt-7 pt-4 border-t border-white/5 text-center">
              <button
                type="button"
                onClick={() => {
                  setViewMode('register');
                  setRegStep('input');
                }}
                className="text-xs sm:text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline transition-all"
              >
                {t.dontHaveAccount}
              </button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════ */}
        {/* РЕЖИМ 2: ОТДЕЛЬНАЯ РЕГИСТРАЦИЯ                            */}
        {/* ═════════════════════════════════════════════════════════ */}
        {viewMode === 'register' && (
          <div>
            {regStep === 'input' ? (
              <form onSubmit={handleRegisterSendCode} className="space-y-4">
                {/* Имя пользователя */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {t.nameLabel} *
                  </label>
                  <div className="relative">
                    <UserCheck className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={regDisplayName}
                      onChange={(e) => setRegDisplayName(e.target.value)}
                      placeholder={t.namePlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                      required
                    />
                  </div>
                </div>

                {/* Электронная почта (для получения кода) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      {t.emailLabel} *
                    </label>
                    <span className="text-[11px] text-[#2AABEE]">Код придёт на почту</span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                      required
                    />
                  </div>
                </div>

                {/* Номер телефона (обязательно) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      {t.phoneLabel} *
                    </label>
                    <span className="text-[11px] text-gray-400">Обязательно</span>
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder={t.phonePlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Никнейм @username (опционально) */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    {t.usernameLabel} (необязательно)
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder={t.usernamePlaceholder}
                      className="w-full rounded-2xl bg-[#242f3d]/90 py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-500 border border-white/5 focus:border-[#2AABEE] focus:outline-none focus:ring-2 focus:ring-[#2AABEE]/20 transition shadow-inner"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50"
                >
                  {loading ? t.sending : 'Получить код на почту'}
                </button>
              </form>
            ) : (
              /* ШАГ ВВОДА OTP (REGISTER) */
              <form onSubmit={handleRegisterVerify} className="space-y-4">
                <div className="rounded-2xl border border-[#2AABEE]/25 bg-[#2AABEE]/10 p-3.5 text-center space-y-1">
                  <div className="flex items-center justify-center space-x-2 text-xs font-semibold text-sky-300">
                    <Mail size={15} className="text-[#2AABEE]" />
                    <span>Код подтверждения отправлен на почту</span>
                  </div>
                  <div className="text-xs text-white font-mono break-all font-semibold">
                    {regEmail}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Проверьте папку «Входящие» или «Спам».
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-gray-300 uppercase tracking-wider text-center">
                    {t.otpLabel}
                  </label>
                  <div
                    className="flex justify-between gap-2"
                    onPaste={(e) => handlePaste(e, setRegOtpDigits, regOtpRefs)}
                  >
                    {regOtpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          regOtpRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) =>
                          handleDigitChange(
                            idx,
                            e.target.value,
                            regOtpDigits,
                            setRegOtpDigits,
                            regOtpRefs
                          )
                        }
                        onKeyDown={(e) =>
                          handleDigitKeyDown(
                            idx,
                            e,
                            regOtpDigits,
                            setRegOtpDigits,
                            regOtpRefs
                          )
                        }
                        className={`h-13 w-11 sm:w-12 rounded-xl text-center font-mono text-xl font-bold transition-all shadow-inner border ${
                          digit
                            ? 'border-[#2AABEE] bg-[#223347] text-white shadow-[#2AABEE]/20 shadow-md'
                            : 'border-white/10 bg-[#242f3d]/90 text-white focus:border-[#2AABEE] focus:ring-2 focus:ring-[#2AABEE]/25'
                        } focus:outline-none`}
                      />
                    ))}
                  </div>
                </div>

                {/* Таймер повторной отправки */}
                <div className="text-center pt-1">
                  {regResendTimer > 0 ? (
                    <span className="text-xs text-gray-400 flex items-center justify-center space-x-1">
                      <RotateCcw size={12} className="animate-spin text-gray-500" />
                      <span>{t.resendCodeIn(regResendTimer)}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleRegisterSendCode(e)}
                      disabled={loading}
                      className="text-xs text-[#2AABEE] hover:underline font-medium transition"
                    >
                      {t.resendCodeBtn}
                    </button>
                  )}
                </div>

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRegStep('input');
                      setRegOtpDigits(['', '', '', '', '', '']);
                    }}
                    className="w-1/3 rounded-2xl bg-gray-800/90 py-3.5 font-medium text-gray-300 hover:bg-gray-700 transition text-sm"
                  >
                    {t.backBtn}
                  </button>
                  <button
                    type="submit"
                    disabled={loading || regOtpDigits.join('').length < 6}
                    className="w-2/3 rounded-2xl bg-gradient-to-r from-[#2AABEE] to-[#229ed9] py-3.5 font-semibold text-white shadow-lg shadow-sky-500/25 transition-all hover:opacity-95 hover:shadow-sky-500/40 active:scale-[0.99] disabled:opacity-50 text-sm"
                  >
                    {loading ? t.checking : t.registerBtn}
                  </button>
                </div>
              </form>
            )}

            {/* ─── КНОПКА ВОЗВРАТА КО ВХОДУ (СНИЗУ РЕГИСТРАЦИИ) ─── */}
            <div className="mt-7 pt-4 border-t border-white/5 text-center">
              <button
                type="button"
                onClick={() => {
                  setViewMode('login');
                  setLoginStep('input');
                }}
                className="text-xs sm:text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline transition-all"
              >
                {t.alreadyHaveAccount}
              </button>
            </div>
          </div>
        )}

        {/* ─── ПАНЕЛЬ БЫСТРОГО ДЕМО-ВХОДА ДЛЯ ТЕСТИРОВАНИЯ ─── */}
        <div className="mt-6 pt-3 border-t border-white/5">
          <button
            type="button"
            onClick={() => setShowDemoModal(!showDemoModal)}
            className="w-full flex items-center justify-between text-xs text-amber-400/90 hover:text-amber-300 py-1.5 px-2 rounded-xl hover:bg-amber-400/5 transition"
          >
            <span className="flex items-center space-x-1.5 font-medium">
              <Zap size={14} />
              <span>⚡ Быстрый демо-вход (для тестов)</span>
            </span>
            {showDemoModal ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showDemoModal && (
            <div className="mt-2.5 space-y-2 animate-message">
              <button
                type="button"
                onClick={() => handleDemoLogin('alex')}
                disabled={Boolean(demoLoadingUser)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#242f3d]/60 hover:bg-[#2c394b] border border-white/5 transition text-left group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                    А
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Алексей Смирнов</div>
                    <div className="text-[10px] text-gray-400">@alex_lead • Lead Dev</div>
                  </div>
                </div>
                <div className="text-[11px] text-sky-400 group-hover:underline">Войти →</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('anna')}
                disabled={Boolean(demoLoadingUser)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#242f3d]/60 hover:bg-[#2c394b] border border-white/5 transition text-left group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white text-xs">
                    А
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Анна Ковалёва</div>
                    <div className="text-[10px] text-gray-400">@anna_design • Designer</div>
                  </div>
                </div>
                <div className="text-[11px] text-sky-400 group-hover:underline">Войти →</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('guest')}
                disabled={Boolean(demoLoadingUser)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#242f3d]/60 hover:bg-[#2c394b] border border-white/5 transition text-left group"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                    Т
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Тестовый Пользователь</div>
                    <div className="text-[10px] text-gray-400">@guest_tester • Гость</div>
                  </div>
                </div>
                <div className="text-[11px] text-sky-400 group-hover:underline">Войти →</div>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
