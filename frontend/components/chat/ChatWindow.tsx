'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  ChangeEvent,
  FormEvent,
} from 'react';
import { useAuthStore, useChatStore, useLanguageStore } from '@/store/useStore';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { messagesApi, chatsApi } from '@/lib/api';
import { formatUserStatus } from '@/lib/formatStatus';
import { Message, Reaction, ChatMember } from '@/types';
import { Lang } from '@/lib/i18n';
import { soundEffects } from '@/lib/sound';
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  Square,
  MoreVertical,
  Check,
  CheckCheck,
  Pencil,
  Trash2,
  X,
  Play,
  Pause,
  Phone,
  Video,
  Reply,
  Pin,
  PinOff,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { EmptyChatState } from './EmptyChatState';
import { VoiceWaveformPlayer } from './VoiceWaveformPlayer';
import { MediaLightboxModal, MediaItem } from './MediaLightboxModal';
import { ChatInfoModal } from './ChatInfoModal';

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getMemberBadge(member?: ChatMember | null, lang: Lang = 'ru') {
  if (!member) return null;
  const isOwner = member.role === 'owner';
  const isAdmin = member.role === 'admin';

  if (!isOwner && !isAdmin && !member.custom_role && !member.custom_title) {
    return null;
  }

  const roleType = isOwner ? 'owner' : 'admin';

  // 1. Пользовательский титул
  if (member.custom_title) {
    return {
      role: roleType,
      text: member.custom_title,
      fullTitle: isOwner
        ? (lang === 'ky' ? 'Чаттын ээси' : lang === 'en' ? 'Chat Owner' : 'Владелец чата')
        : (lang === 'ky' ? 'Чаттын администратору' : lang === 'en' ? 'Chat Administrator' : 'Администратор чата'),
      description: isOwner
        ? (lang === 'ky' ? 'Чаттын ээси, толук башкаруу укугу менен' : lang === 'en' ? 'Chat Owner with full management access' : 'Владелец чата с полным доступом ко всем настройкам и управлению')
        : (lang === 'ky' ? 'Модерация жана башкаруу укугу бар администратор' : lang === 'en' ? 'Administrator with moderation and management rights' : 'Администратор с правами модерации и управления участниками'),
      icon: isOwner ? '👑' : isAdmin ? '🛡️' : '🏷️',
      color: isOwner ? '#f59e0b' : '#2AABEE',
      className: isOwner
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-blue-500/15 text-[#2AABEE] border-blue-500/30',
      customColor: Boolean(member.custom_role?.color),
    };
  }

  // 2. Кастомная роль
  if (member.custom_role) {
    return {
      role: roleType,
      text: member.custom_role.name,
      fullTitle: isOwner
        ? (lang === 'ky' ? 'Чаттын ээси' : lang === 'en' ? 'Chat Owner' : 'Владелец чата')
        : (lang === 'ky' ? 'Чаттын администратору' : lang === 'en' ? 'Chat Administrator' : 'Администратор чата'),
      description: isOwner
        ? (lang === 'ky' ? 'Чаттын ээси, толук башкаруу укугу менен' : lang === 'en' ? 'Chat Owner with full management access' : 'Владелец чата с полным доступом ко всем настройкам и управлению')
        : (lang === 'ky' ? 'Модерация жана башкаруу укугу бар администратор' : lang === 'en' ? 'Administrator with moderation and management rights' : 'Администратор с правами модерации и управления участниками'),
      icon: member.custom_role.can_manage_roles || isOwner ? '👑' : '🛡️',
      color: member.custom_role.color || (isOwner ? '#f59e0b' : '#2AABEE'),
      className: isOwner
        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        : 'bg-blue-500/15 text-[#2AABEE] border-blue-500/30',
      customColor: true,
    };
  }

  // 3. Владелец
  if (isOwner) {
    return {
      role: 'owner',
      text: lang === 'ky' ? 'Владелец' : lang === 'en' ? 'Owner' : 'Владелец',
      fullTitle: lang === 'ky' ? 'Чаттын ээси' : lang === 'en' ? 'Chat Owner' : 'Владелец чата',
      description: lang === 'ky' ? 'Чаттын ээси, толук башкаруу укугу менен' : lang === 'en' ? 'Chat Owner with full management access' : 'Владелец чата с полным доступом ко всем настройкам и управлению',
      icon: '👑',
      className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      customColor: false,
      color: '#f59e0b',
    };
  }

  // 4. Администратор
  if (isAdmin) {
    return {
      role: 'admin',
      text: lang === 'ky' ? 'Админ' : lang === 'en' ? 'Admin' : 'Админ',
      fullTitle: lang === 'ky' ? 'Чаттын администратору' : lang === 'en' ? 'Chat Administrator' : 'Администратор чата',
      description: lang === 'ky' ? 'Модерация жана башкаруу укугу бар администратор' : lang === 'en' ? 'Administrator with moderation and management rights' : 'Администратор с правами модерации и управления участниками',
      icon: '🛡️',
      className: 'bg-blue-500/20 text-cyan-300 border-blue-500/30',
      customColor: false,
      color: '#2AABEE',
    };
  }

  return null;
}

function formatDateBadge(dateStr: string, t: any) {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return t.today;
    if (isYesterday(d)) return t.yesterday;
    return format(d, 'd MMMM', { locale: ru });
  } catch {
    return '';
  }
}

