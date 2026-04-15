// Glassly service worker — cache-first PWA with full offline support.
// CACHE_NAME is bumped automatically on each deploy by deploy.py, which
// rewrites the __VERSION__ token below before zipping.

const CACHE_NAME = 'glassly-__VERSION__';

const PRECACHE_URLS = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/style.css',
    'js/icons.js',
    'js/config.js',
    'js/dom.js',
    'js/state.js',
    'js/utils.js',
    'js/history.js',
    'js/editor.js',
    'js/glass.js',
    'js/gestures.js',
    'js/capture.js',
    'js/webgl_beauty.js',
    'js/camera.js',
    'js/main.js',
    'assets/icons/camerabutton.png',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
    'assets/icons/icon-180.png',
    'assets/icons/favicon.ico',
    'assets/frames/gauvamatong.png',
    'assets/frames/hoaanhdao.png',
    'assets/frames/mayvasao.png',
    'assets/frames/muahevabien.png',
    'assets/frames/polaroid_retro_90s.png',
    'assets/frames/scrapbooking.png',
    'assets/luts/inkwell.png',
    'assets/luts/hudson.png',
    'assets/luts/nashville.png',
    'assets/luts/walden.png',
    'assets/luts/lomo.png',
    // MediaPipe scripts from CDN
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js'
];

// Install: precache the app shell + assets so the first launch primes
// the cache for offline use.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Use { cache: 'reload' } so we bypass the HTTP cache when
            // priming, otherwise the SW could pin a stale build.
            return Promise.all(
                PRECACHE_URLS.map(url => fetch(url, { cache: 'reload' })
                    .then(resp => {
                        if (!resp || (!resp.ok && resp.type !== 'opaque')) return null;
                        return cache.put(url, resp.clone());
                    })
                    .catch(() => null))
            );
        }).then(() => self.skipWaiting())
    );
});

// Activate: drop any old caches that don't match the current version,
// then force every window client to reload. The navigate step rescues
// users whose cached main.js pre-dates our client-side controllerchange
// handler (commit e60cbda) — without it they would stay pinned to the
// old bundle forever, since the old main.js has no update logic at all.
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
        );
        await self.clients.claim();

        const windowClients = await self.clients.matchAll({ type: 'window' });
        await Promise.all(windowClients.map(client => {
            // client.navigate is limited to top-level, same-origin clients
            // and isn't available on every browser — swallow errors so one
            // unsupported client can't block the rest of activate.
            try {
                return Promise.resolve(client.navigate(client.url)).catch(() => null);
            } catch (_) {
                return null;
            }
        }));
    })());
});

// Fetch strategy:
//  - Navigation requests (HTML): network-first with cache fallback so a
//    single reload on a mobile browser is enough to see a fresh deploy.
//  - Everything else (JS/CSS/images/MediaPipe CDN): cache-first, because
//    every asset URL is already cache-busted with ?v=<timestamp> by the
//    deploy pipeline, so cached entries are immutable for their version.
self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const isCacheable =
        url.origin === self.location.origin ||
        url.host.includes('jsdelivr.net') ||
        url.host.includes('gstatic.com') ||
        url.host.includes('googleapis.com');

    if (!isCacheable) return;

    const isNavigation = req.mode === 'navigate' || req.destination === 'document';

    if (isNavigation) {
        event.respondWith(
            fetch(req).then(resp => {
                if (resp && (resp.ok || resp.type === 'opaque')) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
                }
                return resp;
            }).catch(() =>
                caches.match(req).then(cached => cached || caches.match('index.html'))
            )
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(resp => {
                if (!resp || (!resp.ok && resp.type !== 'opaque')) return resp;
                const clone = resp.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(() => {});
                return resp;
            }).catch(() => caches.match('index.html'));
        })
    );
});
