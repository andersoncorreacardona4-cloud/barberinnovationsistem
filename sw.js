const CACHE_NAME = 'barberia-pwa-v1';

// Instalación del Service Worker
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activación y limpieza de cachés antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estrategia de red prioritaria (ignora caché en llamadas a la API para datos en tiempo real)
self.addEventListener('fetch', (event) => {
    // Evitar interceptar peticiones de extensiones de navegador u otros protocolos extraños
    if (!event.request.url.startsWith('http')) {
        return;
    }

    // Las rutas de la API de MongoDB van directas por la red sin caché
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Opcional: podrías clonar y guardar en caché recursos estáticos si lo deseas
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
