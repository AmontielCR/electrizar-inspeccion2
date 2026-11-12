const CACHE = "electrizar-informes-shell-v2";
const APP = "/";
const currentCache = () => caches.open(CACHE);

async function cacheShell(request) {
  const cache = await currentCache();
  try {
    const response = await fetch(request);
    if (!response.ok) throw new Error("No se pudo cargar la aplicación.");
    const html = await response.clone().text();
    const assets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g), match => match[1]);
    if (!assets.length) throw new Error("El documento no contiene la aplicación compilada.");
    const pending = await Promise.all(assets.map(async asset => (await cache.match(asset)) ? null : asset));
    await cache.addAll(pending.filter(Boolean));
    await cache.put(APP, response.clone());
    return response;
  } catch (error) {
    const saved = await cache.match(APP);
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener("install", event => {
  event.waitUntil(cacheShell(new Request(APP, { cache: "reload" })).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => (key.startsWith("electrizar-informes-shell-") || key === "electrizar-op-v1") && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(cacheShell(request).catch(() => new Response("La aplicación aún no está disponible sin conexión.", { status: 503 })));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(currentCache().then(async cache => {
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
  }
});
