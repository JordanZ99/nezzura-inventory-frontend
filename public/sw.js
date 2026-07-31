// Nezzura Digital — Service Worker v1
const CACHE = "nezzura-v1";
const STATIC_ASSETS = [
  "/",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

// Instalación: cachea los assets estáticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activar inmediatamente sin esperar a que se cierren las páginas
  self.skipWaiting();
});

// Activación: limpia cachés antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  // Tomar control de todas las pestañas abiertas
  self.clients.claim();
});

// Estrategia: Network First con fallback a caché
self.addEventListener("fetch", (event) => {
  // Solo interceptar peticiones GET
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Si la respuesta es válida, clonarla y cachearla
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en caché
        return caches.match(event.request).then((cached) => {
          return cached || new Response("Sin conexión", { status: 503 });
        });
      })
  );
});
