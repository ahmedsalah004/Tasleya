// Manual update strategy:
// 1) Bump CACHE_NAME (v1 -> v2) on every deployment.
// 2) Bump ASSET_VERSION in index.html and here when CSS/JS files change.
const CACHE_NAME = "tasleya-cache-v4";
const ASSET_VERSION = "1.2.1";

const CORE_FILES = [
  "./",
  "index.html",
  `style.css?v=${ASSET_VERSION}`,
  `mobile.css?v=${ASSET_VERSION}`,
  `script.js?v=${ASSET_VERSION}`,
  "firebase-config.js",
  "manifest.json",
  "assets/start-bg-v2.webp",
  "assets/icons/icon-192.svg",
  "assets/icons/icon-512.svg"
];

const RELIABLE_UPDATE_FILES = new Set(["", "index.html", "style.css", "mobile.css", "script.js", "service-worker.js", "firebase-config.js"]);

function getPath(url) {
  return url.pathname.replace(/^\//, "");
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((oldKey) => caches.delete(oldKey)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = getPath(url);

  // Network-first for app shell entry + core CSS/JS to avoid stale iOS home-screen updates.
  if (event.request.mode === "navigate" || RELIABLE_UPDATE_FILES.has(path)) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || caches.match("index.html") || caches.match("./");
        })
    );
    return;
  }

  // Cache-first for static files that are safe to cache for offline usage.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return networkResponse;
      });
    })
  );
});
