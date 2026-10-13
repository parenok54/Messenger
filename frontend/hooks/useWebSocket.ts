'use client';

import { useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore, useChatStore } from '@/store/useStore';
import { WsEvent } from '@/types';
import { soundEffects } from '@/lib/sound';
import { pushNotifications } from '@/lib/notifications';

// Глобальный диспетчер событий WebRTC (чтобы окно звонка могло слушать answer/candidates)
type WsCallback = (data: any) => void;
const callListeners = new Set<WsCallback>();
const earlyCallEventsBuffer: any[] = [];

export function subscribeToCallEvents(callback: WsCallback) {
  callListeners.add(callback);
  if (earlyCallEventsBuffer.length > 0) {
    const eventsToDrain = [...earlyCallEventsBuffer];
    earlyCallEventsBuffer.length = 0;
    eventsToDrain.forEach((evt) => {
      try {
        callback(evt);
      } catch (err) {
        console.error('Error delivering buffered call event', err);
      }
    });
  }
  return () => {
    callListeners.delete(callback);
  };
}

export function clearCallEventsBuffer() {
  earlyCallEventsBuffer.length = 0;
}

export function useWebSocket(refreshChats?: () => void) {
  const token = useAuthStore((s) => s.token);
  const socketRef = useRef<WebSocket | null>(null);

  // Колбэк обновления списка чатов, чтобы не пересоздавать WS-соединение
  const refreshChatsRef = useRef<(() => void) | undefined>(refreshChats);
  refreshChatsRef.current = refreshChats;

  useEffect(() => {
    if (!token) return;

    let isSubscribed = true;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    function connect() {
      if (!isSubscribed) return;
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        // Запускаем периодический ping чтобы соединение не засыпало
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data: WsEvent = JSON.parse(event.data);
          const {
            addMessage,
            updateMessage,
            deleteMessage,
            setTyping,
            setIncomingCall,
          } = useChatStore.getState();

          const isCallEvent =
            data.type === 'call_offer' ||
            data.type === 'call_answer' ||
            data.type === 'ice_candidate' ||
            data.type === 'call_end' ||
            data.type === 'media_state';

          if (isCallEvent) {
            if (callListeners.size === 0) {
              earlyCallEventsBuffer.push(data);
              if (earlyCallEventsBuffer.length > 100) earlyCallEventsBuffer.shift();
            } else {
              callListeners.forEach((listener) => {
                try {
                  listener(data);
                } catch (e) {
                  console.error('Error in callListener', e);
                }
              });
            }
          }

          switch (data.type) {
            case 'new_message': {
              addMessage(data.message.chat_id, data.message);
              const curUser = useAuthStore.getState().user;
              const isOtherSender = data.message.sender?.id !== curUser?.id;

              if (isOtherSender) {
                soundEffects.playReceived();

                // Показываем Push-уведомление, если вкладка не активна или открыт другой чат
                const isTabInactive = typeof document !== 'undefined' && (document.hidden || !document.hasFocus());
                const isDifferentChat = useChatStore.getState().activeChatId !== data.message.chat_id;

                if (isTabInactive || isDifferentChat) {
                  const chats = useChatStore.getState().chats;
                  const targetChat = chats.find((c) => c.id === data.message.chat_id);
                  const senderName = data.message.sender?.display_name || data.message.sender?.username || 'Собеседник';
                  const title = targetChat && targetChat.type !== 'private'
                    ? `${targetChat.title}: ${senderName}`
                    : senderName;

                  let body = data.message.content || '';
                  if (data.message.type === 'image') body = '📷 Фотография';
                  else if (data.message.type === 'video') body = '🎥 Видеозапись';
                  else if (data.message.type === 'voice') body = '🎙️ Голосовое сообщение';
                  else if (data.message.type === 'file') body = `📎 ${data.message.file_name || 'Файл'}`;

                  pushNotifications.show({
                    title,
                    body,
                    icon: data.message.sender?.avatar_url || targetChat?.avatar_url || undefined,
                    chatId: data.message.chat_id,
                  });
                }
              }
              break;
            }
            case 'message_edited':
              updateMessage(data.message.chat_id, data.message);
              break;
            case 'message_deleted':
              deleteMessage(data.chat_id, data.message_id);
              useChatStore.getState().removeChatMessageRef(data.chat_id, data.message_id);
              break;
            case 'message_reaction':
              useChatStore.getState().updateMessageReactions(data.chat_id, data.message_id, data.reactions);
              break;
            case 'chat_pinned_message':
              useChatStore.getState().setChatPinnedMessage(
                data.chat_id,
                data.pinned_message_id,
                data.pinned_message
              );
              if (data.pinned_message_id) {
                soundEffects.playPin();
              }
              break;
            case 'typing':
              setTyping(data.chat_id, data.user_id, data.action === 'start');
              break;
            case 'read_receipt':
              if (data.read_at) {
                useChatStore.getState().updateMemberRead(data.chat_id, data.user_id, data.read_at);
              }
              break;
            case 'member_added':
              // Новый участник в группе/канале — перезагружаем список чатов
              refreshChatsRef.current?.();
              break;
            case 'user_online':
              useChatStore.getState().updateMemberOnline(
                data.user_id,
                Boolean(data.is_online),
                data.last_seen
              );
              break;
            case 'error':
              // Ошибка от сервера (нет доступа к чату, нет общего чата для звонка и т.п.)
              if (data.detail) toast.error(data.detail);
              break;
            case 'call_offer':
              if (useChatStore.getState().activeCall) {
                if (socketRef.current?.readyState === WebSocket.OPEN) {
                  socketRef.current.send(
                    JSON.stringify({
                      type: 'call_end',
                      target_user_id: data.from_user_id,
                      chat_id: data.chat_id,
                      reason: 'busy',
                    })
                  );
                }
                break;
              }
              soundEffects.startIncomingRingtone();
              pushNotifications.show({
                title: '📞 Входящий звонок',
                body: `${data.from_user_name} звонит вам (${data.is_video ? 'видео' : 'аудио'})...`,
                chatId: data.chat_id,
              });
              setIncomingCall({
                targetUserId: data.from_user_id,
                targetUserName: data.from_user_name,
                chatId: data.chat_id,
                isVideo: data.is_video,
                isIncoming: true,
                offer: data.offer,
              });
              break;
            case 'call_end':
              clearCallEventsBuffer();
              soundEffects.stopCallSounds();
              soundEffects.playCallEnd();
              useChatStore.getState().setActiveCall(null);
              useChatStore.getState().setIncomingCall(null);
              break;
            default:
              break;
          }
        } catch (err) {
          console.error('Failed to parse WS event', err);
        }
      };

      ws.onclose = (ev) => {
        if (pingInterval) clearInterval(pingInterval);
        if (!isSubscribed) return;
        // Закрытие по нашей инициативе (обновление токена) — переподключаться
        // не нужно, это уже сделает onTokenChanged
        if (ev.code === 4000) return;
        if (ev.code === 4001 || ev.code === 4004) {
          console.warn('WS unauthorized or invalid (code', ev.code, '), stopping reconnect');
          return;
        }
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    // Если api.ts обновил access token через refresh — пересоздаём соединение,
    // иначе сокет продолжит жить на старом токене.
    function onTokenChanged() {
      if (socketRef.current) {
        socketRef.current.close(4000, 'token refreshed');
      }
      if (isSubscribed) {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        connect();
      }
    }

    window.addEventListener('auth-token-changed', onTokenChanged);

    connect();

    return () => {
      isSubscribed = false;
      window.removeEventListener('auth-token-changed', onTokenChanged);
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      socketRef.current?.close();
    };
  }, [token]);

  const sendMessage = useCallback((chatId: string, content: string, replyToId?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'send_message',
          chat_id: chatId,
          content,
          reply_to_id: replyToId || null,
        })
      );
    }
  }, []);

  const sendTyping = useCallback((chatId: string, isTyping: boolean) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: isTyping ? 'typing_start' : 'typing_stop',
          chat_id: chatId,
        })
      );
    }
  }, []);

  const sendRead = useCallback((chatId: string, messageId?: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'read',
          chat_id: chatId,
          message_id: messageId || null,
        })
      );
    }
  }, []);

  const sendReaction = useCallback((chatId: string, messageId: string, emoji: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'reaction',
          chat_id: chatId,
          message_id: messageId,
          emoji,
        })
      );
    }
  }, []);

  const sendPinMessage = useCallback((chatId: string, messageId: string | null) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'pin_message',
          chat_id: chatId,
          message_id: messageId,
        })
      );
    }
  }, []);

  const sendWsRaw = useCallback((payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return { sendMessage, sendTyping, sendRead, sendReaction, sendPinMessage, sendWsRaw };
}
