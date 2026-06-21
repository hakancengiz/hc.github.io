const CACHE_NAME = "frage-static-v81";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/app.css?v=10",
  "./assets/app.js?v=102",
  "./assets/db-worker.js?v=38",
  "./assets/mock-data.js?v=12",
  "./assets/icon.svg",
  "./assets/icons/favicon-16.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon-64.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/android-chrome-192.png",
  "./assets/icons/android-chrome-512.png",
  "./data/core.js?v=10",
  "./data/forms.js?v=10",
  "./data/examples.js?v=10",
  "./data/metadata.json?v=13",
  "./data/attributions.json?v=13",
  "./data/shards/manifest.json",
  "./vendor/sql-wasm.js",
  "./vendor/sql-wasm.wasm",
  "./README.md",
  "./THIRD_PARTY_NOTICES.md",
  "./DATA_LICENSES.md",
  "./SOURCES.md",
  "./RELEASE_CHECKLIST.md"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.includes("/data/shards/")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") return response;

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
