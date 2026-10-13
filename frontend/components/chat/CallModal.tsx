'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore, CallSession } from '@/store/useStore';
import { subscribeToCallEvents } from '@/hooks/useWebSocket';
import { useWebSocketContext } from '@/context/WebSocketContext';
import { soundEffects } from '@/lib/sound';
import {
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Monitor,
  MonitorOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

interface CallModalProps {
  call: CallSession;
  onClose: () => void;
}

export function CallModal({ call, onClose }: CallModalProps) {
  const { sendWsRaw } = useWebSocketContext();
  const chats = useChatStore((s) => s.chats);

  // Информация о собеседнике
  const chat = chats.find((c) => c.id === call.chatId);
  const targetMember = chat?.members.find((m) => m.user.id === call.targetUserId);
  const targetAvatar = targetMember?.user.avatar_url;

  // Состояния медиа
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(call.isVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Состояния соединения
  const [callStatus, setCallStatus] = useState<string>(
    call.isIncoming ? 'Входящий вызов...' : 'Вызов...'
  );
  const [isConnected, setIsConnected] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [remoteHasVideo, setRemoteHasVideo] = useState(call.isVideo);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Ссылки на элементы и соединения
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const videoTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteMediaStreamRef = useRef<MediaStream>(new MediaStream());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Очередь ICE-кандидатов для предотвращения race condition
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const isRemoteDescriptionSet = useRef<boolean>(false);

  // Таймер длительности разговора
  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setDurationSeconds((sec) => sec + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isConnected]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Инициализация WebRTC
  useEffect(() => {
    let pc: RTCPeerConnection;
    let audioAnalyserCtx: AudioContext | null = null;
    let audioAnalyserInterval: any = null;

    if (!call.isIncoming) {
      soundEffects.startOutgoingRingtone();
    }

    const setupCall = async () => {
      try {
        // Запрос медиапотока (микрофон всегда + камера если видеовызов)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: call.isVideo
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
            : false,
        });

        localStreamRef.current = stream;
        const videoTrack = stream.getVideoTracks()[0] || null;
        cameraTrackRef.current = videoTrack;

        if (localVideoRef.current && videoTrack) {
          localVideoRef.current.srcObject = new MediaStream([videoTrack]);
        }

        // Создаем PeerConnection
        pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // 1. Добавляем аудиотрек
        stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

        // 2. ВСЕГДА регистрируем видеотрансивер в SDP, даже при аудиозвонке!
        // Это позволяет включить камеру на лету без сложной пере-инициализации SDP.
        const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
        videoTransceiverRef.current = videoTransceiver;
        if (videoTrack) {
          videoTransceiver.sender.replaceTrack(videoTrack);
        }

        // Мониторинг статуса соединения WebRTC
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === 'connected') {
            soundEffects.stopCallSounds();
            setIsConnected(true);
            setCallStatus('Идет разговор');
          } else if (state === 'connecting') {
            setCallStatus('Подключение...');
          } else if (state === 'disconnected') {
            setCallStatus('Восстановление связи...');
          } else if (state === 'failed') {
            toast.error('Ошибка P2P подключения');
            endCall();
          }
        };

        // Получение удаленного медиапотока
        pc.ontrack = (event) => {
          soundEffects.stopCallSounds();
          setIsConnected(true);
          setCallStatus('Идет разговор');

          // Добавляем трек в общий remote MediaStream
          remoteMediaStreamRef.current.addTrack(event.track);

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteMediaStreamRef.current;
            remoteVideoRef.current.play().catch(() => {});
          }

          if (event.track.kind === 'video') {
            event.track.onunmute = () => {
              setRemoteHasVideo(true);
            };
          }

          // Детекция речи собеседника через Web Audio API
          if (event.track.kind === 'audio' && typeof window !== 'undefined') {
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                audioAnalyserCtx = new AudioCtx();
                const src = audioAnalyserCtx.createMediaStreamSource(new MediaStream([event.track]));
                const analyser = audioAnalyserCtx.createAnalyser();
                analyser.fftSize = 256;
                src.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                audioAnalyserInterval = setInterval(() => {
                  analyser.getByteFrequencyData(dataArray);
                  const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
                  setIsSpeaking(average > 18);
                }, 150);
              }
            } catch (e) {
              console.warn('Voice analyser setup error:', e);
            }
          }
        };

        // Отправка ICE-кандидатов
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendWsRaw({
              type: 'ice_candidate',
              target_user_id: call.targetUserId,
              candidate: event.candidate,
            });
          }
        };

        // Обработка сигналинга WebSocket
        const unsubscribe = subscribeToCallEvents(async (data: any) => {
          if (data.type === 'call_answer' && data.from_user_id === call.targetUserId) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              isRemoteDescriptionSet.current = true;
              soundEffects.stopCallSounds();

              // Сбрасываем накопленные ICE кандидаты
              while (iceCandidatesQueue.current.length > 0) {
                const cand = iceCandidatesQueue.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
            } catch (err) {
              console.error('Error applying call_answer:', err);
            }
          } else if (data.type === 'ice_candidate' && data.from_user_id === call.targetUserId) {
            const cand = data.candidate;
            if (cand) {
              if (isRemoteDescriptionSet.current) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.error('Error adding ICE candidate:', e);
                }
              } else {
                iceCandidatesQueue.current.push(cand);
              }
            }
          } else if (data.type === 'media_state' && data.from_user_id === call.targetUserId) {
            // Мгновенное переключение состояния видео от собеседника
            setRemoteHasVideo(Boolean(data.is_video_enabled));
          } else if (data.type === 'call_end') {
            soundEffects.stopCallSounds();
            soundEffects.playCallEnd();
            if (data.reason === 'busy') {
              toast('Собеседник занят');
            } else if (data.reason === 'declined') {
              toast('Вызов отклонен');
            } else {
              toast('Звонок завершен');
            }
            endCall(false);
          }
        });

        // Исходящий звонок: создаем Offer (содержащий и audio, и video)
        if (!call.isIncoming) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          sendWsRaw({
            type: 'call_offer',
            target_user_id: call.targetUserId,
            offer: offer,
            is_video: call.isVideo,
            chat_id: call.chatId,
          });
        } else if (call.offer) {
          // Входящий звонок: устанавливаем Remote Description и формируем Answer
          await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
          isRemoteDescriptionSet.current = true;

          while (iceCandidatesQueue.current.length > 0) {
            const cand = iceCandidatesQueue.current.shift();
            if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          sendWsRaw({
            type: 'call_answer',
            target_user_id: call.targetUserId,
            answer: answer,
          });
          soundEffects.stopCallSounds();
        }

        return unsubscribe;
      } catch (err) {
        console.error('Failed to setup WebRTC call:', err);
        toast.error('Ошибка доступа к микрофону или камере');
        endCall();
      }
    };

    let unsub: (() => void) | undefined;
    setupCall().then((u) => {
      unsub = u;
    });

    return () => {
      soundEffects.stopCallSounds();
      if (unsub) unsub();
      if (audioAnalyserInterval) clearInterval(audioAnalyserInterval);
      if (audioAnalyserCtx) audioAnalyserCtx.close().catch(() => {});
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pc) pc.close();
    };
  }, []);

  const endCall = (sendEndSignal = true) => {
    soundEffects.stopCallSounds();
    soundEffects.playCallEnd();

    if (sendEndSignal) {
      sendWsRaw({
        type: 'call_end',
        target_user_id: call.targetUserId,
      });
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (cameraTrackRef.current) {
      cameraTrackRef.current.stop();
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    onClose();
  };

  // Переключение микрофона
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Переключение камеры (Включение / Выключение на лету)
  const toggleVideo = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isVideoEnabled) {
      // 1. Выключаем камеру
      if (cameraTrackRef.current) {
        cameraTrackRef.current.enabled = false;
        cameraTrackRef.current.stop();
        cameraTrackRef.current = null;
      }

      const videoSender =
        videoTransceiverRef.current?.sender ||
        pc.getSenders().find((s) => s.track?.kind === 'video');

      if (videoSender) {
        await videoSender.replaceTrack(null);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }

      setIsVideoEnabled(false);

      // Оповещаем собеседника о выключении камеры
      sendWsRaw({
        type: 'media_state',
        target_user_id: call.targetUserId,
        is_video_enabled: false,
        is_screen_sharing: false,
      });
    } else {
      // 2. Включаем камеру (в том числе при аудиозвонке!)
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        const newTrack = videoStream.getVideoTracks()[0];
        cameraTrackRef.current = newTrack;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([newTrack]);
        }

        const videoSender =
          videoTransceiverRef.current?.sender ||
          pc.getSenders().find((s) => s.track?.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(newTrack);
        }

        setIsVideoEnabled(true);

        // Оповещаем собеседника о включении камеры
        sendWsRaw({
          type: 'media_state',
          target_user_id: call.targetUserId,
          is_video_enabled: true,
          is_screen_sharing: false,
        });
      } catch (e) {
        toast.error('Не удалось активировать камеру');
      }
    }
  };

  // Демонстрация экрана
  const toggleScreenShare = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Останавливаем демонстрацию экрана и возвращаем камеру (если была включена)
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }

      const videoSender =
        videoTransceiverRef.current?.sender ||
        pc.getSenders().find((s) => s.track?.kind === 'video');

      if (videoSender) {
        await videoSender.replaceTrack(cameraTrackRef.current || null);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = cameraTrackRef.current
          ? new MediaStream([cameraTrackRef.current])
          : null;
      }

      setIsScreenSharing(false);

      sendWsRaw({
        type: 'media_state',
        target_user_id: call.targetUserId,
        is_video_enabled: Boolean(cameraTrackRef.current),
        is_screen_sharing: false,
      });
    } else {
      // Запускаем демонстрацию экрана
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];

        const videoSender =
          videoTransceiverRef.current?.sender ||
          pc.getSenders().find((s) => s.track?.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = new MediaStream([screenTrack]);
        }

        setIsScreenSharing(true);

        sendWsRaw({
          type: 'media_state',
          target_user_id: call.targetUserId,
          is_video_enabled: true,
          is_screen_sharing: true,
        });

        // Событие завершения показа через плашку браузера
        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (e) {
        // Отмена пользователем
      }
    }
  };

  // Полноэкранный режим
  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div
        ref={modalContainerRef}
        className="relative flex h-[85vh] w-[92vw] max-w-5xl flex-col overflow-hidden rounded-3xl bg-[#111922] shadow-[0_25px_70px_rgba(0,0,0,0.9)] border border-gray-800"
      >
        {/* Шапка звонка */}
        <div className="absolute left-6 top-6 z-30 flex items-center space-x-3.5 rounded-full bg-[#182330]/80 px-4 py-2 backdrop-blur-md border border-white/10 shadow-lg">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
            }`}
          />
          <div>
            <h3 className="text-sm font-semibold text-white leading-tight">
              {call.targetUserName}
            </h3>
            <p className="text-xs text-gray-300 font-mono">
              {isConnected ? formatDuration(durationSeconds) : callStatus}
            </p>
          </div>
        </div>

        {/* Кнопка Fullscreen */}
        <button
          onClick={toggleFullscreen}
          className="absolute right-6 top-6 z-30 p-2.5 rounded-full bg-black/40 text-gray-300 hover:text-white hover:bg-black/60 transition backdrop-blur-md border border-white/10"
          title="Во весь экран"
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        {/* Основная видео / аудио область */}
        <div className="relative flex flex-1 items-center justify-center bg-[#0c1218] overflow-hidden">
          {/* Видео собеседника */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`h-full w-full object-cover transition-opacity duration-300 ${
              remoteHasVideo ? 'opacity-100' : 'opacity-0 absolute'
            }`}
          />

          {/* Аватар собеседника для аудиозвонка или когда камера выключена */}
          {!remoteHasVideo && (
            <div className="flex flex-col items-center justify-center select-none space-y-4">
              <div className="relative flex items-center justify-center">
                {/* Анимированные пульсирующие волны при разговоре */}
                {isSpeaking && (
                  <>
                    <div className="absolute h-44 w-44 rounded-full bg-[#2AABEE]/20 animate-ping" />
                    <div className="absolute h-36 w-36 rounded-full bg-[#2AABEE]/30 animate-pulse" />
                  </>
                )}
                <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-4xl font-bold text-white shadow-2xl ring-4 ring-white/10">
                  {targetAvatar ? (
                    <img
                      src={targetAvatar}
                      alt={call.targetUserName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{call.targetUserName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
              </div>

              <div className="text-center">
                <h4 className="text-lg font-bold text-white">{call.targetUserName}</h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isConnected ? (
                    <span className="text-emerald-400 font-medium">Соединение активно</span>
                  ) : (
                    callStatus
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Локальное видео (Картинка-в-картинке) */}
          <div
            className={`absolute bottom-24 right-6 h-40 w-56 overflow-hidden rounded-2xl border-2 border-gray-700/80 bg-gray-900 shadow-2xl transition-transform hover:scale-105 ${
              isVideoEnabled || isScreenSharing ? 'block' : 'hidden'
            }`}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {isScreenSharing && (
              <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-cyan-300 font-medium">
                Экран
              </div>
            )}
          </div>
        </div>

        {/* Нижняя панель управления */}
        <div className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center space-x-4 rounded-full bg-[#182330]/90 px-6 py-3 backdrop-blur-xl border border-white/10 shadow-2xl">
          {/* Микрофон */}
          <button
            type="button"
            onClick={toggleAudio}
            className={`rounded-full p-3.5 transition active:scale-95 shadow-md ${
              isAudioMuted
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-700/90 text-white hover:bg-gray-600'
            }`}
            title={isAudioMuted ? 'Включить микрофон' : 'Выключить микрофон'}
          >
            {isAudioMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Камера */}
          <button
            type="button"
            onClick={toggleVideo}
            className={`rounded-full p-3.5 transition active:scale-95 shadow-md ${
              isVideoEnabled
                ? 'bg-[#2AABEE] text-white hover:bg-[#229ed9]'
                : 'bg-gray-700/90 text-gray-300 hover:bg-gray-600'
            }`}
            title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
          >
            {isVideoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* Демонстрация экрана */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`rounded-full p-3.5 transition active:scale-95 shadow-md ${
              isScreenSharing
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-gray-700/90 text-gray-300 hover:bg-gray-600'
            }`}
            title={isScreenSharing ? 'Остановить показ экрана' : 'Поделиться экраном'}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>

          {/* Завершить звонок */}
          <button
            type="button"
            onClick={() => endCall(true)}
            className="rounded-full bg-red-600 p-4 text-white shadow-xl transition hover:bg-red-700 active:scale-95"
            title="Завершить вызов"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
