// M1 — Data Loader
// Funciones puras: todas reciben datos como argumento, no usan estado global.

import { CANDIDATES, CANDIDATE_KEYS, OTROS, DATA_PATHS } from './config.js';
import { fetchLiveSnapshot, fetchTrackingCuts } from './onpeApi.js';

/**
 * Carga los JSON locales (fallback / carga inicial rápida).
 * @returns {Promise<{tracking: object, live: object, meta: {source:'cache'}}>}
 */
async function loadFromCache() {
  const [trackingRes, liveRes] = await Promise.all([
    fetch(DATA_PATHS.tracking),
    fetch(DATA_PATHS.live),
  ]);
  if (!trackingRes.ok) throw new Error(`tracking.json: HTTP ${trackingRes.status}`);
  if (!liveRes.ok)     throw new Error(`onpe_live.json: HTTP ${liveRes.status}`);

  const [tracking, live] = await Promise.all([trackingRes.json(), liveRes.json()]);
  return {
    tracking,
    live,
    meta: { source: 'cache', freshness: 'data estática', fetchedAt: live.lastUpdate },
  };
}

/**
 * Carga desde el proxy /api/*. Si falla, cae al JSON local.
 * @returns {Promise<{tracking: object, live: object, meta: {source:string, freshness:string, fetchedAt:string, warning?:string}}>}
 */
async function loadFromApi() {
  // Fuente live OBLIGATORIA → si falla, propagamos para hacer fallback.
  const { live, meta } = await fetchLiveSnapshot();

  // Tracking: intenta API, cae al JSON local si el endpoint no existe.
  let tracking = await fetchTrackingCuts();
  if (!tracking) {
    const res = await fetch(DATA_PATHS.tracking);
    if (res.ok) tracking = await res.json();
    else        tracking = { cuts: [] };
  }

  return { tracking, live, meta };
}

/**
 * Carga principal.
 *
 * @param {{ live?: boolean }} opts  Si live=true, intenta API primero y cae al
 *   JSON local si la API falla. Por defecto false → carga rápida desde cache.
 *
 * @returns {Promise<{tracking: object, live: object, meta: object}>}
 *   meta.source ∈ {'api' | 'cache'}
 *   meta.warning: mensaje presente si se cayó al fallback.
 */
export async function loadAll({ live = false } = {}) {
  if (live) {
    try {
      return await loadFromApi();
    } catch (err) {
      console.warn('[dataLoader] API fallback → cache:', err.message);
      try {
        const cache = await loadFromCache();
        return { ...cache, meta: { ...cache.meta, warning: `API no disponible (${err.message})` } };
      } catch (err2) {
        return {
          tracking: { error: true, message: err2.message },
          live:     { error: true, message: err2.message },
          meta:     { source: 'error', warning: err2.message },
        };
      }
    }
  }

  try {
    return await loadFromCache();
  } catch (err) {
    console.error('[dataLoader] loadAll failed:', err);
    return {
      tracking: { error: true, message: err.message },
      live:     { error: true, message: err.message },
      meta:     { source: 'error', warning: err.message },
    };
  }
}

/**
 * Resumen nacional.
 * onpe_live.json trae el agregado al nivel raíz — se usa directamente.
 * @param {object} live
 * @returns {{pct: number, totalActas: number, actasContabilizadas: number, lastUpdate: string}}
 */
export function getNationalSummary(live) {
  return {
    pct:                  live.nationalPct,
    totalActas:           live.totalActas,
    actasContabilizadas:  live.actasContabilizadas,
    lastUpdate:           live.lastUpdate,
  };
}

/**
 * Resultados nacionales por candidato.
 *
 * Si el payload `live` trae `candidatesNational` (viene del Worker v1 con
 * datos LIVE de ONPE), los usa directamente — match exacto con los %s de
 * la página oficial.
 *
 * Si no, cae al comportamiento original: suma votos de todas las regiones
 * (compatible con el schema de `data/onpe_live.json` cacheado).
 *
 * @param {object} live
 * @param {{topN?: number, includeOtros?: boolean}} opts
 * @returns {Array<{key, name, party, pct, votes, color}>}  ordenado por pct desc
 */
