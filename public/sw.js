const cacheName = 'studycircle-offline-v1';
const fallback = new URL('offline.html', self.registration.scope).href;
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(cacheName).then((cache) => cache.add(fallback))),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('studycircle-offline-') && key !== cacheName)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('push', (event) => {
  let notification = {};
  try {
    notification = event.data?.json() || {};
  } catch {
    /* Use the generic notification. */
  }
  event.waitUntil(
    self.registration.showNotification('StudyCircle', {
      body: 'You have a new StudyCircle update.',
      icon: new URL('icon-192.png', self.registration.scope).href,
      tag:
        typeof notification.id === 'string'
          ? 'studycircle-' + notification.id
          : 'studycircle-update',
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.registration.scope));
      return existing ? existing.focus() : self.clients.openWindow(self.registration.scope);
    }),
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate' || !event.request.url.startsWith(self.registration.scope))
    return;
  event.respondWith(fetch(event.request).catch(() => caches.match(fallback)));
});
