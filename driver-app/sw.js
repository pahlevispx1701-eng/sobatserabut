/**
 * SobatSerabut Driver — Service Worker v8.21.0
 * Background Running: Push Notifications, Offline Cache, Keep-Alive
 */
'use strict';

const CACHE_NAME = 'sobatserabut-driver-v8210';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/config.js',
  './js/app.js',
  './js/driver-v8191.js'
];

// ── Install: cache aset utama ─────────────────────────────────────────
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS).catch(function() {});
    })
  );
  self.skipWaiting();
});

// ── Activate: hapus cache lama ────────────────────────────────────────
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// ── Fetch: network-first, fallback cache ─────────────────────────────
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function(res) {
      // Cache respons fresh
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});

// ── Push Notification: Terima order baru ─────────────────────────────
self.addEventListener('push', function(e) {
  let data = { title: 'SobatSerabut Driver', body: 'Ada order baru masuk!', tag: 'order-baru' };
  try { if (e.data) data = Object.assign(data, e.data.json()); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/uploads/logo_icon.svg',
      badge: '/uploads/logo_icon.svg',
      vibrate: [300, 100, 300, 100, 300],
      tag: data.tag || 'sobatserabut-driver',
      requireInteraction: true,
      data: data
    })
  );
});

// ── Notification Click: buka aplikasi ────────────────────────────────
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.includes('/driver') && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }
      return self.clients.openWindow('/driver');
    })
  );
});

// ── Background Sync: keep-alive ping ─────────────────────────────────
self.addEventListener('sync', function(e) {
  if (e.tag === 'driver-keepalive') {
    e.waitUntil(fetch('/api/health').catch(function() {}));
  }
});

// ── Message: update SW ───────────────────────────────────────────────
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
