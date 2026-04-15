"""Tiny dev HTTP server with static files + ONPE API proxy.

Two responsibilities:

1.  **Static site** — serves the dashboard files with ``Cache-Control: no-store``
    so ES modules always revalidate (essential for iterative dev).

2.  **Local API proxy** — forwards ``/api/snapshot`` and ``/api/tracking`` to a
    configurable upstream. The dashboard talks ONLY to ``localhost:8000/api/*``
    so it is vendor-agnostic — swap the upstream here without touching any JS.

Configuration lives in the ``UPSTREAM`` block below.

Usage:  ``python dev_server.py [port]``  (default 8000)
"""

import http.server
import json
import sys
import time
import urllib.error
import urllib.request

# ---------------------------------------------------------------------------
# UPSTREAM CONFIG — edit these to swap the aggregated-JSON source
# ---------------------------------------------------------------------------
# The dashboard expects the upstream to expose two endpoints with these shapes:
#
#   GET /api/snapshot?half=1 → { "national": {...}, "regions": [...] }
#   GET /api/snapshot?half=2 → { "national": {...}, "regions": [...] }
#   GET /api/tracking        → { "cuts": [...], "projection": {...}, ... }
#
# Current upstream: Renzo Núñez's public Cloudflare Worker. When you deploy
# your own aggregator (self-hosted Worker, scraper, backend service, etc.),
# change UPSTREAM_BASE and this proxy will route transparently — no frontend
# changes required.
UPSTREAM_BASE = "https://onpe-proxy.renzonunez-af.workers.dev"

# Request timeout to upstream (seconds). Kept generous because Renzo's Worker
# can take a few seconds during heavy ONPE updates.
UPSTREAM_TIMEOUT = 20

# In-memory cache: short TTL so rapid clicks on "Actualizar" don't hammer the
# upstream. When the user actively refreshes, data no older than this is fine.
CACHE_TTL_SECONDS = 15

_cache: dict[str, tuple[float, int, bytes, str]] = {}  # path → (ts, status, body, content-type)


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------
class DevHandler(http.server.SimpleHTTPRequestHandler):
    """Static server + minimal JSON proxy."""

    # ---- static: send no-cache headers so edits are picked up immediately ----
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):  # type: ignore[override]
        # Disable 304 revalidation for static files during dev.
        if "If-Modified-Since" in self.headers:
            self.headers.replace_header("If-Modified-Since", "")
        if "If-None-Match" in self.headers:
            self.headers.replace_header("If-None-Match", "")
        return super().send_head()

    # ---- Windows: browser cancels mid-stream → don't crash the server ----
    def handle_one_request(self) -> None:  # type: ignore[override]
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    # ---- route /api/* to the proxy; everything else is static ----
    def do_GET(self) -> None:  # type: ignore[override]
        if self.path.startswith("/api/"):
            self._proxy_get(self.path)
            return
        super().do_GET()

    # ---- the actual proxy logic ------------------------------------------
    def _proxy_get(self, path: str) -> None:
        # Cache lookup: path+query acts as the key.
        now = time.time()
        cached = _cache.get(path)
        if cached and (now - cached[0]) < CACHE_TTL_SECONDS:
            ts, status, body, ctype = cached
            age = int(now - ts)
            self._send_json(status, body, ctype, cache_status="HIT", cache_age=age)
            return

        upstream_url = UPSTREAM_BASE.rstrip("/") + path
        req = urllib.request.Request(
            upstream_url,
            headers={"User-Agent": "dashboard-elecciones-local-proxy/1.0"},
        )

        try:
            with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as resp:
                status = resp.status
                body = resp.read()
                ctype = resp.headers.get("Content-Type", "application/json")
        except urllib.error.HTTPError as e:
            # Upstream responded with an error — surface it to the client.
            body = json.dumps({
                "error": "upstream_http_error",
                "status": e.code,
                "detail": str(e.reason),
                "upstream": upstream_url,
            }).encode("utf-8")
            self._send_json(502, body, "application/json", cache_status="ERROR")
            return
        except Exception as e:  # noqa: BLE001 — dev-time catch-all is fine
            body = json.dumps({
                "error": "upstream_unreachable",
                "detail": str(e),
                "upstream": upstream_url,
            }).encode("utf-8")
            self._send_json(502, body, "application/json", cache_status="ERROR")
            return

        _cache[path] = (now, status, body, ctype)
        self._send_json(status, body, ctype, cache_status="MISS", cache_age=0)

    def _send_json(
        self,
        status: int,
        body: bytes,
        ctype: str,
        cache_status: str = "",
        cache_age: int | None = None,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        # Same-origin so CORS is moot, but send headers anyway for clarity.
        self.send_header("Access-Control-Allow-Origin", "*")
        if cache_status:
            self.send_header("X-Proxy-Cache", cache_status)
        if cache_age is not None:
            self.send_header("X-Proxy-Cache-Age", str(cache_age))
        # Short client-side cache so repeated UI actions don't refetch.
        self.send_header("Cache-Control", f"public, max-age={CACHE_TTL_SECONDS}")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with http.server.ThreadingHTTPServer(("", port), DevHandler) as httpd:
        httpd.daemon_threads = True
        print(f"Dev server on http://localhost:{port}", flush=True)
        print(f"  static:  {sys.path[0] or '.'}", flush=True)
        print(f"  /api/*   →  {UPSTREAM_BASE}", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.", flush=True)


if __name__ == "__main__":
    main()
