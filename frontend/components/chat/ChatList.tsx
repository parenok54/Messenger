'use client';

import React from 'react';
import { Chat } from '@/types';
import { useAuthStore, useChatStore, useLanguageStore } from '@/store/useStore';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Users, Megaphone, User as UserIcon, Check, CheckCheck } from 'lucide-react';

interface ChatListProps {
  onSelectChat: (chat: Chat) => void;
}

function formatChatTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) {
      return format(d, 'HH:mm', { locale: ru });
    }
    if (isYesterday(d)) {
      return 'Вчера';
    }
    if (isThisWeek(d)) {
      return format(d, 'eee', { locale: ru });
    }
    return format(d, 'd MMM', { locale: ru });
  } catch {
    return '';
  }
}

export function ChatList({ onSelectChat }: ChatListProps) {
  const chats = useChatStore((s) => s.chats);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { t } = useLanguageStore();

  const getChatDetails = (chat: Chat) => {
    let title = chat.title || 'Чат';
    let icon = <UserIcon size={13} className="text-gray-400" />;

    if (chat.type === 'private') {
      const otherMember = chat.members.find((m) => m.user.id !== currentUserId);
      title = otherMember?.user.display_name || otherMember?.user.username || 'Личный чат';
      icon = <UserIcon size={13} className="text-[#2AABEE]" />;
    } else if (chat.type === 'group') {
      icon = <Users size={13} className="text-emerald-400" />;
    } else if (chat.type === 'channel') {
      icon = <Megaphone size={13} className="text-amber-400" />;
    }

    return { title, icon };
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
      {chats.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 space-y-2">
          <div className="h-12 w-12 rounded-full bg-gray-800/60 flex items-center justify-center text-gray-400">
            <UserIcon size={24} />
          </div>
          <p className="text-sm font-medium text-gray-400">{t.noChatsTitle}</p>
          <p className="text-xs text-gray-500">
            {t.noChatsHint}
          </p>
        </div>
      ) : (
        chats.map((chat) => {
          const isActive = chat.id === activeChatId;
          const { title, icon } = getChatDetails(chat);
          const lastMsg = chat.last_message;
          const otherMember =
            chat.type === 'private'
              ? chat.members.find((m) => m.user.id !== currentUserId)
              : null;
          const isMeLastSender = lastMsg && lastMsg.sender?.id === currentUserId;

          // Проверка прочтения последнего сообщения собеседником
          const isLastMsgRead =
            isMeLastSender && otherMember?.last_read_at
              ? new Date(otherMember.last_read_at) >= new Date(lastMsg.created_at)
              : false;

          return (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`group flex cursor-pointer items-center space-x-3 rounded-xl px-3 py-2.5 transition-all duration-150 ${
                isActive
                  ? 'bg-[#2b5278] text-white shadow-md'
                  : 'hover:bg-[#202b36] text-gray-200'
              }`}
            >
              {/* Аватарка с индикатором онлайна */}
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 font-bold text-white shadow">
                {chat.type === 'private' && otherMember?.user.avatar_url ? (
                  <img
                    src={otherMember.user.avatar_url}
                    alt={title}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-base">{title.charAt(0).toUpperCase()}</span>
                )}

                {chat.type === 'private' ? (
                  otherMember?.user.is_online ? (
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-[#17212b]" />
                  ) : null
                ) : (
                  <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#17212b] p-1 shadow">
                    {icon}
                  </div>
                )}
              </div>

              {/* Инфо чата */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between mb-0.5">
                  <h3
                    className={`truncate text-sm font-semibold ${
                      isActive ? 'text-white' : 'text-gray-100 group-hover:text-white'
                    }`}
                  >
                    {title}
                  </h3>
                  {lastMsg && (
                    <span
                      className={`text-[11px] font-normal flex-shrink-0 ml-1.5 ${
                        isActive ? 'text-blue-200' : 'text-gray-400'
                      }`}
                    >
                      {formatChatTime(lastMsg.created_at)}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div
                    className={`flex items-center space-x-1 truncate ${
                      isActive ? 'text-blue-100' : 'text-gray-400'
                    }`}
                  >
                    {isMeLastSender && (
                      <span className="flex items-center space-x-1 flex-shrink-0">
                        <span className="text-[#2AABEE] font-medium">{t.youPrefix}</span>
                        {isLastMsgRead ? (
                          <CheckCheck size={13} className="text-[#2AABEE]" />
                        ) : (
                          <Check size={13} className="text-gray-400" />
                        )}
                      </span>
                    )}

                    <p className="truncate">
                      {lastMsg ? (
                        lastMsg.content ||
                        (lastMsg.type === 'image'
                          ? t.photoAttachment
                          : lastMsg.type === 'voice'
                          ? t.voiceAttachment
                          : t.fileAttachment)
                      ) : (
                        <span className="italic text-gray-500">...</span>
                      )}
                    </p>
                  </div>

                  {chat.unread_count > 0 && (
                    <span className="ml-2 flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-[#2AABEE] text-[11px] font-bold text-white shadow-sm flex-shrink-0">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
