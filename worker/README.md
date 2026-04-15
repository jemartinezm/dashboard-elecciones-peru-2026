# onpe-proxy — Cloudflare Worker

Stateless proxy that fetches **live presidential election data** from ONPE
and exposes it with CORS headers so the GitHub Pages dashboard can consume
it from the browser.

- **Upstream:** `https://resultadoelectoral.onpe.gob.pe/presentacion-backend`
- **Cache:** 30 s edge cache per response (keeps ONPE load light)
- **Cost:** Well inside Cloudflare's **free tier** (< 100k requests/day)

---

## Endpoints

| Path | Response |
|---|---|
| `GET /api/snapshot?half=1` | `{ national: {...}, regions: [] }` with live national totals + top-5 candidate percentages |
| `GET /api/snapshot?half=2` | Same as above — kept for frontend compatibility |
| `GET /api/tracking`        | `404` — the frontend falls back to the committed `data/tracking.json` |
| `GET /`                    | health check |

Regions are intentionally empty in v1. The frontend merges them with the
snapshot committed in the repo (`data/onpe_live.json`), so the choropleth
map stays populated with the last known regional distribution.

---

## Deploy (5 minutes, one time)

### 1. Install Wrangler

```bash
cd worker
npm install
```

### 2. Authenticate

```bash
npx wrangler login
```

Opens a browser for Cloudflare OAuth. If you don't have an account, the flow
lets you create one for free.

### 3. Deploy

```bash
npx wrangler deploy
```

Output includes the Worker URL, typically:

```
https://onpe-proxy.<your-subdomain>.workers.dev
```

### 4. Wire the frontend

Open [`../js/onpeApi.js`](../js/onpeApi.js) and paste the URL into the
`WORKER_URL` constant at the top:

```js
const WORKER_URL = 'https://onpe-proxy.<your-subdomain>.workers.dev';
```

Commit and push — GitHub Pages rebuilds in ~1 minute.

---

## Smoke tests

```bash
# Worker health
curl https://onpe-proxy.<your-subdomain>.workers.dev/
# → {"name":"onpe-proxy","version":1,"ok":true}

# Live snapshot
curl https://onpe-proxy.<your-subdomain>.workers.dev/api/snapshot?half=1 | jq .national.pct
# → 91.x (current % of actas contabilizadas)

# Verify CORS from browser origin
curl -D - -o /dev/null -s \
  -H "Origin: https://<your-user>.github.io" \
  https://onpe-proxy.<your-subdomain>.workers.dev/api/snapshot?half=1 \
  | grep -i access-control
# → Access-Control-Allow-Origin: *
```

---

## Local development

```bash
npx wrangler dev
```

Starts on `http://127.0.0.1:8787`. Hit the endpoints the same way —
useful when tweaking the transform logic in `src/index.js`.

---

## Updating the Worker

Just edit `src/index.js` and run `npx wrangler deploy` again. The URL stays
the same, so no frontend change needed.

---

## Future work: regional data

Currently `regions: []`. To populate the map with live regional data:

1. Discover the regional filter pattern on ONPE's backend (likely a
   `tipoFiltro=ubigeo` variant with a specific ubigeo schema).
2. Add a `fetchRegions()` helper that fans out 25 requests (one per
   departamento) using Cloudflare's subrequest budget (50 per invocation on
   free tier — we're currently using 2, so plenty of room).
3. Map the responses into the `regions` array with the same shape the
   frontend expects: `{name, pct, vv, totalActas, fuji, rla, nieto, belm, sanch}`.

Until then, the frontend falls back to `data/onpe_live.json` for the map
and region filter — which works, just lags the national data.
