const CACHE_VERSION = "tasleya-shell-v2";
const CORE_SHELL_FILES = [
  "./",
  "index.html",
  "style.css",
  "mobile.css",
  "script.js",
  "firebase-config.js",
  "manifest.json",
  "assets/start-bg.png",
  "assets/icons/icon-192.svg",
  "assets/icons/icon-512.svg"
];

function isAppShellAsset(url) {
  const path = url.pathname.replace(/^\//, "");
  return CORE_SHELL_FILES.includes(path);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((oldKey) => caches.delete(oldKey))
      )
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

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("index.html", copy));
          return networkResponse;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  if (isAppShellAsset(requestUrl)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        const copy = networkResponse.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return networkResponse;
      });
    })
  );
});
