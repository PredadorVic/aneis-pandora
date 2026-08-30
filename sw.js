const VERSION = "aneis-v2.6.0-2026-08-15-livros-integrados-menu-editorial-v3";
const CACHE_SHELL = `${VERSION}-shell`;
const CACHE_DADOS = `${VERSION}-dados`;
const ARQUIVOS_SHELL = [
  "./", "./index.html", "./app.css", "./app.js", "./manifest.json",
  "./icones/icone-192.png", "./icones/icone-512.png", "./icones/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_SHELL).then(cache => cache.addAll(ARQUIVOS_SHELL)));
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

self.addEventListener("fetch", event => {
  const requisicao = event.request;
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/dados.json")) {
    event.respondWith(
      fetch(requisicao)
        .then(resposta => {
          if (resposta.ok) {
            caches.open(CACHE_DADOS).then(cache => cache.put("./dados.json", resposta.clone()));
          }
          return resposta;
        })
        .catch(async () => {
          const salva = await (await caches.open(CACHE_DADOS)).match("./dados.json");
          return salva || new Response(JSON.stringify({ execucoes: [] }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(requisicao).then(cache => cache || fetch(requisicao).then(resposta => {
      if (resposta.ok) {
        caches.open(CACHE_SHELL).then(destino => destino.put(requisicao, resposta.clone()));
      }
      return resposta;
    }))
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
