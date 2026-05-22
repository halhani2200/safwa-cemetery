// Service Worker for Safwa Cemetery — Push + Offline + App Shell Caching

const CACHE_VERSION = 'safwa-v3-2026-05-21';
const APP_SHELL = [
    '/',
    '/index.html',
    '/icon.svg',
    '/manifest.json',
    '/offline.html'
];

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
            )
        ])
    );
});

// Fetch strategy: network-first for API/HTML, cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    // Skip cross-origin requests (let browser handle)
    if (url.origin !== self.location.origin) return;

    // Never cache /admin /staff /api/auth — sensitive
    if (url.pathname.startsWith('/admin/') ||
        url.pathname.startsWith('/staff/') ||
        url.pathname.startsWith('/api/auth/') ||
        url.pathname.startsWith('/login')) {
        return;
    }

    // Never cache API responses — may contain sensitive admin/staff data
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // HTML: network-first, fall back to offline page
    if (request.headers.get('Accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
                    return res;
                })
                .catch(() => caches.match(request).then((m) => m || caches.match('/offline.html')))
        );
        return;
    }

    // Static assets: cache-first
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((res) => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE_VERSION).then((c) => c.put(request, copy)).catch(() => {});
                }
                return res;
            }).catch(() => cached);
        })
    );
});

// Push notifications
self.addEventListener('push', (event) => {
    let data = {};
    try {
        if (event.data) data = event.data.json();
    } catch (e) {
        data = { title: 'إعلان جديد', body: event.data ? event.data.text() : '' };
    }

    const title = data.title || 'مقبرة صفوى';
    const options = {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || 'safwa-notification',
        renotify: true,
        requireInteraction: false,
        dir: 'rtl',
        lang: 'ar',
        data: {
            url: data.url || '/',
            announcement_id: data.announcement_id || null
        }
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (self.clients.openWindow) return self.clients.openWindow(url);
        })
    );
});
