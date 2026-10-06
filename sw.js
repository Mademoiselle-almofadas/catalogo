/* Service Worker — Mademoiselle Almofadas
 * Torna o app instalável (abre sem a barra do navegador) e mais rápido.
 *
 * Estratégia SEGURA contra "versão travada":
 *   - HTML / navegação → NETWORK-FIRST: sempre pega a versão nova quando online;
 *     só usa o cache se o tablet estiver sem internet.
 *   - Qualquer OUTRO SITE (Google, BrasilAPI, minhareceita, fontes...) → não
 *     intercepta: vai direto pra rede, como se o service worker não existisse.
 *   - Ícones e assets do próprio site → cache-first (rápido), atualizando ao fundo.
 *
 * v2 (06/10/2026): a v1 só deixava passar o Google e guardava TODO o resto,
 * inclusive as consultas de CNPJ — e guardava até resposta de ERRO (429, 500).
 * O aparelho passava a devolver o erro velho daquele CNPJ sem consultar a
 * internet. Agora: só o próprio site é guardado, e só resposta OK.
 * O nome do cache mudou pra "v2": ao ativar, o cache v1 (com os erros
 * guardados) é apagado.
 */
const CACHE = "mma-cache-v2";
const APP_SHELL = ["./", "./index.html", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(APP_SHELL).catch(function () {});
  }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  // Outro site: não intercepta. Só o próprio app passa por aqui.
  if (new URL(req.url).origin !== self.location.origin) return;

  // Navegação / HTML → network-first (garante a versão mais recente quando online)
  var aceita = req.headers.get("accept") || "";
  if (req.mode === "navigate" || aceita.indexOf("text/html") !== -1) {
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); }).catch(function(){});
        }
        return resp;
      }).catch(function () {
        return caches.match("./index.html").then(function (r) { return r || caches.match("./"); });
      })
    );
    return;
  }

  // Demais assets do site → cache-first com atualização em segundo plano
  e.respondWith(
    caches.match(req).then(function (cached) {
      var rede = fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function(){});
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || rede;
    })
  );
});
