import { create } from 'zustand';
import { User, Chat, Message, Reaction } from '@/types';
import { Lang, translations } from '@/lib/i18n';

interface AuthState {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  initToken: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  initToken: () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('access_token');
      if (saved) set({ token: saved });
    }
  },
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('access_token', token);
      } else {
        localStorage.removeItem('access_token');
      }
    }
    set({ token });
  },
  setRefreshToken: (token) => {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('refresh_token', token);
      } else {
        localStorage.removeItem('refresh_token');
      }
    }
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    set({ user: null, token: null });
  },
}));

interface LanguageState {
  lang: Lang;
  t: (typeof translations)['ru'];
  setLang: (lang: Lang) => void;
}

export const useLanguageStore = create<LanguageState>((set) => {
  let initialLang: Lang = 'ru';
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('app_lang') as Lang | null;
    if (saved && (saved === 'ru' || saved === 'ky' || saved === 'en')) {
      initialLang = saved;
    }
  }

  return {
    lang: initialLang,
    t: translations[initialLang],
    setLang: (lang: Lang) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('app_lang', lang);
      }
      set({ lang, t: translations[lang] });
    },
  };
});

export interface CallSession {
  targetUserId: string;
  targetUserName: string;
  chatId: string;
  isVideo: boolean;
  isIncoming: boolean;
  offer?: any;
}

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  setChats: (chats: Chat[]) => void;
  setActiveChatId: (id: string | null) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, message: Message) => void;
  updateMessageReactions: (chatId: string, messageId: string, reactions: Reaction[]) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  setTyping: (chatId: string, userId: string, isTyping: boolean) => void;
  markChatRead: (chatId: string) => void;
  updateMemberRead: (chatId: string, userId: string, readAt: string) => void;
  updateMemberOnline: (userId: string, isOnline: boolean, lastSeen?: string | null) => void;
  removeChatMessageRef: (chatId: string, messageId: string) => void;
  setChatPinnedMessage: (chatId: string, pinnedMessageId: string | null, pinnedMessage: Message | null) => void;
  updateChat: (chat: Chat) => void;
  removeChat: (chatId: string) => void;
  setActiveCall: (call: CallSession | null) => void;
  setIncomingCall: (call: CallSession | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  typingUsers: {},
  activeCall: null,
  incomingCall: null,
  setActiveCall: (activeCall) => set({ activeCall }),
  setIncomingCall: (incomingCall) => set({ incomingCall }),
  setChats: (chats) => set({ chats }),
  setActiveChatId: (activeChatId) => set({ activeChatId }),
  setMessages: (chatId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [chatId]: msgs },
    })),
  addMessage: (chatId, msg) =>
    set((state) => {
      const current = state.messages[chatId] || [];
      if (current.some((m) => m.id === msg.id)) return state;
      const updatedMessages = [...current, msg];

      // Обновляем также last_message и unread_count в chats
      const updatedChats = state.chats.map((c) => {
        if (c.id === chatId) {
          const isCurrentChatActive = state.activeChatId === chatId;
          return {
            ...c,
            last_message: msg,
            unread_count: isCurrentChatActive ? 0 : c.unread_count + 1,
          };
        }
        return c;
      });

      return {
        messages: { ...state.messages, [chatId]: updatedMessages },
        chats: updatedChats,
      };
    }),
  updateMessage: (chatId, msg) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === msg.id ? msg : m
        ),
      },
    })),
  updateMessageReactions: (chatId, messageId, reactions) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      },
    })),
  deleteMessage: (chatId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).filter((m) => m.id !== messageId),
      },
    })),
  markChatRead: (chatId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, unread_count: 0 } : c
      ),
    })),
  updateMemberRead: (chatId, userId, readAt) =>
    set((state) => ({
      chats: state.chats.map((c) => {
        if (c.id === chatId) {
          return {
            ...c,
            members: c.members.map((m) =>
              m.user.id === userId ? { ...m, last_read_at: readAt } : m
            ),
          };
        }
        return c;
      }),
    })),
  // Обновить статус «онлайн» у участника во всех чатах
  updateMemberOnline: (userId, isOnline, lastSeen) =>
    set((state) => ({
      chats: state.chats.map((c) => ({
        ...c,
        members: c.members.map((m) =>
          m.user.id === userId
            ? {
                ...m,
                user: {
                  ...m.user,
                  is_online: isOnline,
                  last_seen: isOnline ? m.user.last_seen : (lastSeen || new Date().toISOString()),
                },
              }
            : m
        ),
      })),
    })),
  // Удалить ссылку на сообщение из last_message чата
  removeChatMessageRef: (chatId, messageId) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId && c.last_message?.id === messageId
          ? { ...c, last_message: null }
          : c
      ),
    })),
  setChatPinnedMessage: (chatId, pinnedMessageId, pinnedMessage) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              pinned_message_id: pinnedMessageId,
              pinned_message: pinnedMessage,
            }
          : c
      ),
    })),
  updateChat: (updatedChat) =>
    set((state) => ({
      chats: state.chats.map((c) => (c.id === updatedChat.id ? updatedChat : c)),
    })),
  removeChat: (chatId) =>
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      activeChatId: state.activeChatId === chatId ? null : state.activeChatId,
    })),
  setTyping: (chatId, userId, isTyping) =>
    set((state) => {
      const current = state.typingUsers[chatId] || [];
      const updated = isTyping
        ? Array.from(new Set([...current, userId]))
        : current.filter((id) => id !== userId);
      return {
        typingUsers: { ...state.typingUsers, [chatId]: updated },
      };
    }),
}));
