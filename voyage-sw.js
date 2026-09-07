const CACHE = 'st-voyage-media-v1';
const REQUIRED = [
  './voyage.html',
  './voyage.css',
  './manifest-voyage.webmanifest',
  './js/voyage/app.js',
  './js/voyage/trip-model.js',
  './data/santa-teresa-trip.json',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './assets/photos/guide-map.svg',
  './assets/photos/piazza-v4b.jpg',
  './assets/photos/rena-v4b.jpg',
  './assets/photos/torre-v4b.jpg',
  './assets/photos/modesto-v4b.jpg',
  './assets/photos/faro-v4b.jpg',
  './assets/photos/francese-v4b.jpg',
  './assets/photos/luna-v4b.jpg',
  './assets/photos/brandali-v4b.jpg',
  './assets/photos/panorama-v4b.jpg',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(REQUIRED.map(async (url) => {
      const response = await fetch(url, {cache: 'no-cache'});
      if (response.ok) await cache.put(url, response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE && key.startsWith('st-voyage-')).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    if (url.hostname.endsWith('tile.openstreetmap.org')) {
      event.respondWith(staleWhileRevalidate(event.request, 'st-voyage-map-v1', 120));
    }
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE);
        if (response.ok) await cache.put('./voyage.html', response.clone());
        return response;
      } catch {
        return (await caches.match('./voyage.html')) || new Response('Guide hors ligne', {status: 503});
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request) || await caches.match(url.pathname);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return new Response('', {status: 504});
    }
  })());
});

async function staleWhileRevalidate(request, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fetchPromise = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      while (keys.length > maxEntries) await cache.delete(keys.shift());
    }
    return response;
  }).catch(() => hit);
  return hit || fetchPromise;
}
