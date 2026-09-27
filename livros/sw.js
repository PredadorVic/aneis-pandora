const VERSION = "livros-v1.4.6-compras";
const CACHE_SHELL = `${VERSION}-shell`;
const CACHE_DATA = `${VERSION}-data`;
const SHELL_FILES = ["./", "./index.html", "./app.css", "./app.js", "./manifest.json", "./icones/icone-180.png", "./icones/icone-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_SHELL).then((cache) => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE_SHELL, CACHE_DATA].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/dados.json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_DATA).then((cache) => cache.put("./dados.json", response.clone()));
          return response;
        })
        .catch(async () => {
          const saved = await (await caches.open(CACHE_DATA)).match("./dados.json");
          return saved || new Response(JSON.stringify({ execucoes: [] }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_SHELL).then((cache) => cache.put(request, response.clone()));
      return response;
    }))
  );
});

self.addEventListener("push", event => {
  const dados = event.data ? event.data.json() : {};
  event.waitUntil(self.registration.showNotification(dados.title || "Busca Preços", {
    body: dados.body || "Preços atualizados.", icon: "./icones/icone-180.png",
    badge: "./icones/icone-180.png", data: { url: dados.url || "../" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "../"));
});
