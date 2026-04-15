/**
 * Service Worker — network-first for same-origin assets.
 *
 * GitHub Pages sends `Cache-Control: max-age=600` on JS/CSS/JSON, which
 * means the browser holds stale modules for 10 min after any deploy. For
 * a live-data dashboard that's unacceptable (users see yesterday's numbers
 * until their cache expires).
 *
 * This SW intercepts every same-origin GET and refetches from the network
 * with `cache: 'no-store'` so updates are visible on the next page load.
 * If the network is unreachable (offline), falls back to whatever the
 * browser already has cached so the dashboard still renders.
 *
 * Scope: only same-origin requests are intercepted. External assets
 * (NES.css CDN, Press Start 2P font, Chart.js, D3, Cloudflare Worker
 * API calls) pass through untouched.
 */

const VERSION = 'v1';  // bump to force activation of a new SW

self.addEventListener('install', (event) => {
  // Take effect immediately instead of waiting for old clients to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Clean up any old HTTP caches (we don't pre-cache anything).
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    // Claim all open tabs so they start using this SW right away.
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only intercept same-origin GETs. Pass everything else through.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first: always try fresh, fall back to cache if offline.
  event.respondWith((async () => {
    try {
      return await fetch(new Request(req, { cache: 'no-store' }));
    } catch (err) {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
