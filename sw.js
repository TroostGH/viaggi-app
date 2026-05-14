/* Service worker — caching aggressivo ma con invalidazione automatica */
const CACHE = 'viaggi-v9';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './data/trips.json',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/favicon-48.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/globe.gl@2.32.6/dist/globe.gl.min.js',
  'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  'https://unpkg.com/three-globe/example/img/earth-topology.png',
  'https://unpkg.com/three-globe/example/img/night-sky.png',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Cancella TUTTE le cache vecchie (non solo quelle del SW)
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // Forza reload di tutti i tab aperti per applicare i nuovi asset
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => { try { c.navigate(c.url); } catch {} });
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // network-first per i file dell'app (per pickup veloce di update);
  // cache-first per asset esterni (CDN, texture, Firebase SDK).
  const sameOrigin = url.origin === self.location.origin;
  const isAppFile = sameOrigin && (
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('/trips.json') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.includes('/icons/')
  );

  if (isAppFile) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(e.request, { cache: 'no-cache' });
        const cache = await caches.open(CACHE);
        cache.put(e.request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(e.request);
        return cached || Response.error();
      }
    })());
    return;
  }

  // Asset esterni: cache-first
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
