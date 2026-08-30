const VERSION = "aneis-v2.7.0-mobile-cache-fix";
const CACHE_SHELL = `${VERSION}-shell`;
const CACHE_DADOS = `${VERSION}-dados`;
const ARQUIVOS_SHELL = [
  "./", "./index.html", "./app.css", "./app.js", "./manifest.json",
  "./icones/icone-192.png", "./icones/icone-512.png", "./icones/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(ARQUIVOS_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(
        chaves.filter(chave => ![CACHE_SHELL, CACHE_DADOS].includes(chave)).map(chave => caches.delete(chave))
      ))
      .then(() => self.clients.claim())
  );
});

async function buscarComFallback(requisicao, cacheNome) {
  try {
    const resposta = await fetch(requisicao);
    if (resposta.ok) {
      const cache = await caches.open(cacheNome);
      await cache.put(requisicao, resposta.clone());
    }
    return resposta;
  } catch {
    return (await caches.match(requisicao)) || Response.error();
  }
}

self.addEventListener("fetch", event => {
  const requisicao = event.request;
  if (requisicao.method !== "GET") return;
  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/dados.json")) {
    event.respondWith(buscarComFallback(requisicao, CACHE_DADOS));
    return;
  }

  if (requisicao.mode === "navigate" || /\.(?:html|css|js)$/.test(url.pathname)) {
    event.respondWith(buscarComFallback(requisicao, CACHE_SHELL));
    return;
  }

  event.respondWith(
    caches.match(requisicao).then(cache => cache || buscarComFallback(requisicao, CACHE_SHELL))
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
