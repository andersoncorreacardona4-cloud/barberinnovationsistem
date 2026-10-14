//sw.js - Versión forzada para cambio de icono
const CACHE_NAME = 'barber-cache-vBarberIconFix'; // Nombre único para forzar actualización
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/registro.html',
  '/admin.html',
  // Asegúrate de incluir aquí cualquier otra URL o imagen crítica que uses
];

// Instalar el Service Worker y guardar en caché los recursos
self.addEventListener('install', event => {
  // Forzar al Service Worker entrante a convertirse en el Service Worker activo
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caché abierta y recursos guardados');
        return cache.addAll(urlsToCache);
      })
  );
});

// Activar el Service Worker y eliminar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Tomar control de las páginas abiertas inmediatamente
  );
});

// Responder con recursos en caché o buscar en la red
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retornar la respuesta si está en caché, de lo contrario buscar en la red
        return response || fetch(event.request);
      })
  );
});
