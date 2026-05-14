/* Simple service worker for offline support */
const CACHE = 'viaggi-v6';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './data/trips.json',
  './manifest.webmanifest',
  'https://unpkg.com/globe.gl@2.32.6/dist/globe.gl.min.js',
  'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  'https://unpkg.com/three-globe/example/img/earth-topology.png',
  'https://unpkg.com/three-globe/example/img/night-sky.png',
  // Firebase SDK (caricato dinamicamente da db.js — qui solo precache best-effort)
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // network-first for trips.json so updates show; cache-first for everything else
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('/trips.json')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
