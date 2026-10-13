'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useChatStore, useLanguageStore } from '@/store/useStore';
import { usersApi, chatsApi } from '@/lib/api';
import { ChatList } from '@/components/chat/ChatList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { CreateChatModal } from '@/components/chat/CreateChatModal';
import { ProfileModal } from '@/components/chat/ProfileModal';
import { CallModal } from '@/components/chat/CallModal';
import { IncomingCallBanner } from '@/components/chat/IncomingCallBanner';
import { WebSocketProvider } from '@/context/WebSocketContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Search, LogOut, Plus, Settings, X, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MainPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const initToken = useAuthStore((s) => s.initToken);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useLanguageStore();

  const setChats = useChatStore((s) => s.setChats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const activeCall = useChatStore((s) => s.activeCall);
  const setActiveCall = useChatStore((s) => s.setActiveCall);

  const loadChats = useCallback(async () => {
    try {
      const res = await chatsApi.list();
      setChats(res.data);
    } catch {
      // Ошибку покажет глобальный обработчик (401 → разлогин)
    }
  }, [setChats]);

  // Единственное WebSocket соединение для всего приложения
  const wsContext = useWebSocket(loadChats);

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      toast.success('Приложение установлено!');
    }
  };

  useEffect(() => {
    initToken();
    setMounted(true);
  }, [initToken]);

  useEffect(() => {
    if (!mounted) return;

    const currentToken = localStorage.getItem('access_token');
    if (!currentToken) {
      router.push('/login');
      return;
    }

    // Загрузить текущего пользователя и его чаты
    usersApi
      .getMe()
      .then((res) => {
        setUser(res.data);
        loadChats();
      })
      .catch((err) => {
        // Разлогиниваем только если сервер явно ответил 401 Unauthorized
        if (err.response?.status === 401) {
          logout();
          router.push('/login');
        } else {
          console.warn('Temporary connection issue, keeping session');
        }
      });
  }, [mounted, router, setUser, logout, loadChats]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await usersApi.search(query);
      setSearchResults(res.data);
    } catch {
      // Игнорируем ошибку при наборе
    }
  };

  const handleCreatePrivateChat = async (targetUserId: string) => {
    try {
      const res = await chatsApi.create({
        type: 'private',
        member_ids: [targetUserId],
      });
      const updatedList = await chatsApi.list();
      setChats(updatedList.data);
      setActiveChatId(res.data.id);
      setSearchQuery('');
      setSearchResults([]);
      toast.success('Чат открыт');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка создания чата');
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0e1621] text-gray-400">
        Загрузка...
      </div>
    );
  }

  return (
    <WebSocketProvider value={wsContext}>
      <div className="flex h-screen w-screen overflow-hidden bg-[#0e1621]">
      {/* Sidebar (Левая колонка) */}
      <div
        className={`w-full md:w-96 flex-shrink-0 flex-col border-r border-gray-800 bg-[#17212b] ${
          activeChatId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
          <div
            onClick={() => setIsProfileOpen(true)}
            className="flex cursor-pointer items-center space-x-3 rounded-xl p-1.5 hover:bg-gray-800/60 transition group min-w-0"
            title="Настройки профиля"
          >
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#2AABEE] font-bold text-white shadow">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.display_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{user?.display_name?.charAt(0) || 'U'}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-white group-hover:text-[#2AABEE] transition">
                {user?.display_name || user?.phone || 'Мессенджер'}
              </h1>
              <p className="text-xs text-gray-400 truncate">
                {user?.username ? `@${user.username}` : user?.phone}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {deferredPrompt && (
              <button
                onClick={handleInstallPWA}
                title="Установить приложение"
                className="rounded-lg p-2 text-cyan-400 bg-[#2AABEE]/15 hover:bg-[#2AABEE]/25 transition"
              >
                <Smartphone size={19} />
              </button>
            )}
            <button
              onClick={() => setIsProfileOpen(true)}
              title={t.profileSettings}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition"
            >
              <Settings size={19} />
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              title={t.newChat}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-[#2AABEE] transition"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              title={t.logout}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-red-400 transition"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-800/80">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full rounded-xl bg-[#242f3d] py-2 pl-9 pr-9 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1.5 focus:ring-[#2AABEE] transition"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Результаты поиска */}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl bg-[#242f3d] p-1.5 space-y-1 shadow-2xl border border-gray-700/60">
              <p className="px-2.5 py-1 text-[11px] font-semibold text-[#2AABEE] uppercase tracking-wider">
                {t.foundUsers}
              </p>
              {searchResults.map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleCreatePrivateChat(u.id)}
                  className="flex cursor-pointer items-center space-x-2.5 rounded-lg px-2.5 py-2 hover:bg-[#2b5278] transition"
                >
                  <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 font-bold text-white text-xs">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.display_name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      u.display_name.charAt(0).toUpperCase()
                    )}
                    {u.is_online && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#242f3d]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{u.display_name}</p>
                    <p className="truncate text-xs text-gray-400">@{u.username || 'user'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Список чатов */}
        <ChatList onSelectChat={(chat) => setActiveChatId(chat.id)} />
      </div>

      {/* Main Chat Area (Правая колонка) */}
      <div
        className={`flex-1 flex-col h-full min-w-0 ${
          activeChatId ? 'flex' : 'hidden md:flex'
        }`}
      >
        <ChatWindow />
      </div>

      {/* Модальное окно создания группы/канала */}
      <CreateChatModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onChatCreated={async (newChatId) => {
          const updatedList = await chatsApi.list();
          setChats(updatedList.data);
          setActiveChatId(newChatId);
        }}
      />

      {/* Всплывающее уведомление входящего звонка */}
      <IncomingCallBanner />

      {/* Окно активного видео/аудио звонка */}
      {activeCall && (
        <CallModal call={activeCall} onClose={() => setActiveCall(null)} />
      )}

      {/* Модальное окно профиля и настроек */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
    </WebSocketProvider>
  );
}