export function getCandidateNational(live, { topN = 5, includeOtros = true } = {}) {
  // ── Fast path: Worker already hands us the national breakdown ──────────
  if (Array.isArray(live.candidatesNational) && live.candidatesNational.length > 0) {
    const top5 = live.candidatesNational
      .map(c => ({
        key:   c.key,
        name:  CANDIDATES[c.key]?.name  ?? c.key,
        party: CANDIDATES[c.key]?.party ?? '',
        color: CANDIDATES[c.key]?.color ?? '#888',
        votes: c.votes,
        pct:   c.pct,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, topN);

    if (!includeOtros) return top5;

    const vvTotal   = Number(live.votosValidos ?? 0);
    const top5Votes = top5.reduce((s, c) => s + (c.votes || 0), 0);
    const top5Pct   = top5.reduce((s, c) => s + (c.pct   || 0), 0);
    const otrosVotes = Math.max(0, vvTotal - top5Votes);
    const otrosPct   = Math.max(0, 100 - top5Pct);

    return [
      ...top5,
      { key: OTROS.key, name: OTROS.name, party: OTROS.party, color: OTROS.color, votes: otrosVotes, pct: otrosPct },
    ];
  }

  // ── Fallback: aggregate from regions (legacy onpe_live.json schema) ────
  const regions = live.regions ?? [];
  let vvTotal = 0;
  const votesMap = {};
  CANDIDATE_KEYS.forEach(k => { votesMap[k] = 0; });

  for (const r of regions) {
    vvTotal += r.vv ?? 0;
    for (const k of CANDIDATE_KEYS) {
      votesMap[k] += r[k]?.v ?? 0;
    }
  }

  const top5 = CANDIDATE_KEYS.map(k => ({
    key:   k,
    name:  CANDIDATES[k].name,
    party: CANDIDATES[k].party,
    color: CANDIDATES[k].color,
    votes: votesMap[k],
    pct:   vvTotal > 0 ? (votesMap[k] / vvTotal) * 100 : 0,
  })).sort((a, b) => b.pct - a.pct).slice(0, topN);

  if (!includeOtros) return top5;

  const top5Votes = top5.reduce((s, c) => s + c.votes, 0);
  const otrosVotes = Math.max(0, vvTotal - top5Votes);
  const otrosPct   = vvTotal > 0 ? (otrosVotes / vvTotal) * 100 : 0;

  return [
    ...top5,
    { key: OTROS.key, name: OTROS.name, party: OTROS.party, color: OTROS.color, votes: otrosVotes, pct: otrosPct },
  ];
}

/**
 * Resultados por región específica.
 * Misma estructura de retorno que getCandidateNational.
 *
 * @param {object} live
 * @param {string} regionName
 * @returns {{region: object, candidates: Array}}
 */
export function getRegionData(live, regionName) {
  const region = (live.regions ?? []).find(r => r.name === regionName);
  if (!region) return { region: null, candidates: [] };

  const vvTotal = region.vv ?? 0;
  const top5 = CANDIDATE_KEYS.map(k => ({
    key:   k,
    name:  CANDIDATES[k].name,
    party: CANDIDATES[k].party,
    color: CANDIDATES[k].color,
    votes: region[k]?.v ?? 0,
    pct:   region[k]?.pct ?? 0,
  })).sort((a, b) => b.pct - a.pct);

  const top5Votes = top5.reduce((s, c) => s + c.votes, 0);
  const otrosVotes = Math.max(0, vvTotal - top5Votes);
  const otrosPct   = vvTotal > 0 ? (otrosVotes / vvTotal) * 100 : 0;

  const candidates = [
    ...top5,
    { key: OTROS.key, name: OTROS.name, party: OTROS.party, color: OTROS.color, votes: otrosVotes, pct: otrosPct },
  ];

  return { region, candidates };
}

/**
 * Convierte tracking.cuts a estructura Chart.js-ready para M5.
 * "Otros" no se incluye en el trend (tracking no tiene histórico de otros candidatos).
 *
 * @param {object} tracking
 * @returns {{ labels: string[], datasets: object[] }}
 */
export function getTrackingCuts(tracking) {
  const cuts = tracking.cuts ?? [];

  const labels = cuts.map(c => `${c.pct.toFixed(2)}%`);

  const datasets = CANDIDATE_KEYS.map(k => ({
    label:           CANDIDATES[k].name,
    data:            cuts.map(c => c[k] ?? null),
    borderColor:     CANDIDATES[k].color,
    backgroundColor: CANDIDATES[k].color + '33',  // 20% opacity fill
    borderWidth:     3,
    stepped:         true,
    pointStyle:      'rect',
    pointRadius:     4,
    pointBackgroundColor: CANDIDATES[k].color,
    tension:         0,
  }));

  return { labels, datasets };
}

/**
 * Comparación proyección propia vs encuestadoras.
 * Sin valores hardcoded — lee tracking.projection y tracking.references.
 *
 * @param {object} tracking
 * @returns {Array<{key, name, color, proyeccion, datum, ipsos, diffDatumIpsos}>}
 */
export function getProjectionComparison(tracking) {
  const proj = tracking.projection ?? {};
  const datum = tracking.references?.datum ?? {};
  const ipsos = tracking.references?.ipsos ?? {};

  return CANDIDATE_KEYS.map(k => {
    const d = datum[k] ?? null;
    const i = ipsos[k] ?? null;
    return {
      key:            k,
      name:           CANDIDATES[k].name,
      color:          CANDIDATES[k].color,
      proyeccion:     proj[k] ?? null,
      datum:          d,
      ipsos:          i,
      diffDatumIpsos: d !== null && i !== null ? Math.abs(d - i) : null,
    };
  }).sort((a, b) => (b.proyeccion ?? 0) - (a.proyeccion ?? 0));
}
