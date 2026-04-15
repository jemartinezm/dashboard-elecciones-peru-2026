// M9 — Peru Map (D3 choropleth by leading candidate)
// Exports: renderPeruMap(live, onSelect), highlightRegion(name|null)

import { CANDIDATES, CANDIDATE_KEYS } from './config.js';

/* global d3 */

const DEPT_PROP = 'NOMBDEP';

const GEO_NAME_MAP = {
  'AMAZONAS':     'Amazonas',
  'ANCASH':       'Áncash',
  'APURIMAC':     'Apurímac',
  'AREQUIPA':     'Arequipa',
  'AYACUCHO':     'Ayacucho',
  'CAJAMARCA':    'Cajamarca',
  'CALLAO':       'Callao',
  'CUSCO':        'Cusco',
  'HUANCAVELICA': 'Huancavelica',
  'HUANUCO':      'Huánuco',
  'ICA':          'Ica',
  'JUNIN':        'Junín',
  'LA LIBERTAD':  'La Libertad',
  'LAMBAYEQUE':   'Lambayeque',
  'LIMA':         'Lima',
  'LORETO':       'Loreto',
  'MADRE DE DIOS':'Madre de Dios',
  'MOQUEGUA':     'Moquegua',
  'PASCO':        'Pasco',
  'PIURA':        'Piura',
  'PUNO':         'Puno',
  'SAN MARTIN':   'San Martín',
  'TACNA':        'Tacna',
  'TUMBES':       'Tumbes',
  'UCAYALI':      'Ucayali',
};

// ─── Module state ─────────────────────────────────────────────────────────────
let _svg         = null;   // D3 selection of the <svg> root
let _regionIndex = null;   // Map<displayName, regionObject> built from live.regions
let _selected    = null;   // Display name of highlighted region, or null
let _onSelect    = null;   // Callback(name: string|null)

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the candidate key with the highest pct in a region, or null. */
function getLeader(region) {
  if (!region) return null;
  let maxPct = -1, leader = null;
  for (const k of CANDIDATE_KEYS) {
    const pct = region[k]?.pct ?? 0;
    if (pct > maxPct) { maxPct = pct; leader = k; }
  }
  return leader;
}

/**
 * Maps pctActas [0, 100] to fill-opacity [0.2, 1.0].
 * More processed actas → more opaque (more confident color).
 */
