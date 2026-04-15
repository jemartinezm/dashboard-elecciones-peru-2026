// M13 — ONPE API client
//
// Dos modos, mismo contrato:
//
//   • Local dev:   el frontend habla con `./api/*` → dev_server.py lo proxea
//                  al upstream configurado en ese script.
//
//   • GitHub Pages: el frontend habla directamente con un Cloudflare Worker
//                   propio (ver `worker/` en la raíz) — WORKER_URL abajo.
//
// Responsabilidad: llamar los endpoints, transformar el schema del upstream
// al schema interno (onpe_live.json) que consumen todos los módulos.

// ───────────────────────────────────────────────────────────────────────────
// Config
// ───────────────────────────────────────────────────────────────────────────

/**
 * URL del Cloudflare Worker propio. Se usa solo cuando la página NO está en
 * localhost (en local se usa `./api/*` que dev_server.py proxea).
 *
 * Después de `npx wrangler deploy` en el directorio `worker/`, pega la URL
 * resultante aquí (formato: https://onpe-proxy.<tu-subdominio>.workers.dev).
 *
 * Si queda en null → en Pages el botón "Actualizar" caerá silenciosamente
 * al JSON cacheado (sin romper nada, solo sin datos live).
 */
const WORKER_URL = null;  // TODO: reemplazar tras `wrangler deploy`

const IS_LOCAL = typeof location !== 'undefined' && (
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'
);

const API_BASE = IS_LOCAL ? '.' : (WORKER_URL ?? '');

const API = {
  snapshotHalf1: `${API_BASE}/api/snapshot?half=1`,
  snapshotHalf2: `${API_BASE}/api/snapshot?half=2`,
  tracking:      `${API_BASE}/api/tracking`,
};

const REQUEST_TIMEOUT_MS = 25000;

// Fuente del snapshot regional cuando el Worker devuelve `regions: []`
// (v1 del Worker todavía no implementa el fan-out por departamento).
const LOCAL_FALLBACK_LIVE = './data/onpe_live.json';

// ───────────────────────────────────────────────────────────────────────────
// HTTP helper
// ───────────────────────────────────────────────────────────────────────────

/** Fetch con timeout usando AbortController. */
async function fetchJson(url, { timeout = REQUEST_TIMEOUT_MS } = {}) {
  if (!url || url.startsWith('/api/') && !API_BASE) {
    throw new Error('API_BASE no configurado — despliega el Worker y edita WORKER_URL en js/onpeApi.js');
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} ${errBody.slice(0, 120)}`);
    }
    const data = await res.json();
    return { data, headers: res.headers };
  } finally {
    clearTimeout(t);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Transform: upstream schema → schema interno (onpe_live.json)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Mapeo de keys del upstream → keys del proyecto.
 * Upstream usa nombres cortos: fuji, rla, nieto, belm, sanch.
 * Nuestro esquema interno usa: fujimori, rla, nieto, belmont, sanchez.
 */
const KEY_MAP = {
  fuji:  'fujimori',
  rla:   'rla',
  nieto: 'nieto',
  belm:  'belmont',
  sanch: 'sanchez',
};

/** Upstream region → interno. */
function transformRegion(r) {
  const vv = Number(r.vv ?? 0);
  const out = {
    name:                r.name,
    pctActas:            Number(r.pct ?? 0),
    totalActas:          Number(r.totalActas ?? 0),
    actasContabilizadas: Number(r.contabilizadas ?? 0),
    vv,
  };
  for (const [src, dst] of Object.entries(KEY_MAP)) {
    const pct = Number(r[src] ?? 0);
    out[dst] = { pct, v: Math.round((pct / 100) * vv) };
  }
  return out;
}

/** Upstream national → campos top-level interno. */
function transformNational(nat, lastUpdateIso) {
  return {
    lastUpdate:           lastUpdateIso,
    nationalPct:          Number(nat?.pct ?? 0),
    totalActas:           Number(nat?.totalActas ?? 0),
    actasContabilizadas:  Number(nat?.contabilizadas ?? 0),
    enviadasJee:          Number(nat?.enviadasJee ?? 0),
    votosEmitidos:        Number(nat?.votosEmitidos ?? 0),
    votosValidos:         Number(nat?.votosValidos ?? 0),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

/**
 * Llama ambas halves en paralelo y retorna el snapshot consolidado en el
 * MISMO schema que `data/onpe_live.json`.
 *
 * Si el upstream devuelve `regions: []` (caso del Worker propio v1), se
 * mergea con las regiones del JSON estático committeado, para mantener el
 * mapa y el filtro regional funcionales hasta que el Worker implemente el
 * fan-out regional.
 *
 * @returns {Promise<{live: object, meta: {source, freshness, cacheStatus, fetchedAt}}>}
 */
export async function fetchLiveSnapshot() {
  const [h1, h2] = await Promise.all([
    fetchJson(API.snapshotHalf1),
    fetchJson(API.snapshotHalf2),
  ]);

  const now = new Date();
  const lastUpdate = now.toISOString().replace(/\.\d+Z$/, '');

  const national = h1.data.national ?? h2.data.national ?? {};
  const regionsRaw = [...(h1.data.regions ?? []), ...(h2.data.regions ?? [])];

  // Deduplicar por `name`.
  const seen = new Set();
  let regions = [];
  for (const r of regionsRaw) {
    if (!r?.name || seen.has(r.name)) continue;
    seen.add(r.name);
    regions.push(transformRegion(r));
  }

  // Fallback: si el Worker no envía regiones (v1), usar las cacheadas del
  // JSON committeado para mantener el mapa poblado.
  let regionsFromCache = false;
  if (regions.length === 0) {
    try {
      const res = await fetch(LOCAL_FALLBACK_LIVE, { cache: 'no-store' });
      if (res.ok) {
        const cached = await res.json();
        regions = Array.isArray(cached.regions) ? cached.regions : [];
        regionsFromCache = true;
      }
    } catch {
      regions = [];  // sigue vacío si el fallback también falla
    }
  }

  const live = {
    ...transformNational(national, lastUpdate),
    regions,
  };

  // Freshness viene del proxy local (X-Proxy-Cache) o del Worker (X-Cache).
  const cacheStatus = h1.headers.get('x-proxy-cache') || h1.headers.get('x-cache') || '';
  const cacheAge    = Number(h1.headers.get('x-proxy-cache-age') || h1.headers.get('x-cache-age') || 0);
  const freshness = cacheStatus === 'HIT'
    ? (cacheAge < 60 ? `hace ${cacheAge}s` : `hace ${Math.round(cacheAge / 60)}min`)
    : 'ahora';

  return {
    live,
    meta: {
      source: 'api',
      freshness,
      cacheStatus,
      fetchedAt: lastUpdate,
      regionsFromCache,  // true cuando el Worker no trae regiones
    },
  };
}

/**
 * Llama /api/tracking. Retorna el mismo schema que `data/tracking.json`.
 * Si el upstream no tiene tracking histórico (caso del Worker propio v1,
 * que responde 404), retorna null para que dataLoader caiga al JSON local.
 */
export async function fetchTrackingCuts() {
  try {
    const { data } = await fetchJson(API.tracking);
    if (Array.isArray(data?.cuts)) return data;
    if (Array.isArray(data))       return { cuts: data };
    return null;
  } catch {
    return null;
  }
}
