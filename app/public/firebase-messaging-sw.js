/* Service worker de Muévete: recibe los Web Push (Firebase Cloud Messaging) con la página
 * cerrada y abre la pantalla correspondiente al tocar la notificación.
 * No carga librerías externas: el aviso llega en el formato de FCM { notification, data }. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch (_) { p = { notification: { body: event.data && event.data.text() } }; }
  const n = p.notification || {};
  const data = p.data || {};
  const url = data.url || (p.fcmOptions && p.fcmOptions.link) || '/';
  event.waitUntil(self.registration.showNotification(n.title || 'Muévete', {
    body: n.body || '',
    icon: n.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url },
    tag: data.tag,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin)) { await c.focus(); return c.navigate(target); }
    }
    return self.clients.openWindow(target);
  })());
});
