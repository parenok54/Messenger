'use client';

import React, { createContext, useContext } from 'react';

interface WebSocketContextValue {
  sendMessage: (chatId: string, content: string, replyToId?: string) => void;
  sendTyping: (chatId: string, isTyping: boolean) => void;
  sendRead: (chatId: string, messageId?: string) => void;
  sendReaction: (chatId: string, messageId: string, emoji: string) => void;
  sendPinMessage: (chatId: string, messageId: string | null) => void;
  sendWsRaw: (payload: any) => void;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  sendMessage: () => {},
  sendTyping: () => {},
  sendRead: () => {},
  sendReaction: () => {},
  sendPinMessage: () => {},
  sendWsRaw: () => {},
});

export function WebSocketProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: WebSocketContextValue;
}) {
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  return useContext(WebSocketContext);
}
