// Fun 'N Fit push service worker. Push-only ON PURPOSE: no fetch handler and
// no caching, so deploys can never be poisoned by a stale cache. Its only job
// is showing game/team alert notifications and opening the app on tap.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Fun 'N Fit", body: event.data ? event.data.text() : '' };
  }
  const title = data.title || "Fun 'N Fit";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/fnfa-logo.png',
      badge: '/fnfa-logo.png',
      tag: data.tag || 'fnf-alert',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
