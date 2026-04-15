// M6 — Region Filter
// Select de departamento con loading state y advertencia de cobertura baja.

import { getNationalSummary, getCandidateNational, getRegionData } from './dataLoader.js';

const LOW_COVERAGE_THRESHOLD = 50;

function updateCoverageBadge(pct) {
  const badge = document.querySelector('#region-coverage-badge');
  if (!badge) return;
  if (pct === null) { badge.textContent = ''; return; }
  const cls = pct >= 70 ? 'nes-text is-success' : pct >= 50 ? 'nes-text is-warning' : 'nes-text is-error';
  badge.innerHTML = `<span class="${cls}">${pct.toFixed(1)}% actas</span>`;
}

/**
 * Inicializa el filtro de regiones.
 *
 * @param {object} live  onpe_live.json parseado
 * @param {{ onTableUpdate, onChartUpdate, onSummaryUpdate }} updateCallbacks
 */
export function initRegionFilter(live, { onTableUpdate, onChartUpdate, onSummaryUpdate, onRegionHighlight }) {
  const container = document.querySelector('#region-filter');
  if (!container) return;

  const regions = live.regions ?? [];
  const regionNames = regions.map(r => r.name).sort();

  // Render del select
  const options = [
    '<option value="">Nacional</option>',
    ...regionNames.map(n => `<option value="${n}">${n}</option>`),
  ].join('');

  container.innerHTML = `
    <div class="nes-container is-dark with-title filter-wrap">
      <p class="title">Filtrar por región</p>
      <div class="filter-row">
        <div class="nes-select filter-select-wrap">
          <select id="region-select" aria-label="Filtrar por región">
            ${options}
          </select>
        </div>
        <span id="region-coverage-badge" class="region-badge"></span>
      </div>
    </div>
    <div id="region-warning" role="alert" aria-live="assertive" style="display:none"></div>
  `;

  container.querySelector('#region-select').addEventListener('change', async (e) => {
    const selectedRegion = e.target.value;

    // Mostrar estado de carga
    document.querySelector('#candidate-table')?.classList.add('is-loading-region');
    document.querySelector('#bar-chart-container')?.classList.add('is-loading-region');

    // Resolver datos según selección
    let candidates, summaryData;

    if (!selectedRegion) {
      // Nacional
      candidates  = getCandidateNational(live);
      summaryData = getNationalSummary(live);
      hideWarning(container);
      updateCoverageBadge(null);
    } else {
      const { region, candidates: regionCandidates } = getRegionData(live, selectedRegion);
      candidates = regionCandidates;
      summaryData = {
        pct:                 region?.pctActas ?? 0,
        totalActas:          region?.totalActas ?? 0,
        actasContabilizadas: region ? Math.round((region.pctActas / 100) * region.totalActas) : 0,
        lastUpdate:          live.lastUpdate,
        totalVV:             region?.vv ?? 0,
      };

      if (region && (region.pctActas ?? 0) < LOW_COVERAGE_THRESHOLD) {
        showWarning(container, region.pctActas);
      } else {
        hideWarning(container);
      }
      updateCoverageBadge(region?.pctActas ?? 0);
    }

    // Sync map highlight — idempotent, no re-fires map's onSelect callback
    if (onRegionHighlight) onRegionHighlight(selectedRegion || null);

    // Actualizar módulos
    onTableUpdate(candidates);
    onChartUpdate(candidates);
    onSummaryUpdate(summaryData);

    // Quitar loading
    document.querySelector('#candidate-table')?.classList.remove('is-loading-region');
    document.querySelector('#bar-chart-container')?.classList.remove('is-loading-region');
  });
}

function showWarning(container, pct) {
  const el = container.querySelector('#region-warning');
  if (!el) return;
  el.innerHTML = `
    <div class="nes-balloon from-left is-dark warning-balloon">
      ⚠ Solo ${pct.toFixed(1)}% de actas procesadas en esta región
    </div>
  `;
  el.style.display = '';
}

function hideWarning(container) {
  const el = container.querySelector('#region-warning');
  if (el) el.style.display = 'none';
}