function isDifferentDay(d1: string, d2?: string) {
  if (!d2) return true;
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() !== b.getFullYear() ||
    a.getMonth() !== b.getMonth() ||
    a.getDate() !== b.getDate()
  );
}

const QUICK_REACTIONS = ['❤️', '👍', '🔥', '😂', '👏', '🎉', '🤔', '😢'];

function groupReactions(reactions: Reaction[] | undefined, currentUserId: string | undefined) {
  if (!reactions || reactions.length === 0) return [];
  const map = new Map<string, { count: number; hasReacted: boolean }>();
  for (const r of reactions) {
    const item = map.get(r.emoji) || { count: 0, hasReacted: false };
    item.count += 1;
    if (r.user_id === currentUserId) item.hasReacted = true;
    map.set(r.emoji, item);
  }
  return Array.from(map.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    hasReacted: data.hasReacted,
  }));
}

const POPULAR_EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '😘', '😎', '🥳',
  '👍', '👎', '❤️', '🔥', '🎉', '✨', '🚀', '💯',
  '🙌', '👏', '🤝', '🤔', '👀', '🥺', '😭', '🤯',
];

const EMPTY_ARRAY: any[] = [];

export function ChatWindow() {
  const activeChatId = useChatStore((s) => s.activeChatId);
  const setActiveChatId = useChatStore((s) => s.setActiveChatId);
  const chats = useChatStore((s) => s.chats);
  const allMessages = useChatStore((s) => s.messages);
  const setMessages = useChatStore((s) => s.setMessages);
  const deleteMessageStore = useChatStore((s) => s.deleteMessage);
  const markChatRead = useChatStore((s) => s.markChatRead);
  const setChatPinnedMessage = useChatStore((s) => s.setChatPinnedMessage);
  const setActiveCall = useChatStore((s) => s.setActiveCall);
  const currentUser = useAuthStore((s) => s.user);
  const allTypingUsers = useChatStore((s) => s.typingUsers);
  const { t, lang } = useLanguageStore();

  const messages = activeChatId ? (allMessages[activeChatId] || EMPTY_ARRAY) : EMPTY_ARRAY;
  const typingUsers = activeChatId ? (allTypingUsers[activeChatId] || EMPTY_ARRAY) : EMPTY_ARRAY;

  const { sendMessage, sendTyping, sendRead, sendReaction, sendPinMessage } = useWebSocketContext();

  // Состояния ввода
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [activeBadgeMessageId, setActiveBadgeMessageId] = useState<string | null>(null);

  // Закрепление сообщений
  const handlePinMessage = async (messageId: string) => {
    if (!activeChatId) return;
    try {
      const res = await chatsApi.pinMessage(activeChatId, messageId);
      const pinnedMsg = res.data.pinned_message || messages.find((m: Message) => m.id === messageId) || null;
      setChatPinnedMessage(activeChatId, messageId, pinnedMsg);
      sendPinMessage(activeChatId, messageId);
      soundEffects.playPin();
      toast.success(lang === 'ky' ? 'Билдирүү бекемделди' : lang === 'en' ? 'Message pinned' : 'Сообщение закреплено');
    } catch {
      toast.error('Не удалось закрепить сообщение');
    }
  };

  const handleUnpinMessage = async () => {
    if (!activeChatId) return;
    try {
      await chatsApi.unpinMessage(activeChatId);
      setChatPinnedMessage(activeChatId, null, null);
      sendPinMessage(activeChatId, null);
      toast.success(lang === 'ky' ? 'Бекемдөө алынды' : lang === 'en' ? 'Message unpinned' : 'Сообщение откреплено');
    } catch {
      toast.error('Не удалось открепить сообщение');
    }
  };

  // Панель информации о чате
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Поиск по сообщениям внутри чата
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  const matchedMessages = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return messages.filter((m: Message) => m.content && m.content.toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const goToNextMatch = () => {
    if (matchedMessages.length === 0) return;
    const nextIdx = (currentSearchIndex + 1) % matchedMessages.length;
    setCurrentSearchIndex(nextIdx);
    scrollToMessage(matchedMessages[nextIdx].id);
  };

  const goToPrevMatch = () => {
    if (matchedMessages.length === 0) return;
    const prevIdx = (currentSearchIndex - 1 + matchedMessages.length) % matchedMessages.length;
    setCurrentSearchIndex(prevIdx);
    scrollToMessage(matchedMessages[prevIdx].id);
  };

  // Полноэкранный просмотр медиа (Lightbox)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const chatMediaItems: MediaItem[] = useMemo(() => {
    return messages
      .filter((m: Message) => (m.type === 'image' || m.type === 'video') && m.file_url)
      .map((m: Message) => ({
        id: m.id,
        url: m.file_url!,
        type: m.type as 'image' | 'video',
        fileName: m.file_name,
        senderName: m.sender?.display_name || m.sender?.username,
        createdAt: m.created_at,
      }));
  }, [messages]);

  const openLightbox = (msgId: string) => {
    const idx = chatMediaItems.findIndex((item) => item.id === msgId);
    if (idx !== -1) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    if (!activeChatId) return;
    sendReaction(activeChatId, messageId, emoji);
  };

  // Скролл к цитируемому или найденному сообщению
  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const bubble = el.querySelector('.message-bubble');
      if (bubble) {
        bubble.classList.add('ring-2', 'ring-[#2AABEE]');
        setTimeout(() => bubble.classList.remove('ring-2', 'ring-[#2AABEE]'), 1500);
      }
    }
  };

  // Голосовые сообщения
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find((c) => c.id === activeChatId);

  // Права на отправку сообщений (в каналах только владелец/админ могут публиковать)
  const currentMember = activeChat?.members.find((m) => m.user.id === currentUser?.id);
  const canPost = activeChat?.type !== 'channel' || currentMember?.role === 'owner' || currentMember?.role === 'admin';

  // Загрузка истории при смене чата
  useEffect(() => {
    if (!activeChatId) return;
    setLoading(true);
    setEditingMessage(null);
    setReplyingMessage(null);
    setActiveReactionMessageId(null);
    setActiveBadgeMessageId(null);
    setInputText('');
    setShowEmojiPicker(false);
    messagesApi
      .getHistory(activeChatId)
      .then((res) => {
        setMessages(activeChatId, res.data.items);
        // Помечаем чат как прочитанный
        const items = res.data.items;
        chatsApi.markAsRead(activeChatId).catch(() => {});
        markChatRead(activeChatId);
        const lastMsg = items[items.length - 1];
        if (lastMsg) sendRead(activeChatId, lastMsg.id);
      })
      .catch(() => {
        toast.error('Не удалось загрузить историю сообщений');
      })
      .finally(() => setLoading(false));
  }, [activeChatId, setMessages]);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Очистка таймера записи при размонтировании
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  // Отправка или редактирование текстового сообщения
  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatId) return;

    if (editingMessage) {
      try {
        await messagesApi.edit(activeChatId, editingMessage.id, inputText.trim());
        setEditingMessage(null);
        setInputText('');
      } catch {
        toast.error('Не удалось изменить сообщение');
      }
    } else {
      sendMessage(activeChatId, inputText.trim(), replyingMessage?.id);
      soundEffects.playSent();
      setInputText('');
      setReplyingMessage(null);
      sendTyping(activeChatId, false);
    }
  };

  // Удаление сообщения
  const handleDeleteMessage = async (msgId: string) => {
    if (!activeChatId) return;
    try {
      await messagesApi.delete(activeChatId, msgId);
      deleteMessageStore(activeChatId, msgId);
      setActiveMenuMessageId(null);
      toast.success('Сообщение удалено');
    } catch {
      toast.error('Не удалось удалить сообщение');
    }
  };

  // Начало редактирования
  const handleStartEdit = (msg: Message) => {
    setEditingMessage(msg);
    setReplyingMessage(null);
    setInputText(msg.content || '');
    setActiveMenuMessageId(null);
  };

  // Отмена редактирования
  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  // Загрузка файла/изображения
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('Файл слишком большой (максимум 25 МБ)');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      toast.loading('Загрузка файла...', { id: 'upload' });
      await messagesApi.uploadFile(activeChatId, file, replyingMessage?.id);
      soundEffects.playSent();
      toast.success('Файл отправлен', { id: 'upload' });
      setReplyingMessage(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Ошибка отправки файла', { id: 'upload' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Запись голосового сообщения
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/aac')) {
          mimeType = 'audio/aac';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      mediaRecorder.onstop = async () => {
        const actualMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const cleanMime = actualMime.split(';')[0];
        const ext = cleanMime.includes('mp4') || cleanMime.includes('aac') ? 'm4a' : cleanMime.includes('ogg') ? 'ogg' : 'webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: cleanMime });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.${ext}`, {
          type: cleanMime,
        });
        if (activeChatId) {
          try {
            toast.loading('Отправка голосового сообщения...', { id: 'voice' });
            await messagesApi.uploadFile(activeChatId, audioFile, replyingMessage?.id);
            soundEffects.playSent();
            toast.success('Голосовое отправлено', { id: 'voice' });
            setReplyingMessage(null);
          } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Ошибка отправки аудио', { id: 'voice' });
          }
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      soundEffects.playRecordStart();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error('Нет доступа к микрофону');
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) {
        mediaRecorderRef.current.onstop = null;
        toast('Запись отменена');
      }
      mediaRecorderRef.current.stop();
      soundEffects.playRecordStop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  if (!activeChatId || !activeChat) {
    return <EmptyChatState placeholderText={t.selectChatPlaceholder} />;
  }

  const otherMember = activeChat?.type === 'private'
    ? activeChat.members.find((m) => m.user.id !== currentUser?.id)
    : null;

  const startCall = (isVideo: boolean) => {
    if (!otherMember || !activeChatId) return;
    setActiveCall({
      targetUserId: otherMember.user.id,
      targetUserName: otherMember.user.display_name || otherMember.user.username || 'Собеседник',
      chatId: activeChatId,
      isVideo: isVideo,
      isIncoming: false,
    });
  };

  return (
    <div
      className="flex h-full flex-1 flex-col bg-[#0e1621]"
      onClick={() => {
        if (activeMenuMessageId) setActiveMenuMessageId(null);
        if (activeReactionMessageId) setActiveReactionMessageId(null);
        if (activeBadgeMessageId) setActiveBadgeMessageId(null);
      }}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-800 bg-[#17212b] px-4 md:px-6">
        <div className="flex items-center space-x-2 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setActiveChatId(null);
            }}
            className="md:hidden -ml-1 p-2 rounded-xl text-gray-300 hover:text-white hover:bg-gray-800/80 transition active:scale-95 flex-shrink-0"
            title="Назад ко всем чатам"
          >
            <ArrowLeft size={20} />
          </button>

          <div
            onClick={() => setIsInfoOpen(true)}
            className="flex items-center space-x-3 cursor-pointer select-none rounded-xl p-1 transition hover:bg-gray-800/40 min-w-0"
            title={t.chatInfo}
          >
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 font-bold text-white shadow">
            {activeChat.type === 'private' && otherMember?.user.avatar_url ? (
              <img
                src={otherMember.user.avatar_url}
                alt={otherMember.user.display_name}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              (activeChat.title || otherMember?.user.display_name || 'Ч').charAt(0).toUpperCase()
            )}
            {activeChat.type === 'private' && otherMember?.user.is_online && (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-[#17212b]" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-white group-hover:text-[#2AABEE] transition">
              {activeChat.title || otherMember?.user.display_name || 'Чат'}
            </h2>
            <p className="text-xs">
              {typingUsers.length > 0 ? (
                <span className="text-[#2AABEE] font-medium animate-pulse">
                  {t.typing}
                </span>
              ) : activeChat.type === 'private' ? (
                (() => {
                  const status = formatUserStatus(otherMember?.user, lang);
                  return (
                    <span className={status.isOnline ? 'text-[#2AABEE] font-medium' : 'text-gray-400'}>
                      {status.text}
                    </span>
                  );
                })()
              ) : (
                (() => {
                  const onlineCount = activeChat.members.filter((m) => m.user.is_online).length;
                  return (
                    <span className="text-gray-400">
                      {activeChat.type === 'channel'
                        ? t.subscribersCount(activeChat.members.length)
                        : t.membersCount(activeChat.members.length, onlineCount)}
                    </span>
                  );
                })()
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
          {activeChat.type === 'private' && otherMember && (
            <>
              <button
                type="button"
                onClick={() => startCall(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-emerald-400 transition"
                title="Аудиозвонок"
              >
                <Phone size={19} />
              </button>
              <button
                type="button"
                onClick={() => startCall(true)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-[#2AABEE] transition"
                title="Видеозвонок"
              >
                <Video size={19} />
              </button>
            </>
          )}
          {/* In-Chat Search Button */}
          <button
            type="button"
            onClick={() => {
              setIsSearchOpen((prev) => !prev);
              if (isSearchOpen) setSearchQuery('');
            }}
            className={`rounded-lg p-2 transition ${
              isSearchOpen
                ? 'bg-[#2AABEE]/20 text-[#2AABEE]'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
            title={t.searchInChat}
          >
            <Search size={19} />
          </button>

          <button
            type="button"
            onClick={() => setIsInfoOpen(true)}
            className="text-gray-400 hover:text-white transition p-2 rounded-lg hover:bg-gray-800"
            title={t.chatInfo}
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* In-Chat Search Bar */}
      {isSearchOpen && (
        <div className="flex items-center justify-between border-b border-gray-800 bg-[#17212b]/95 px-4 py-2 backdrop-blur-md animate-menu-in">
          <div className="flex flex-1 items-center space-x-2.5">
            <Search size={16} className="text-[#2AABEE]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholderChat}
              className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex items-center space-x-2">
            {searchQuery && (
              <span className="text-xs text-gray-400 px-2 py-0.5 rounded bg-black/20">
                {matchedMessages.length > 0
                  ? t.searchResultsCount(currentSearchIndex + 1, matchedMessages.length)
                  : t.searchNoResults}
              </span>
            )}
            {matchedMessages.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={goToPrevMatch}
                  className="p-1 rounded text-gray-300 hover:text-white hover:bg-gray-800 transition"
                  title="Предыдущее"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={goToNextMatch}
                  className="p-1 rounded text-gray-300 hover:text-white hover:bg-gray-800 transition"
                  title="Следующее"
                >
                  <ChevronDown size={16} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Pinned Message Banner */}
      {activeChat?.pinned_message && !activeChat.pinned_message.is_deleted && (
        <div
          onClick={() => scrollToMessage(activeChat.pinned_message!.id)}
          className="flex items-center justify-between border-b border-gray-800/80 bg-[#17212b]/90 px-4 py-2 hover:bg-[#1f2b38] transition cursor-pointer z-10 backdrop-blur-md"
        >
          <div className="flex items-center space-x-3 min-w-0">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#2AABEE]/15 text-[#2AABEE]">
              <Pin size={14} className="rotate-45" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-[#2AABEE] truncate">
                {t.pinnedMessage}
              </span>
              <span className="text-xs text-gray-300 truncate">
                {activeChat.pinned_message.sender?.display_name || activeChat.pinned_message.sender?.username || 'Собеседник'}:{' '}
                {activeChat.pinned_message.content || (
                  activeChat.pinned_message.type === 'image'
                    ? t.photoAttachment
                    : activeChat.pinned_message.type === 'voice' || activeChat.pinned_message.type === 'audio'
                    ? t.voiceAttachment
                    : t.fileAttachment
                )}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUnpinMessage();
            }}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition"
            title={t.unpinBtn}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 tg-chat-bg">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="date-badge px-4 py-1.5 rounded-full text-xs text-gray-400">
              Загрузка сообщений...
            </span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender?.id === currentUser?.id;
            const isMenuOpen = activeMenuMessageId === msg.id;
            const isReactionOpen = activeReactionMessageId === msg.id;
            const isBadgeOpen = activeBadgeMessageId === msg.id;
            const reactionGroups = groupReactions(msg.reactions, currentUser?.id);
            const prevMsg = index > 0 ? messages[index - 1] : undefined;
            const showDateBadge = isDifferentDay(msg.created_at, prevMsg?.created_at);

            const otherMbr = activeChat?.members.find(
              (m) => m.user.id !== currentUser?.id,
            );
            const isRead =
              otherMbr?.last_read_at
                ? new Date(otherMbr.last_read_at) >= new Date(msg.created_at)
                : false;

            return (
              <React.Fragment key={msg.id}>
                {/* Плашка даты по центру */}
                {showDateBadge && (
                  <div className="flex justify-center my-3 sticky top-2 z-10 select-none">
                    <span className="date-badge px-3.5 py-1 rounded-full text-xs font-medium text-gray-300">
                      {formatDateBadge(msg.created_at, t)}
                    </span>
                  </div>
                )}

                <div
                  id={`msg-${msg.id}`}
                  className={`relative group flex items-end space-x-1.5 animate-message transition-all duration-300 ${
                    isMe ? 'justify-end' : 'justify-start'
                  } ${isMenuOpen || isReactionOpen || isBadgeOpen ? 'z-50' : 'z-0'}`}
                >
                  {/* Аватарка отправителя для входящих в группах */}
                  {!isMe && activeChat.type !== 'private' && (
                    <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-600 to-blue-400 text-[11px] font-bold text-white shadow-sm mb-0.5">
                      {msg.sender?.avatar_url ? (
                        <img
                          src={msg.sender.avatar_url}
                          alt={msg.sender.display_name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        (msg.sender?.display_name || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                  )}

                  {/* Блок действий в свободном пространстве (снаружи сообщения) */}
                  <div
                    className={`relative flex items-center space-x-1 mb-1 flex-shrink-0 transition-opacity duration-200 select-none ${
                      isMe ? 'order-first mr-1.5' : 'order-last ml-1.5'
                    } ${isMenuOpen || isReactionOpen ? 'opacity-100 z-30' : 'opacity-0 group-hover:opacity-100'}`}
                  >
                    {/* Кнопка реакции */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReactionMessageId(isReactionOpen ? null : msg.id);
                        setActiveMenuMessageId(null);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md transition active:scale-95 ${
                        isReactionOpen
                          ? 'bg-[#2AABEE] text-white'
                          : 'bg-[#1c2733]/90 text-gray-300 hover:text-[#2AABEE] hover:bg-[#242f3d]'
                      }`}
                      title={t.reactionBtn}
                    >
                      <Smile size={13} />
                    </button>

                    {/* Кнопка быстрого ответа */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReplyingMessage(msg);
                        setEditingMessage(null);
                        setActiveMenuMessageId(null);
                        setActiveReactionMessageId(null);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1c2733]/90 text-gray-300 hover:text-[#2AABEE] hover:bg-[#242f3d] shadow-md transition active:scale-95"
                      title={t.replyBtn}
                    >
                      <Reply size={13} />
                    </button>

                    {/* Кнопка вызова меню опций */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                        setActiveReactionMessageId(null);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full shadow-md transition active:scale-95 ${
                        isMenuOpen
                          ? 'bg-[#2AABEE] text-white'
                          : 'bg-[#1c2733]/90 text-gray-300 hover:text-white hover:bg-[#242f3d]'
                      }`}
                      title="Опции"
                    >
                      <MoreVertical size={13} />
                    </button>

                    {/* Всплывающая плашка реакций в свободном пространстве */}
                    {isReactionOpen && (
                      <div
                        className={`absolute z-50 flex items-center space-x-1 rounded-full bg-[#242f3d]/95 px-2 py-1 shadow-2xl border border-gray-700/80 backdrop-blur-xl animate-menu-in ${
                          isMe ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'
                        } ${index < 2 ? 'top-9' : 'bottom-9'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {QUICK_REACTIONS.map((emoji) => {
                          const hasThis = (msg.reactions || []).some(
                            (r: Reaction) => r.emoji === emoji && r.user_id === currentUser?.id
                          );
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                handleToggleReaction(msg.id, emoji);
                                setActiveReactionMessageId(null);
                              }}
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-base hover:scale-125 transition-transform active:scale-95 ${
                                hasThis
                                  ? 'bg-[#2AABEE]/30 ring-1 ring-[#2AABEE]'
                                  : 'hover:bg-white/10'
                              }`}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Выпадающее контекстное меню в свободном пространстве */}
                    {isMenuOpen && (
                      <div
                        className={`absolute z-50 w-48 rounded-2xl bg-[#242f3d]/95 p-1.5 shadow-2xl border border-gray-700/80 backdrop-blur-xl animate-menu-in ${
                          isMe ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'
                        } ${index < 2 ? 'top-9' : 'bottom-9'}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Полоска быстрых реакций вверху меню */}
                        <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-gray-700/60">
                          {QUICK_REACTIONS.slice(0, 6).map((emoji) => {
                            const hasThis = (msg.reactions || []).some(
                              (r: Reaction) => r.emoji === emoji && r.user_id === currentUser?.id
                            );
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  handleToggleReaction(msg.id, emoji);
                                  setActiveMenuMessageId(null);
                                }}
                                className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm hover:scale-125 transition-transform active:scale-95 ${
                                  hasThis ? 'bg-[#2AABEE]/30 ring-1 ring-[#2AABEE]' : 'hover:bg-white/10'
                                }`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => {
                            setReplyingMessage(msg);
                            setEditingMessage(null);
                            setActiveMenuMessageId(null);
                          }}
                          className="flex w-full items-center space-x-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-200 hover:bg-[#2b5278] transition"
                        >
                          <Reply size={14} className="text-[#2AABEE]" />
                          <span>{t.replyBtn}</span>
                        </button>

                        <button
                          onClick={() => {
                            if (activeChat.pinned_message_id === msg.id) {
                              handleUnpinMessage();
                            } else {
                              handlePinMessage(msg.id);
                            }
                            setActiveMenuMessageId(null);
                          }}
                          className="flex w-full items-center space-x-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-200 hover:bg-[#2b5278] transition"
                        >
                          {activeChat.pinned_message_id === msg.id ? (
                            <>
                              <PinOff size={14} className="text-amber-400" />
                              <span>{t.unpinBtn}</span>
                            </>
                          ) : (
                            <>
                              <Pin size={14} className="text-[#2AABEE]" />
                              <span>{t.pinBtn}</span>
                            </>
                          )}
                        </button>

                        {isMe && msg.content && (
                          <button
                            onClick={() => handleStartEdit(msg)}
                            className="flex w-full items-center space-x-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-gray-200 hover:bg-[#2b5278] transition"
                          >
                            <Pencil size={14} className="text-gray-300" />
                            <span>{t.editBtn}</span>
                          </button>
                        )}

                        {isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="flex w-full items-center space-x-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition"
                          >
                            <Trash2 size={14} />
                            <span>{t.deleteBtn}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {(() => {
                    const isSearchMatch = Boolean(
                      searchQuery.trim() &&
                      msg.content?.toLowerCase().includes(searchQuery.toLowerCase().trim())
                    );

                    return (
                      <div
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setActiveMenuMessageId(isMenuOpen ? null : msg.id);
                        }}
                        className={`message-bubble relative max-w-[78%] sm:max-w-[70%] md:max-w-[65%] px-3.5 py-2 shadow-md transition-all duration-300 ${
                          isBadgeOpen ? 'z-50' : 'z-auto'
                        } ${
                          isSearchMatch
                            ? 'ring-2 ring-amber-400/90 shadow-[0_0_15px_rgba(251,191,36,0.35)]'
                            : ''
                        } ${
                          isMe
                            ? 'bg-[#2b5278] text-white rounded-2xl rounded-br-sm'
                            : 'bg-[#182533] text-gray-100 rounded-2xl rounded-bl-sm border border-white/5'
                        }`}
                      >
                        {!isMe && activeChat.type !== 'private' && msg.sender && (() => {
                          const senderMbr = activeChat.members.find((m) => m.user.id === msg.sender?.id);
                          const badge = getMemberBadge(senderMbr, lang);

                          return (
                            <div className="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-0.5">
                              <span className="text-xs font-semibold text-[#2AABEE] hover:underline cursor-pointer">
                                {msg.sender.display_name || msg.sender.username}
                              </span>
                              {badge && (
                                <div className="relative inline-block">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveBadgeMessageId(activeBadgeMessageId === msg.id ? null : msg.id);
                                      setActiveMenuMessageId(null);
                                      setActiveReactionMessageId(null);
                                    }}
                                    className={`inline-flex items-center rounded-md px-1.5 py-0.2 text-[9px] font-semibold border leading-tight select-none shadow-sm transition hover:scale-105 active:scale-95 cursor-pointer ${badge.className}`}
                                    style={badge.customColor && badge.color ? {
                                      borderColor: `${badge.color}55`,
                                      color: badge.color,
                                      backgroundColor: `${badge.color}22`,
                                    } : undefined}
                                    title="Нажмите, чтобы узнать статус"
                                  >
                                    <span className="text-[9px] mr-0.5">{badge.icon}</span>
                                    <span>{badge.text}</span>
                                  </button>

                                  {/* Всплывающее окно при нажатии на титул */}
                                  {activeBadgeMessageId === msg.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className={`absolute left-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-3rem)] rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-2xl border animate-menu-in ${
                                        badge.role === 'owner'
                                          ? 'bg-[#1a1710] border-amber-500/70 text-amber-100 ring-2 ring-amber-500/30'
                                          : 'bg-[#101922] border-[#2AABEE]/70 text-cyan-100 ring-2 ring-[#2AABEE]/30'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-lg">{badge.icon}</span>
                                          <div>
                                            <h5
                                              className={`text-xs font-bold ${
                                                badge.role === 'owner' ? 'text-amber-400' : 'text-[#2AABEE]'
                                              }`}
                                            >
                                              {badge.fullTitle}
                                            </h5>
                                            {badge.text !== badge.fullTitle && (
                                              <p className="text-[10px] text-gray-300 font-medium">
                                                Титул: «{badge.text}»
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => setActiveBadgeMessageId(null)}
                                          className="text-gray-400 hover:text-white p-0.5 rounded-lg"
                                        >
                                          <X size={13} />
                                        </button>
                                      </div>

                                      <p className="mt-2 text-[11px] text-gray-300 leading-relaxed border-t border-white/10 pt-2">
                                        {badge.description}
                                      </p>

                                      {badge.role === 'owner' ? (
                                        <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/30 rounded-xl px-2.5 py-1">
                                          <span>👑</span>
                                          <span>Владелец и создатель чата</span>
                                        </div>
                                      ) : (
                                        <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] text-[#2AABEE] font-semibold bg-[#2AABEE]/15 border border-[#2AABEE]/30 rounded-xl px-2.5 py-1">
                                          <span>🛡️</span>
                                          <span>Администратор чата</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Цитируемое сообщение (Reply) */}
                        {msg.reply_to && (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              scrollToMessage(msg.reply_to!.id);
                            }}
                            className="mb-1.5 cursor-pointer rounded-lg bg-black/25 hover:bg-black/35 transition border-l-2 border-[#2AABEE] px-2.5 py-1 text-xs select-none"
                          >
                            <p className="font-semibold text-[#2AABEE] truncate text-[11px]">
                              {msg.reply_to.sender?.display_name || msg.reply_to.sender?.username || (lang === 'ky' ? 'Маектеш' : lang === 'en' ? 'User' : 'Собеседник')}
                            </p>
                            <p className="truncate text-gray-200/90 text-[11px]">
                              {msg.reply_to.content || (msg.reply_to.type === 'image' ? t.photoAttachment : msg.reply_to.type === 'voice' || msg.reply_to.type === 'audio' ? t.voiceAttachment : t.fileAttachment)}
                            </p>
                          </div>
                        )}

                        {/* Изображение */}
                        {msg.type === 'image' && msg.file_url && (
                          <div
                            className="relative group cursor-pointer overflow-hidden rounded-xl mb-1.5"
                            onClick={() => openLightbox(msg.id)}
                          >
                            <img
                              src={msg.file_url}
                              alt="attachment"
                              className="max-h-72 w-full rounded-xl object-cover transition duration-200 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                              <span className="rounded-full bg-black/60 p-2 text-white shadow-lg">
                                <Search size={18} />
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Видео */}
                        {msg.type === 'video' && msg.file_url && (
                          <div
                            className="relative group cursor-pointer overflow-hidden rounded-xl mb-1.5"
                            onClick={() => openLightbox(msg.id)}
                          >
                            <video
                              src={msg.file_url}
                              preload="metadata"
                              playsInline
                              className="max-h-72 w-full object-cover rounded-xl"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <span className="rounded-full bg-black/60 p-3 text-white group-hover:scale-110 transition shadow-xl">
                                <Play size={22} className="fill-current translate-x-0.5" />
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Аудио / Голосовое сообщение (Waveform плеер) */}
                        {(msg.type === 'audio' || msg.type === 'voice') && msg.file_url && (
                          <VoiceWaveformPlayer fileUrl={msg.file_url} isMe={isMe} />
                        )}

                        {/* Обычный файл */}
                        {msg.type === 'file' && msg.file_url && (
                          <a
                            href={msg.file_url}
                            download={msg.file_name || 'file'}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-1.5 flex items-center space-x-2.5 rounded-xl bg-black/25 p-2.5 text-sm text-blue-300 hover:text-blue-200 hover:bg-black/35 transition"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2AABEE]/20 text-[#2AABEE] flex-shrink-0">
                              <Paperclip size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-white text-xs">{msg.file_name || 'Скачать файл'}</p>
                              {msg.file_size ? (
                                <p className="text-[10px] text-gray-400 mt-0.5">{formatFileSize(msg.file_size)}</p>
                              ) : null}
                            </div>
                          </a>
                        )}

                    {/* Текст сообщения */}
                    {msg.content && (
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}

                    {/* Футер сообщения: время, ред., галочки */}
                    <div className="float-right ml-2.5 mt-1 -mb-0.5 flex items-center space-x-1 select-none text-[11px] text-gray-300/80">
                      {msg.is_edited && <span className="text-[10px] text-gray-400">{t.editedMark}</span>}
                      <span>
                        {format(new Date(msg.created_at), 'HH:mm', { locale: ru })}
                      </span>
                      {isMe && (
                        isRead ? (
                          <CheckCheck size={13} className="text-[#2AABEE]" />
                        ) : (
                          <Check size={13} className="text-gray-300/60" />
                        )
                      )}
                    </div>

                    {/* Список реакций под сообщением */}
                    {reactionGroups.length > 0 && (
                      <div className="clear-both pt-1.5 flex flex-wrap gap-1 select-none">
                        {reactionGroups.map((group) => (
                          <button
                            key={group.emoji}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReaction(msg.id, group.emoji);
                            }}
                            className={`flex items-center space-x-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all active:scale-95 shadow-sm border ${
                              group.hasReacted
                                ? 'bg-[#2AABEE]/25 border-[#2AABEE] text-white ring-1 ring-[#2AABEE]/40'
                                : 'bg-black/30 border-white/10 text-gray-300 hover:bg-black/50 hover:text-white'
                            }`}
                            title={group.hasReacted ? 'Убрать реакцию' : 'Поставить реакцию'}
                          >
                            <span className="text-xs leading-none">{group.emoji}</span>
                            <span className={`text-[11px] ${group.hasReacted ? 'text-[#2AABEE] font-bold' : 'text-gray-300'}`}>
                              {group.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>


      {/* Панель редактирования сообщения */}
      {editingMessage && (
        <div className="flex items-center justify-between border-t border-gray-800 bg-[#1c2733] px-4 py-2 text-xs animate-message">
          <div className="flex items-center space-x-2 text-[#2AABEE] min-w-0">
            <Pencil size={14} className="flex-shrink-0" />
            <div className="truncate">
              <span className="font-semibold">{t.editLabel}: </span>
              <span className="text-gray-300">{editingMessage.content}</span>
            </div>
          </div>
          <button
            onClick={handleCancelEdit}
            className="text-gray-400 hover:text-white transition p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Панель ответа на сообщение */}
      {replyingMessage && (
        <div className="flex items-center justify-between border-t border-gray-800 bg-[#1c2733] px-4 py-2 text-xs animate-message">
          <div className="flex items-center space-x-2.5 min-w-0">
            <Reply size={15} className="text-[#2AABEE] flex-shrink-0" />
            <div className="border-l-2 border-[#2AABEE] pl-2 min-w-0">
              <p className="font-semibold text-[#2AABEE] truncate text-[11px]">
                {replyingMessage.sender?.display_name || replyingMessage.sender?.username || (lang === 'ky' ? 'Маектеш' : lang === 'en' ? 'User' : 'Собеседник')}
              </p>
              <p className="truncate text-gray-300 text-[11px]">
                {replyingMessage.content || (replyingMessage.type === 'image' ? t.photoAttachment : replyingMessage.type === 'voice' || replyingMessage.type === 'audio' ? t.voiceAttachment : t.fileAttachment)}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyingMessage(null)}
            className="text-gray-400 hover:text-white transition p-1"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Всплывающая панель эмодзи (плавающая карточка) */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-4 z-30 w-72 rounded-2xl border border-gray-700/80 bg-[#1c2733]/95 p-3 shadow-2xl backdrop-blur-xl animate-message">
          <p className="mb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {t.emojis}
          </p>
          <div className="grid grid-cols-6 gap-2">
            {POPULAR_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg hover:bg-[#2b5278] transition-transform active:scale-95"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Нижняя панель ввода */}
      <div className="relative border-t border-gray-800/80 bg-[#17212b] p-3">
        {!canPost ? (
          <div className="flex items-center justify-center space-x-2 py-3 px-4 rounded-2xl bg-[#242f3d]/60 border border-gray-700/40 text-xs text-gray-300 font-medium select-none shadow-sm backdrop-blur-sm">
            <span className="text-sm">📢</span>
            <span>{t.channelOnlyAdmins}</span>
          </div>
        ) : isRecording ? (
          /* Интерфейс записи голосового */
          <div className="flex items-center justify-between rounded-2xl bg-[#242f3d] px-4 py-2 shadow-inner">
            <div className="flex items-center space-x-3">
              <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-sm font-medium text-white">
                {t.audioRecording(recordingSeconds)}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => stopRecording(true)}
                className="rounded-xl px-3 py-1.5 text-xs text-gray-400 hover:text-white transition"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={() => stopRecording(false)}
                className="flex items-center space-x-1.5 rounded-xl bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition shadow"
              >
                <Square size={13} />
                <span>{t.sendBtn}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Обычный ввод текста */
          <form onSubmit={handleSend} className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Капсула ввода с кнопками внутри */}
            <div className="flex flex-1 items-center rounded-2xl bg-[#242f3d] px-2 py-1 focus-within:ring-1.5 focus-within:ring-[#2AABEE] transition shadow-inner">
              {/* Прикрепить файл */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-700/50 hover:text-white transition"
                title="Прикрепить файл или фото"
              >
                <Paperclip size={18} />
              </button>

              {/* Эмодзи */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className={`rounded-xl p-2 transition ${
                  showEmojiPicker
                    ? 'text-[#2AABEE] bg-[#1c2733]'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
                }`}
                title="Эмодзи"
              >
                <Smile size={18} />
              </button>

              {/* Текстовый инпут */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (activeChatId) sendTyping(activeChatId, true);
                }}
                placeholder={t.inputPlaceholder}
                className="flex-1 bg-transparent px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
            </div>

            {/* Кнопка отправки или записи голоса */}
            {inputText.trim() || editingMessage ? (
              <button
                type="submit"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#2AABEE] text-white hover:bg-[#229ed9] transition shadow-md active:scale-95"
                title={t.sendBtn}
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#242f3d] text-gray-400 hover:bg-[#2AABEE] hover:text-white transition shadow-md active:scale-95"
                title="Записать голосовое сообщение"
              >
                <Mic size={19} />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Полноэкранный просмотр медиа (Lightbox) */}
      <MediaLightboxModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        mediaItems={chatMediaItems}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />

      {/* Панель информации о чате / собеседнике */}
      <ChatInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        chat={activeChat}
        messages={messages}
      />
    </div>
  );
}
