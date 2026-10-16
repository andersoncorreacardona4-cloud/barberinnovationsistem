const CACHE_NAME = 'barber-app-v1';

// Archivos principales que la app guardará en caché para funcionamiento rápido
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/cliente.html',
  '/registro.html',
  '/manifest.json',
  '/manifest-cliente.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE).catch(err => {
                console.warn('Algunos archivos no se pudieron precargar:', err);
            });
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // IMPORTANTE: Evita guardar en caché las peticiones al backend (API de MongoDB) 
    // para que las citas, ingresos y ventas reflejen siempre datos en tiempo real.
    if (e.request.url.includes('/api/')) {
        return;
    }

    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
