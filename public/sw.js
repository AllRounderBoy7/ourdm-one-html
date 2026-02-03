// Service Worker for PWA functionality
const CACHE_NAME = 'ourdm-v2'; // Version badal diya taaki purana cache clear ho jaye

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Naye version ko turant activate karne ke liye
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event (Network-First Strategy)
self.addEventListener('fetch', (event) => {
  // Auth aur API calls ko cache mat karo
  if (event.request.url.includes('supabase.co')) {
    return fetch(event.request);
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Agar network sahi hai, toh cache update karo aur response bhejo
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resClone);
        });
        return response;
      })
      .catch(() => {
        // Agar network fail hua (offline), tabhi cache se uthao
        return caches.match(event.request);
      })
  );
});

// Activate event (Purane cache ko saaf karne ke liye)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Push & Notification click (Aapka logic sahi hai)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'New message on OurDM',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(data.title || 'OurDM', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
