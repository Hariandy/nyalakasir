/* Nyala Kasir service worker — offline app shell.
   Strategy: precache the shell; navigation = network-first with cache fallback
   (so updates arrive when online, app still opens offline); static = cache-first.
   New versions wait until the user taps "Muat ulang" (no mid-transaction reloads). */
const VERSION = "__VERSION__";
const CACHE = "nyala-shell-" + VERSION;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("nyala-shell-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const net = await Promise.race([fetch(req, { cache: "no-store" }), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3500))]);
        if (!net.ok) throw new Error("bad status");
        return net;
      } catch (_) {
        const c = await caches.open(CACHE);
        return (await c.match("./index.html")) || (await c.match("./")) || Response.error();
      }
    })());
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
