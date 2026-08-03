const VERSION = "aneis-v2-2026-08-03-r2";

self.addEventListener("install", () => {
  // Aguarda o clique da usuária em "Atualizar" antes de assumir o controle.
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  // Sem cache persistente: mantém o aplicativo simples e consulta a rede.
  event.respondWith(fetch(event.request));
});
