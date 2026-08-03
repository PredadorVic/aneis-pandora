const VERSION = "aneis-v2.4.0-2026-08-03";

self.addEventListener("install", () => {
  // A nova versão aguarda a confirmação visual no aplicativo.
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
