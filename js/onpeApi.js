// M13 — ONPE API client
// Consume el proxy local (dev_server.py) que agrega los datos de ONPE.
// El endpoint vive en el mismo origen (localhost:8000/api/*) → sin CORS.
//
// Responsabilidad: llamar los endpoints, mergear las halves, y transformar
// el schema del upstream al schema interno (onpe_live.json) que ya consumen
// todos los módulos existentes (M1 dataLoader).

const API = {
  snapshotHalf1: './api/snapshot?half=1',
  snapshotHalf2: './api/snapshot?half=2',
  tracking:      './api/tracking',
};

const REQUEST_TIMEOUT_MS = 25000;

/** Fetch con timeout usando AbortController. */
async function fetchJson(url, { timeout = REQUEST_TIMEOUT_MS } = {}) {
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

/**
 * Convierte una región del upstream al schema interno.
 *
 * Upstream: {name, pct, vv, totalActas, contabilizadas, enviadasJee,
 *            fuji, rla, nieto, belm, sanch}  (porcentajes directos)
 *
 * Interno:  {name, pctActas, totalActas, vv,
 *            fujimori:{pct,v}, rla:{pct,v}, nieto:{pct,v},
 *            belmont:{pct,v}, sanchez:{pct,v}}  (nested con votos absolutos)
 */
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

/** Convierte el bloque `national` del upstream a los campos top-level que espera dataLoader. */
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

/**
 * Llama ambas halves en paralelo y retorna el snapshot consolidado
 * en el MISMO schema que `data/onpe_live.json`.
 *
 * @returns {Promise<{ live: object, meta: {source:'api', freshness:string, cacheStatus:string, fetchedAt:string} }>}
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

  // Deduplicar por `name` en caso que el upstream solape entre halves.
  const seen = new Set();
  const regions = [];
  for (const r of regionsRaw) {
    if (!r?.name || seen.has(r.name)) continue;
    seen.add(r.name);
    regions.push(transformRegion(r));
  }

  const live = {
    ...transformNational(national, lastUpdate),
    regions,
  };

  // Freshness viene del proxy (header X-Proxy-Cache / X-Proxy-Cache-Age).
  const cacheStatus = h1.headers.get('x-proxy-cache') || '';
  const cacheAge    = Number(h1.headers.get('x-proxy-cache-age') || 0);
  const freshness = cacheStatus === 'HIT'
    ? (cacheAge < 60 ? `hace ${cacheAge}s` : `hace ${Math.round(cacheAge / 60)}min`)
    : 'ahora';

  return {
    live,
    meta: { source: 'api', freshness, cacheStatus, fetchedAt: lastUpdate },
  };
}

/**
 * Llama /api/tracking. Retorna el mismo schema que `data/tracking.json`.
 * Si el upstream no tiene tracking histórico, retorna null (no fatal).
 */
export async function fetchTrackingCuts() {
  try {
    const { data } = await fetchJson(API.tracking);
    // El Worker expone `cuts` directamente; si no, intentamos formatos alternos.
    if (Array.isArray(data?.cuts)) return data;
    if (Array.isArray(data))       return { cuts: data };
    return null;
  } catch {
    return null;  // fallback silencioso — no es crítico
  }
}
