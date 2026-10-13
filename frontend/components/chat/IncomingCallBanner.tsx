'use client';

import React, { useEffect } from 'react';
import { useChatStore } from '@/store/useStore';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { soundEffects } from '@/lib/sound';
import { Phone, PhoneOff, Video } from 'lucide-react';

export function IncomingCallBanner() {
  const incomingCall = useChatStore((s) => s.incomingCall);
  const setIncomingCall = useChatStore((s) => s.setIncomingCall);
  const setActiveCall = useChatStore((s) => s.setActiveCall);
  const { sendWsRaw } = useWebSocketContext();

  useEffect(() => {
    if (incomingCall) {
      soundEffects.startIncomingRingtone();
    }
    return () => {
      soundEffects.stopCallSounds();
    };
  }, [incomingCall]);

  if (!incomingCall) return null;

  const handleAccept = () => {
    soundEffects.stopCallSounds();
    setActiveCall(incomingCall);
    setIncomingCall(null);
  };

  const handleDecline = () => {
    soundEffects.stopCallSounds();
    soundEffects.playCallEnd();
    sendWsRaw({
      type: 'call_end',
      target_user_id: incomingCall.targetUserId,
      reason: 'declined',
    });
    setIncomingCall(null);
  };

  return (
    <div className="fixed top-6 right-6 z-50 flex items-center space-x-4 rounded-2xl bg-[#17212b] p-4 shadow-2xl border border-gray-700 animate-bounce">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2AABEE] text-white">
        {incomingCall.isVideo ? <Video size={24} /> : <Phone size={24} />}
      </div>

      <div>
        <h4 className="font-semibold text-white">{incomingCall.targetUserName}</h4>
        <p className="text-xs text-gray-400">
          Входящий {incomingCall.isVideo ? 'видеозвонок' : 'аудиозвонок'}...
        </p>
      </div>

      <div className="flex items-center space-x-2 pl-2">
        <button
          onClick={handleAccept}
          className="rounded-full bg-emerald-600 p-3 text-white transition hover:bg-emerald-700 shadow"
          title="Принять"
        >
          <Phone size={18} />
        </button>
        <button
          onClick={handleDecline}
          className="rounded-full bg-red-600 p-3 text-white transition hover:bg-red-700 shadow"
          title="Отклонить"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
