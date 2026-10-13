// Service Worker for Push and Background Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const chatId = event.notification.data?.chatId;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ищем открытую вкладку приложения
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (chatId) {
            client.postMessage({ type: 'NAVIGATE_TO_CHAT', chatId });
          }
          return;
        }
      }
      // Если вкладка не открыта, открываем новую
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
