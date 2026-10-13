'use client';

import { useChatStore } from '@/store/useStore';

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string | null;
  badge?: string;
  tag?: string;
  chatId?: string;
  onClick?: () => void;
}

class NotificationManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('push_notifications_enabled');
      if (saved !== null) {
        this.isEnabled = saved === 'true';
      }

      this.initServiceWorker();
      this.listenToSwMessages();
    }
  }

  private async initServiceWorker() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      this.swRegistration = reg;
    } catch (e) {
      console.warn('Service worker registration failed:', e);
    }
  }

  private listenToSwMessages() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NAVIGATE_TO_CHAT' && event.data.chatId) {
        useChatStore.getState().setActiveChatId(event.data.chatId);
      }
    });
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setEnabled(val: boolean) {
    this.isEnabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('push_notifications_enabled', String(val));
      window.dispatchEvent(new CustomEvent('push-settings-changed'));
    }
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        this.setEnabled(true);
      }
      return perm;
    } catch (e) {
      console.warn('Error requesting notification permission:', e);
      return 'denied';
    }
  }

  /**
   * Показать нативное Desktop Push-уведомление
   */
  public async show(payload: NotificationPayload) {
    if (!this.isEnabled || !this.isSupported()) return;
    if (Notification.permission !== 'granted') return;

    const icon = payload.icon || '/favicon.ico';
    const tag = payload.tag || payload.chatId || 'messenger_notification';

    // 1. Попытка через Service Worker (предпочтительно для PWA / background)
    if (this.swRegistration && 'showNotification' in this.swRegistration) {
      try {
        await this.swRegistration.showNotification(payload.title, {
          body: payload.body,
          icon,
          tag,
          data: { chatId: payload.chatId },
        });
        return;
      } catch (e) {
        console.warn('SW showNotification failed, falling back to window.Notification:', e);
      }
    }

    // 2. Fallback через стандартный Window Notification API
    try {
      const notification = new Notification(payload.title, {
        body: payload.body,
        icon,
        tag,
      });

      notification.onclick = () => {
        window.focus();
        if (payload.chatId) {
          useChatStore.getState().setActiveChatId(payload.chatId);
        }
        if (payload.onClick) {
          payload.onClick();
        }
        notification.close();
      };
    } catch (e) {
      console.warn('Notification constructor failed:', e);
    }
  }
}

export const pushNotifications = new NotificationManager();
