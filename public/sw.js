// Fun 'N Fit push service worker. Push-only ON PURPOSE: no fetch handler and
// no caching, so deploys can never be poisoned by a stale cache. Its only job
// is showing game/team alert notifications and opening the app on tap.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Home-screen app icon badge. The SW has no synchronous storage, so the running
// count lives in a one-key cache. This is NOT response caching — no fetch
// handler reads it, so it can't serve stale app code. The app posts the
// authoritative count ({type:'badge:set'}) whenever its unread total changes;
// pushes that land while the app is closed just bump it by one.
const BADGE_CACHE = 'fnf-badge';
const BADGE_KEY = '/__fnf_badge__';

async function readBadge() {
  try {
    const cache = await caches.open(BADGE_CACHE);
    const res = await cache.match(BADGE_KEY);
    if (!res) return 0;
    return Number(await res.text()) || 0;
  } catch {
    return 0;
  }
}

async function writeBadge(count) {
  const n = Math.max(0, Math.floor(count) || 0);
  try {
    const cache = await caches.open(BADGE_CACHE);
    await cache.put(BADGE_KEY, new Response(String(n)));
  } catch { /* storage unavailable — badge still applied below */ }
  try {
    if (n > 0) await self.navigator.setAppBadge(n);
    else await self.navigator.clearAppBadge();
  } catch { /* Badging API unsupported */ }
  return n;
}

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'badge:set') {
    event.waitUntil(writeBadge(data.count));
  }
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
    Promise.all([
      self.registration.showNotification(title, {
        body: data.body || '',
        icon: '/fnfa-logo.png',
        badge: '/fnfa-logo.png',
        tag: data.tag || 'fnf-alert',
        data: { url: data.url || '/' },
      }),
      readBadge().then((n) => writeBadge(n + 1)),
    ])
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
