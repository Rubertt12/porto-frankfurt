const CACHE_NAME = 'gestao-condominial-shell-v3';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/pwa-icon.svg', '/notification-badge.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

function notificationText(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    // Some push providers wrap the actual message in a JSON string.
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { return notificationText(JSON.parse(trimmed), fallback); } catch { return trimmed; }
    }
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => notificationText(item)).filter(Boolean).join(' · ') || fallback;
  if (value && typeof value === 'object') {
    for (const key of ['body', 'message', 'text', 'description', 'title', 'content']) {
      if (value[key] != null && value[key] !== value) {
        const result = notificationText(value[key], '');
        if (result) return result;
      }
    }
  }
  return fallback;
}

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || '' }; }
  const title = notificationText(data.title, 'Gestão Condominial');
  const appIcon = new URL('/pwa-icon.svg', self.location.origin).href;
  const notificationBadge = new URL('/notification-badge.svg', self.location.origin).href;
  event.waitUntil(self.registration.showNotification(title, {
    body: notificationText(data.body, 'Há uma nova informação no seu condomínio.'),
    icon: appIcon,
    badge: notificationBadge,
    image: appIcon,
    tag: data.tag || 'condominium-update',
    timestamp: Date.now(),
    vibrate: [180, 80, 180],
    data: { url: data.url || '/' },
    renotify: true
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => client.url.startsWith(self.location.origin));
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return self.clients.openWindow(target);
  }));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put('/index.html', copy));
      }
      return response;
    }).catch(async () => (await caches.match('/index.html')) || (await caches.match('/'))));
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })));
  }
});
