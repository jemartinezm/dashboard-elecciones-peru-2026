/**
 * onpe-proxy — Cloudflare Worker that fetches live election data from ONPE
 * and exposes a CORS-enabled JSON API for the dashboard on GitHub Pages.
 *
 * Endpoints:
 *   GET /api/snapshot?half=1|2 → { national: {...}, regions: [] }
 *   GET /api/tracking          → 404 (frontend falls back to local tracking.json)
 *   GET /                      → "onpe-proxy v1 — ok"
 *
 * Data source: https://resultadoelectoral.onpe.gob.pe/presentacion-backend
 *   /resumen-general/totales?idEleccion=10&tipoFiltro=eleccion
 *   /resumen-general/participantes?idEleccion=10&tipoFiltro=eleccion
 *
 * Schema confirmed live via DevTools network inspection (abril 2026).
 * Regional data not yet implemented — the frontend merges our empty
 * `regions: []` with the snapshot in `data/onpe_live.json`.
 */

const ONPE_BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend';
const ID_ELECCION_PRESIDENCIAL = 10;
const CACHE_TTL_SECONDS = 30;
const UPSTREAM_TIMEOUT_MS = 15000;

// Candidate DNI → short key used by the dashboard frontend.
// Sourced from ONPE's own index of candidate images.
const CANDIDATE_MAP = {
  '10001088': 'fuji',   // Keiko Fujimori
  '07845838': 'rla',    // Rafael López Aliaga
  '06506278': 'nieto',  // Jorge Nieto
  '16002918': 'sanch',  // Roberto Sánchez
  '09177250': 'belm',   // Ricardo Belmont
};

// Fallback matching by name fragment in case the DNI column ever changes.
const NAME_FALLBACK = [
  { key: 'fuji',  match: /FUJIMORI/i },
  { key: 'rla',   match: /LOPEZ\s+ALIAGA|LÓPEZ\s+ALIAGA/i },
  { key: 'nieto', match: /\bNIETO\b/i },
  { key: 'sanch', match: /SANCHEZ|SÁNCHEZ/i },
  { key: 'belm',  match: /BELMONT/i },
];

// CORS headers applied to every response.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({ name: 'onpe-proxy', version: 1, ok: true });
    }

    if (url.pathname === '/api/snapshot') {
      return handleSnapshot(url, ctx);
    }

    if (url.pathname === '/api/tracking') {
      // Tracking history is static in the frontend repo.
      return jsonResponse({ error: 'not_implemented', hint: 'frontend uses data/tracking.json' }, 404);
    }

    return jsonResponse({ error: 'not_found', path: url.pathname }, 404);
  },
};

// ---------------------------------------------------------------------------
// /api/snapshot — returns national aggregate + empty regions array
// ---------------------------------------------------------------------------

async function handleSnapshot(url, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(`https://cache/onpe/snapshot/v1`, { method: 'GET' });

  // Try cache first
  let cached = await cache.match(cacheKey);
  if (cached) {
    const age = Math.floor((Date.now() - Number(cached.headers.get('x-cached-at') || Date.now())) / 1000);
    const body = await cached.text();
    return new Response(body, {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'HIT', 'X-Cache-Age': String(age) },
    });
  }

  // Fetch fresh data from ONPE
  let national;
  try {
    national = await fetchNational();
  } catch (err) {
    return jsonResponse({ error: 'upstream_failed', detail: String(err) }, 502);
  }

  const payload = { national, regions: [] };
  const body = JSON.stringify(payload);

  // Store in cache with TTL
  const cacheResp = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      'x-cached-at': String(Date.now()),
    },
  });
  ctx.waitUntil(cache.put(cacheKey, cacheResp.clone()));

  return new Response(body, {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json', 'X-Cache': 'MISS', 'X-Cache-Age': '0' },
  });
}

// ---------------------------------------------------------------------------
// ONPE upstream fetchers + transformers
// ---------------------------------------------------------------------------

async function fetchNational() {
  const [totales, participantes] = await Promise.all([
    fetchOnpe(`/resumen-general/totales?idEleccion=${ID_ELECCION_PRESIDENCIAL}&tipoFiltro=eleccion`),
    fetchOnpe(`/resumen-general/participantes?idEleccion=${ID_ELECCION_PRESIDENCIAL}&tipoFiltro=eleccion`),
  ]);

  const t = totales?.data ?? {};
  const participants = Array.isArray(participantes?.data) ? participantes.data : [];

  return {
    pct:            Number(t.actasContabilizadas ?? 0),
    totalActas:     Number(t.totalActas ?? 0),
    contabilizadas: Number(t.contabilizadas ?? 0),
    enviadasJee:    Number(t.enviadasJee ?? 0),
    pendientesJee:  Number(t.pendientesJee ?? 0),
    votosEmitidos:  Number(t.totalVotosEmitidos ?? 0),
    votosValidos:   Number(t.totalVotosValidos ?? 0),
    candidates:     mapParticipants(participants),
  };
}

function mapParticipants(list) {
  const result = { fuji: 0, rla: 0, nieto: 0, sanch: 0, belm: 0 };
  for (const p of list) {
    const dni = String(p.dniCandidato ?? '');
    let key = CANDIDATE_MAP[dni];
    if (!key) {
      const name = String(p.nombreCandidato ?? '');
      const found = NAME_FALLBACK.find(f => f.match.test(name));
      if (found) key = found.key;
    }
    if (key) {
      const pct = Number(p.porcentajeVotosValidos ?? 0);
      if (pct > result[key]) result[key] = pct;
    }
  }
  return result;
}

async function fetchOnpe(path) {
  // ONPE sits behind CloudFront and uses the `Sec-Fetch-Site` + browser-like
  // User-Agent as part of its cache key: only requests that look same-origin
  // get routed to the JSON backend. Everything else gets the SPA HTML shell.
  // Discovered empirically in April 2026 — these two headers are the minimum
  // set that triggers the JSON response.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(ONPE_BASE + path, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://resultadoelectoral.onpe.gob.pe/',
      },
      // Use Cloudflare's edge cache for the upstream call too.
      cf: { cacheEverything: true, cacheTtl: CACHE_TTL_SECONDS },
    });
    if (!res.ok) throw new Error(`ONPE ${path}: HTTP ${res.status}`);
    const text = await res.text();
    // Defensive: if CloudFront still served HTML, surface a helpful error
    // instead of a cryptic JSON parse exception.
    if (text.trimStart().startsWith('<')) {
      throw new Error(`ONPE ${path}: unexpected HTML response (CloudFront served SPA shell)`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
