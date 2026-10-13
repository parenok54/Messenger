'use client';

import React, { useState, useRef } from 'react';
import { useAuthStore, useLanguageStore } from '@/store/useStore';
import { usersApi } from '@/lib/api';
import { LanguageSelector } from '@/components/LanguageSelector';
import { soundEffects } from '@/lib/sound';
import { pushNotifications } from '@/lib/notifications';
import { X, Camera, User, AtSign, FileText, Check, Loader2, Volume2, VolumeX, Bell, Mail, Phone, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { t } = useLanguageStore();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [email, setEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(soundEffects.getEnabled());
  const [soundVolume, setSoundVolume] = useState(soundEffects.getVolume());

  const [pushEnabled, setPushEnabled] = useState(pushNotifications.getEnabled());
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    pushNotifications.getPermission()
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error('Имя не может быть пустым');
      return;
    }

    setLoading(true);
    try {
      const res = await usersApi.updateMe({
        display_name: displayName.trim(),
        username: username.trim() || undefined,
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
      });
      setUser(res.data);
      toast.success('Профиль успешно обновлен!');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка сохранения профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Выберите изображение (JPG, PNG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Файл слишком большой (максимум 5 МБ)');
      return;
    }

    setUploadingAvatar(true);
    try {
      toast.loading('Загрузка аватара...', { id: 'avatar-upload' });
      const res = await usersApi.uploadAvatar(file);
      setUser(res.data);
      toast.success('Аватар обновлен!', { id: 'avatar-upload' });
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка загрузки аватара', { id: 'avatar-upload' });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#17212b] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <h2 className="text-lg font-semibold text-white">Мой профиль и настройки</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Аватарка */}
        <div className="my-6 flex flex-col items-center">
          <div className="relative group">
            <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#2AABEE] text-3xl font-bold text-white shadow-lg ring-4 ring-gray-800">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{user.display_name?.charAt(0) || 'U'}</span>
              )}

              {uploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                  <Loader2 size={24} className="animate-spin" />
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#2AABEE] text-white shadow-md hover:bg-[#229ed9] transition disabled:opacity-50"
              title="Изменить фото"
            >
              <Camera size={16} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarChange}
              accept="image/*"
              className="hidden"
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">{user.phone}</p>
        </div>

        {/* Форма редактирования данных */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-300">
              Имя пользователя (Display Name)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-500" size={16} />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ваше имя"
                className="w-full rounded-xl bg-[#242f3d] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE]"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-300">
              Username (@никнейм)
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-3 text-gray-500" size={16} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username (без @)"
                className="w-full rounded-xl bg-[#242f3d] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE]"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Другие пользователи смогут находить вас по этому нику
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-300">
              О себе (Bio)
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-gray-500" size={16} />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Расскажите немного о себе..."
                className="w-full rounded-xl bg-[#242f3d] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE] resize-none"
              />
            </div>
          </div>

          {/* Телефон и Электронная почта */}
          <div className="space-y-3 pt-1">
            {user.phone && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-300">
                  Номер телефона
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-gray-500" size={16} />
                  <input
                    type="text"
                    value={user.phone}
                    disabled
                    className="w-full rounded-xl bg-[#1d2633] py-2.5 pl-9 pr-3 text-sm text-gray-400 font-mono border border-white/5 cursor-not-allowed"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-300">
                  Электронная почта (Email)
                </label>
                {!user.email && (
                  <span className="text-[11px] font-semibold text-amber-400 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>Не привязана</span>
                  </span>
                )}
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-500" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@gmail.com"
                  className={`w-full rounded-xl bg-[#242f3d] py-2.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#2AABEE] ${
                    !user.email ? 'border border-amber-500/40 ring-1 ring-amber-500/20' : ''
                  }`}
                />
              </div>
              {!user.email ? (
                <p className="mt-1.5 text-[11px] text-amber-300/90 leading-tight">
                  ⚠️ К вашему аккаунту не привязана почта. Добавьте её, чтобы безопасно входить в систему.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-gray-500">
                  На эту почту приходят проверочные коды при входе
                </p>
              )}
            </div>
          </div>

          {/* Язык интерфейса */}
          <div className="pt-1">
            <label className="mb-1.5 block text-xs font-medium text-gray-300">
              Язык приложения / Колдонмонун тили
            </label>
            <LanguageSelector />
          </div>

          {/* Звуковые эффекты */}
          <div className="pt-3 border-t border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {soundEnabled ? (
                  <Volume2 size={16} className="text-[#2AABEE]" />
                ) : (
                  <VolumeX size={16} className="text-gray-500" />
                )}
                <div>
                  <span className="text-xs font-medium text-white block">{t.soundEffects}</span>
                  <span className="text-[11px] text-gray-400">{t.soundEnabled}</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setSoundEnabled(val);
                    soundEffects.setEnabled(val);
                    if (val) soundEffects.playSent();
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2AABEE]"></div>
              </label>
            </div>

            {soundEnabled && (
              <div className="space-y-2.5 bg-[#242f3d]/70 p-3 rounded-xl border border-gray-800">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{t.soundVolume}</span>
                  <span className="font-mono text-cyan-300">{Math.round(soundVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={soundVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSoundVolume(val);
                    soundEffects.setVolume(val);
                  }}
                  className="w-full accent-[#2AABEE] cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />

                {/* Кнопки прослушивания */}
                <div className="flex items-center space-x-1.5 pt-1">
                  <span className="text-[11px] text-gray-400 mr-1">{t.testSound}:</span>
                  <button
                    type="button"
                    onClick={() => soundEffects.playSent()}
                    className="px-2 py-1 text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition border border-gray-700 flex items-center space-x-1"
                    title="Звук отправки"
                  >
                    <span>↗️</span>
                    <span>{t.soundSent}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEffects.playReceived()}
                    className="px-2 py-1 text-[11px] font-medium bg-[#2AABEE]/20 hover:bg-[#2AABEE]/30 text-cyan-300 rounded-lg transition border border-[#2AABEE]/30 flex items-center space-x-1"
                    title="Звук входящего сообщения"
                  >
                    <span>🔔</span>
                    <span>{t.soundReceived}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => soundEffects.playPin()}
                    className="px-2 py-1 text-[11px] font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition border border-amber-500/30 flex items-center space-x-1"
                    title="Звук закрепления"
                  >
                    <span>📌</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Push-уведомления */}
          <div className="pt-3 border-t border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell
                  size={16}
                  className={pushPermission === 'granted' ? 'text-emerald-400' : 'text-[#2AABEE]'}
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium text-white block">{t.pushNotifications}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        pushPermission === 'granted'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : pushPermission === 'denied'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-gray-800 text-gray-400'
                      }`}
                    >
                      {pushPermission === 'granted'
                        ? t.pushPermissionGranted
                        : pushPermission === 'denied'
                        ? t.pushPermissionDenied
                        : t.pushPermissionDefault}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400">{t.pushNotificationsDesc}</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushEnabled && pushPermission === 'granted'}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    if (val && pushPermission !== 'granted') {
                      const p = await pushNotifications.requestPermission();
                      setPushPermission(p);
                      if (p !== 'granted') return;
                    }
                    setPushEnabled(val);
                    pushNotifications.setEnabled(val);
                  }}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2AABEE]"></div>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              {pushPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={async () => {
                    const p = await pushNotifications.requestPermission();
                    setPushPermission(p);
                    if (p === 'granted') {
                      setPushEnabled(true);
                      toast.success(t.pushPermissionGranted);
                    } else if (p === 'denied') {
                      toast.error(t.pushPermissionDenied);
                    }
                  }}
                  className="flex-1 py-1.5 px-3 text-xs font-medium bg-[#2AABEE] hover:bg-[#229ed9] text-white rounded-xl transition flex items-center justify-center space-x-1.5"
                >
                  <Bell size={13} />
                  <span>{t.enablePushBtn}</span>
                </button>
              )}

              {pushPermission === 'granted' && (
                <button
                  type="button"
                  onClick={() => {
                    pushNotifications.show({
                      title: t.testPushTitle,
                      body: t.testPushBody,
                    });
                    soundEffects.playReceived();
                    toast.success('Тестовое уведомление отправлено!');
                  }}
                  className="py-1 px-3 text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition border border-gray-700 flex items-center space-x-1"
                >
                  <span>🔔</span>
                  <span>{t.testPushBtn}</span>
                </button>
              )}
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 rounded-xl bg-gray-800 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-700 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || uploadingAvatar}
              className="flex w-2/3 items-center justify-center space-x-2 rounded-xl bg-[#2AABEE] py-2.5 text-sm font-semibold text-white hover:bg-[#229ed9] transition disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Check size={16} />
                  <span>Сохранить</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
