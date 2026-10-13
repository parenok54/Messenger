'use client';

/**
 * Web Audio API Sound Effects Engine
 * Чистый синтез звуков через Web Audio API:
 * - Нулевая задержка (0ms latency)
 * - Работает оффлайн, без загрузки внешних mp3-файлов
 * - Премиальное звучание в стиле Telegram / iOS
 */

class SoundEffectsEngine {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private outgoingInterval: any = null;
  private isEnabled: boolean = true;
  private volume: number = 0.8;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('sound_effects_enabled');
      if (savedEnabled !== null) {
        this.isEnabled = savedEnabled === 'true';
      }
      const savedVolume = localStorage.getItem('sound_effects_volume');
      if (savedVolume !== null) {
        const v = parseFloat(savedVolume);
        if (!isNaN(v) && v >= 0 && v <= 1) this.volume = v;
      }

      // Активация AudioContext по первому клику/тапу пользователя (требование браузеров)
      const unlockAudio = () => {
        this.initContext();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { once: true });
      window.addEventListener('keydown', unlockAudio, { once: true });
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_effects_enabled', String(enabled));
      window.dispatchEvent(new CustomEvent('sound-settings-changed'));
    }
    if (!enabled) {
      this.stopCallSounds();
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== 'undefined') {
      localStorage.setItem('sound_effects_volume', String(this.volume));
      window.dispatchEvent(new CustomEvent('sound-settings-changed'));
    }
  }

  /**
   * Звук отправки сообщения (Telegram-like bubble/pop)
   */
  public playSent() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.25 * this.volume, now);
      master.connect(ctx.destination);

      // Основной тон
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(520, now);
      osc1.frequency.exponentialRampToValueAtTime(1080, now + 0.08);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.7, now + 0.008);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc1.connect(gain1);
      gain1.connect(master);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // Гармонический обертон
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(860, now + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(1480, now + 0.09);

      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.setValueAtTime(0.35, now + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc2.connect(gain2);
      gain2.connect(master);
      osc2.start(now + 0.02);
      osc2.stop(now + 0.13);
    } catch (e) {
      console.warn('Audio playSent error:', e);
    }
  }

  /**
   * Звук входящего сообщения (Telegram crystal bell chime)
   */
  public playReceived() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * this.volume, now);
      master.connect(ctx.destination);

      // Нота 1: E5 (~659 Гц)
      this.synthesizeBellTone(ctx, master, 659.25, now, 0.28, 0.7);
      // Нота 2: B5 (~987 Гц) через 80мс
      this.synthesizeBellTone(ctx, master, 987.77, now + 0.08, 0.42, 0.85);
    } catch (e) {
      console.warn('Audio playReceived error:', e);
    }
  }

  private synthesizeBellTone(
    ctx: AudioContext,
    dest: AudioNode,
    freq: number,
    startTime: number,
    duration: number,
    volume: number
  ) {
    // Основной синус
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + duration);

    // Металлический колокольчиковый обертон
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.setValueAtTime(freq * 2.756, startTime);

    harmGain.gain.setValueAtTime(0.0001, startTime);
    harmGain.gain.linearRampToValueAtTime(volume * 0.25, startTime + 0.004);
    harmGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.45);

    harm.connect(harmGain);
    harmGain.connect(dest);
    harm.start(startTime);
    harm.stop(startTime + duration * 0.45);
  }

  /**
   * Звук старта записи голосового сообщения
   */
  public playRecordStart() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.25 * this.volume, now);
      master.connect(ctx.destination);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(784, now + 0.08); // G5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      console.warn('Audio playRecordStart error:', e);
    }
  }

  /**
   * Звук остановки / отмены записи
   */
  public playRecordStop() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.22 * this.volume, now);
      master.connect(ctx.destination);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.07); // A4

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {
      console.warn('Audio playRecordStop error:', e);
    }
  }

  /**
   * Звук закрепления сообщения (Metallic pin chime)
   */
  public playPin() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.3 * this.volume, now);
      master.connect(ctx.destination);

      this.synthesizeBellTone(ctx, master, 1174.66, now, 0.22, 0.6); // D6
      this.synthesizeBellTone(ctx, master, 1760.0, now + 0.06, 0.35, 0.7); // A6
    } catch (e) {
      console.warn('Audio playPin error:', e);
    }
  }

  /**
   * Звук завершения звонка
   */
  public playCallEnd() {
    if (!this.isEnabled) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.28 * this.volume, now);
      master.connect(ctx.destination);

      const playPip = (f: number, t: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.6, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.13);
      };

      playPip(480, now);
      playPip(360, now + 0.14);
    } catch (e) {
      console.warn('Audio playCallEnd error:', e);
    }
  }

  /**
   * Запуск повторяющегося звонка входящего вызова (Incoming call ringtone)
   */
  public startIncomingRingtone() {
    if (!this.isEnabled) return;
    this.stopCallSounds();

    const ring = () => {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.35 * this.volume, now);
      master.connect(ctx.destination);

      // Мелодичный мотив: D5 -> F#5 -> A5
      this.synthesizeBellTone(ctx, master, 587.33, now, 0.3, 0.6);
      this.synthesizeBellTone(ctx, master, 739.99, now + 0.15, 0.3, 0.6);
      this.synthesizeBellTone(ctx, master, 880.0, now + 0.3, 0.45, 0.7);

      // Второй аккорд через 0.6с
      this.synthesizeBellTone(ctx, master, 587.33, now + 0.6, 0.3, 0.5);
      this.synthesizeBellTone(ctx, master, 880.0, now + 0.75, 0.6, 0.7);
    };

    ring();
    this.ringtoneInterval = setInterval(ring, 2600);
  }

  /**
   * Запуск гудков исходящего вызова (Outgoing dial tone)
   */
  public startOutgoingRingtone() {
    if (!this.isEnabled) return;
    this.stopCallSounds();

    const dialTone = () => {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.2 * this.volume, now);
      master.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(425, now);
      osc2.frequency.setValueAtTime(475, now);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.4, now + 0.05);
      g.gain.setValueAtTime(0.4, now + 0.95);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(master);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.1);
      osc2.stop(now + 1.1);
    };

    dialTone();
    this.outgoingInterval = setInterval(dialTone, 3500);
  }

  /**
   * Остановка всех мелодий звонка
   */
  public stopCallSounds() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }
}

export const soundEffects = new SoundEffectsEngine();
