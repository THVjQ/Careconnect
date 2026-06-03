// ════════════════════════════════════════════════════════════
// CareConnect — Service Worker
// Caching, Push Notifications, Background Sync
// ════════════════════════════════════════════════════════════

const VER          = 'v1.0.0';
const CACHE_STATIC = `cc-static-${VER}`;

const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/base.css',
  '/css/components.css',
  '/core/config.js',
  '/core/events.js',
  '/core/state.js',
  '/core/api.js',
  '/core/auth.js',
  '/core/router.js',
  '/core/app.js',
  '/components/toast.js',
  '/components/modal.js',
  '/components/nav.js',
  '/components/bugReport.js',
  '/pages/dashboard.js',
  '/pages/roster.js',
  '/pages/reports.js',
  'https://cdn.jsdelivr.net/npm/pocketbase@0.21.1/dist/pocketbase.umd.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => c.addAll(STATIC_FILES).catch(err => console.warn('[SW] Cache partial fail:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_STATIC).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Don't cache PocketBase API calls
  if (url.pathname.startsWith('/api/') || url.hostname !== location.hostname && !url.hostname.includes('fonts') && !url.hostname.includes('jsdelivr')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE_STATIC).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached);
      return url.pathname.endsWith('.html') || url.pathname === '/' ? net.catch(() => cached) : cached || net;
    })
  );
});

// ── Push Notifications ─────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: 'CareConnect', body: 'New notification', icon: '/icons/icon-192.png', badge: '/icons/icon-72.png', url: '/', tag: 'cc' };
  if (e.data) try { Object.assign(data, e.data.json()); } catch { data.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: data.icon, badge: data.badge, tag: data.tag,
    data: { url: data.url }, vibrate: [200, 100, 200],
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url === url);
      return match ? match.focus() : clients.openWindow(url);
    })
  );
});

// ── Background Sync ────────────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-reports')  e.waitUntil(_syncPending('pending_reports'));
  if (e.tag === 'sync-messages') e.waitUntil(_syncPending('pending_messages'));
});

async function _syncPending(store) {
  const db      = await _idb();
  const pending = await _idbGetAll(db, store);
  for (const item of pending) {
    try {
      await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      await _idbDelete(db, store, item.id);
    } catch {}
  }
}

// Minimal IndexedDB helpers for offline queue
function _idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('cc-offline', 1);
    r.onupgradeneeded = e => {
      ['pending_reports','pending_messages'].forEach(s => {
        if (!e.target.result.objectStoreNames.contains(s))
          e.target.result.createObjectStore(s, { keyPath: 'id' });
      });
    };
    r.onsuccess = e => res(e.target.result);
    r.onerror   = e => rej(e.target.error);
  });
}
function _idbGetAll(db, store) {
  return new Promise((res, rej) => { const r = db.transaction(store,'readonly').objectStore(store).getAll(); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
}
function _idbDelete(db, store, id) {
  return new Promise((res, rej) => { const r = db.transaction(store,'readwrite').objectStore(store).delete(id); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); });
}