function coverageOpacity(pctActas) {
  if (!pctActas || pctActas <= 0) return 0.2;
  return 0.3 + (pctActas / 100) * 0.7;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Highlight a region from an external caller (e.g. the dropdown).
 * Does NOT fire _onSelect — safe to call from the change handler without
 * creating an event loop.
 *
 * @param {string|null} displayName  e.g. "Lima" or null to clear
 */
export function highlightRegion(displayName) {
  _selected = displayName;
  if (!_svg) return;
  _svg.selectAll('path.dept-path')
    .attr('stroke',       d => GEO_NAME_MAP[d.properties[DEPT_PROP]] === _selected ? '#4bff6b' : '#000000')
    .attr('stroke-width', d => GEO_NAME_MAP[d.properties[DEPT_PROP]] === _selected ? 3 : 2);
}

/**
 * Render the interactive choropleth map.
 * Fetches data/peru_geo.json and renders via D3 into #peru-map-container.
 *
 * @param {object}   live      Parsed onpe_live.json
 * @param {function} onSelect  Called with (name: string|null) when user clicks a region
 */
export async function renderPeruMap(live, onSelect) {
  _onSelect = onSelect;

  const section = document.getElementById('peru-map-container');
  if (!section) return;

  // Build region lookup: displayName → region object
  _regionIndex = new Map();
  for (const r of (live.regions ?? [])) _regionIndex.set(r.name, r);

  // Fetch GeoJSON
  let geo;
  try {
    const res = await fetch('./data/peru_geo.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    geo = await res.json();
  } catch (err) {
    section.innerHTML = `
      <div class="nes-container is-dark with-title">
        <p class="title">Mapa del Perú</p>
        <p style="font-size:0.55rem;color:#aaa;text-align:center;padding:1rem">
          ⚠ No se pudo cargar el mapa. Verifica data/peru_geo.json.
        </p>
      </div>`;
    console.error('[peruMap] GeoJSON load failed:', err);
    return;
  }

  // Build NES container structure
  section.innerHTML = `
    <div class="nes-container is-dark with-title">
      <p class="title">Mapa por Departamento</p>
      <div id="map-svg-area" class="map-svg-area"></div>
      <div id="map-legend"   class="map-legend" aria-label="Leyenda del mapa"></div>
    </div>`;

  const svgArea = document.getElementById('map-svg-area');
  const W = svgArea.clientWidth || 600;
  const H = window.innerWidth >= 768 ? 420 : 280;

  // D3 Mercator projection auto-fitted to container bounds
  const proj    = d3.geoMercator().fitSize([W, H], geo);
  const pathGen = d3.geoPath().projection(proj);

  _svg = d3.select(svgArea)
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`)
    .style('display', 'block')
    .attr('aria-label', 'Mapa electoral del Perú por departamento');

  // Transparent background — clicking it resets to national view
  _svg.append('rect')
    .attr('width', W)
    .attr('height', H)
    .attr('fill', 'transparent')
    .style('cursor', 'default')
    .on('click', () => {
      _selected = null;
      highlightRegion(null);
      if (_onSelect) _onSelect(null);
    });

  // Ensure the shared tooltip element exists
  let tooltip = document.getElementById('map-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id        = 'map-tooltip';
    tooltip.className = 'map-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
  }

  // Draw one path per department
  _svg.selectAll('path.dept-path')
    .data(geo.features)
    .join('path')
    .attr('class', 'dept-path')
    .attr('d', pathGen)
    .attr('fill', d => {
      const nm = GEO_NAME_MAP[d.properties[DEPT_PROP]];
      const r  = nm ? _regionIndex.get(nm) : null;
      const lk = getLeader(r);
      return lk ? CANDIDATES[lk].color : '#555555';
    })
    .attr('fill-opacity', d => {
      const nm = GEO_NAME_MAP[d.properties[DEPT_PROP]];
      const r  = nm ? _regionIndex.get(nm) : null;
      return coverageOpacity(r?.pctActas ?? 0);
    })
    .attr('stroke', '#000000')
    .attr('stroke-width', 2)
    .attr('shape-rendering', 'crispEdges')
    .style('cursor', 'pointer')
    .on('mousemove', function(event, d) {
      const nm  = GEO_NAME_MAP[d.properties[DEPT_PROP]];
      const r   = nm ? _regionIndex.get(nm) : null;
      const lk  = getLeader(r);
      const lName = lk ? CANDIDATES[lk].name : '—';
      const lPct  = (lk && r) ? (r[lk]?.pct ?? 0).toFixed(1) + '%' : '—';
      const aPct  = r ? (r.pctActas ?? 0).toFixed(1) + '%' : '—';

      tooltip.innerHTML = `
        <span class="tt-region">${nm ?? d.properties[DEPT_PROP]}</span>
        <span class="tt-leader">${lName}: ${lPct}</span>
        <span class="tt-actas">Actas: ${aPct}</span>`;
      tooltip.style.display = 'block';
      tooltip.style.left    = (event.pageX + 14) + 'px';
      tooltip.style.top     = (event.pageY - 10) + 'px';
    })
    .on('mouseleave', () => {
      tooltip.style.display = 'none';
    })
    .on('click', function(event, d) {
      event.stopPropagation();
      const nm = GEO_NAME_MAP[d.properties[DEPT_PROP]];
      if (!nm) return;  // Unknown region — ignore
      _selected = nm;
      highlightRegion(nm);
      if (_onSelect) _onSelect(nm);
    });

  // Render legend below the map
  _renderLegend(live, document.getElementById('map-legend'));
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function _renderLegend(live, legendEl) {
  if (!legendEl) return;

  // Count how many regions each candidate leads
  const counts = Object.fromEntries(CANDIDATE_KEYS.map(k => [k, 0]));
  for (const r of (live.regions ?? [])) {
    if (r.name === 'Extranjero') continue;
    const lk = getLeader(r);
    if (lk) counts[lk]++;
  }

  const sorted = CANDIDATE_KEYS
    .map(k => ({ k, name: CANDIDATES[k].name, color: CANDIDATES[k].color, n: counts[k] }))
    .sort((a, b) => b.n - a.n);

  legendEl.innerHTML = sorted.map(it => `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${it.color}"></span>
      <span>${it.name} (${it.n})</span>
    </span>`).join('') +
    `<span class="legend-item">
      <span class="legend-swatch" style="background:#555;opacity:0.5"></span>
      <span>Sin datos</span>
    </span>`;
}
