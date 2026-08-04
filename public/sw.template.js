// Offline app shell for BLOCK 12 — SPEC.md 2/7.7, as amended by SPEC-V3.0.md section 5.
//
// SOURCE: public/sw.template.js. SHIPPED: dist/sw.js, generated from it by
// scripts/build-sw.mjs during `npm run build`, with the cache version
// substituted for the build id. Edit the template, never dist/sw.js, and never
// hardcode a version back into the template.
//
// Why the templating exists: CACHE_VERSION used to be the literal string
// 'block12-shell-v1'. Because this file's bytes never changed between deploys,
// the browser detected no service-worker update, `install` never re-ran, and
// `activate`'s cache purge never fired. Non-hashed assets (the manifest, the
// icons) were cached forever, and — the lethal case — a cold launch on a flaky
// connection fell back to the cached index.html, whose old hashed asset URLs
// still hit cache, so the app ran the previous build indefinitely. An
// installed iOS PWA has no reload button to escape that with.
//
// Caches the static app shell only, so the installed PWA opens with the phone
// in airplane mode. As of v2.0, sync/auth calls go to Supabase — those are
// cross-origin requests and pass straight through uncached (see the origin
// check below), so this worker never sees or caches auth/session data.
const CACHE_VERSION = '__CACHE_VERSION__';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  // NOTE: no skipWaiting() here, deliberately. The new worker installs, then WAITS.
  //
  // The page decides when to swap, because only the page knows whether the
  // athlete is mid-set. src/pwa/updates.ts posts SKIP_WAITING once it is safe:
  // app visible, not inside a session, local writes already flushed to Supabase.
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Cross-origin passthrough — this is what keeps Supabase's auth/sync fetches
  // uncached and unintercepted. Do not "fix" this into caching those responses.
  if (url.origin !== self.location.origin) return;

  // Hash-router SPA: every navigation loads the same document, route lives in
  // the URL fragment which never reaches the network.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
