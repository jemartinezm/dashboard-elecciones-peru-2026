// M8 — App Orchestrator
// Punto de entrada principal. Carga datos y conecta todos los módulos.

import { loadAll, getNationalSummary, getCandidateNational, getTrackingCuts } from './dataLoader.js';
import { renderHero }       from './hero.js';
import { renderSummary }    from './summaryBar.js';
import { renderKpiCards, updateKpiCards } from './kpiCards.js';
import { renderProbBars, updateProbBars } from './probBars.js';
import { renderTable }      from './candidateTable.js';
import { renderBarChart, updateBarChart, updateBarChartTheme } from './barChart.js';
import { renderTrendChart, updateTrendChartTheme }             from './trendChart.js';
import { initRegionFilter } from './regionFilter.js';
import { renderProjection } from './projectionPanel.js';
import { renderPeruMap, highlightRegion } from './peruMap.js';

// ─── Helpers de loader ────────────────────────────────────────────────────────

function showLoader() {
  document.getElementById('loader')?.style.removeProperty('display');
  document.getElementById('app')?.style.setProperty('display', 'none');
  document.getElementById('error-msg')?.style.setProperty('display', 'none');
}

function hideLoader() {
  document.getElementById('loader')?.style.setProperty('display', 'none');
  document.getElementById('app')?.style.removeProperty('display');
}

function showError(message) {
  document.getElementById('loader')?.style.setProperty('display', 'none');
  const errEl = document.getElementById('error-msg');
  if (errEl) {
    errEl.style.removeProperty('display');
    errEl.innerHTML = `
      <div class="nes-container is-dark is-rounded">
        <p class="nes-text is-error">⚠ Error al cargar datos</p>
        <p style="font-size:0.6rem">${message ?? 'No se pudo conectar con los archivos de datos.'}</p>
        <p style="font-size:0.55rem">Asegúrate de servir con: <code>python dev_server.py 8000</code></p>
      </div>`;
  }
}

// ─── Dark / Light toggle ──────────────────────────────────────────────────────

function applyTheme(isDark) {
  document.body.classList.toggle('light-mode', !isDark);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isDark ? 'MODO CLARO' : 'MODO OSCURO';
  updateBarChartTheme(isDark);
  updateTrendChartTheme(isDark);
}

// ─── Render compartido entre init() y refresh() ────────────────────────────────

/**
 * Renderiza TODO el dashboard a partir de un payload. Usado por carga inicial
 * (cache) y por refresh manual (API).
 *
 * @param {object} live      JSON onpe_live (local o transformado desde API)
 * @param {object} tracking  JSON tracking
 * @param {object} meta      { source: 'api'|'cache'|'error', freshness, warning? }
 * @param {boolean} initial  true en carga inicial (conecta listeners de filter/theme)
 */
async function renderAll(live, tracking, meta, { initial } = { initial: false }) {
  const summary = {
    ...getNationalSummary(live),
    // Prefer live Worker value (`live.votosValidos`) over sum-of-regions:
    // when regions come from the cached JSON fallback, summing them yields
    // stale vote totals that don't match ONPE's live count.
    totalVV: Number(live.votosValidos)
      || (live.regions ?? []).reduce((s, r) => s + (r.vv ?? 0), 0),
  };
  const nationalCandidates = getCandidateNational(live);
  const trackingCuts       = getTrackingCuts(tracking);

  // Render visual completo
  renderHero(summary, meta);
  renderSummary(summary);
  renderKpiCards(nationalCandidates, tracking);
  renderProbBars(nationalCandidates, summary.pct ?? 0);
  renderTable(nationalCandidates, document.querySelector('#candidate-table'));
  renderBarChart(nationalCandidates, 'bar-chart');
  renderTrendChart(trackingCuts, 'trend-chart');
  renderProjection(tracking);

  await renderPeruMap(live, (selectedRegionName) => {
    const select = document.getElementById('region-select');
    if (select && select.value !== (selectedRegionName ?? '')) {
      select.value = selectedRegionName ?? '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Filter re-initializes on every render (innerHTML overwrite limpia listeners)
  initRegionFilter(live, {
    onTableUpdate:     (data) => renderTable(data, document.querySelector('#candidate-table')),
    onChartUpdate:     (data) => updateBarChart(data),
    onSummaryUpdate:   (data) => renderSummary(data),
    onRegionHighlight: (name) => highlightRegion(name),
    onKpiUpdate:       (data) => updateKpiCards(data),
    onHeroUpdate:      (data) => renderHero(data, meta),
    onProbUpdate:      (data, pct) => updateProbBars(data, pct),
  });

  if (initial) {
    // Stagger reveal en primer paint
    document.querySelectorAll('#app > *').forEach((el, i) => {
      el.classList.add('stagger-in');
      el.style.animationDelay = `${i * 110}ms`;
    });
  }
}

// ─── Refresh manual desde API ─────────────────────────────────────────────────

async function refreshFromApi() {
  const btn = document.getElementById('btn-refresh');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Consultando ONPE…'; }

  try {
    const { live, tracking, meta } = await loadAll({ live: true });

    if (live.error) {
      console.error('[refresh] API falló:', live.message);
      alert('No se pudo contactar la API de ONPE.\n' + (live.message ?? ''));
      return;
    }

    await renderAll(live, tracking, meta, { initial: false });

    if (btn) {
      btn.textContent = meta.source === 'api'
        ? `✓ Actualizado · ${meta.freshness}`
        : '↺ Actualizar';
      setTimeout(() => { if (btn) btn.textContent = '↺ Actualizar'; }, 2500);
    }
  } catch (err) {
    console.error('[refresh] error inesperado:', err);
    if (btn) btn.textContent = '✗ Error';
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

// ─── Inicialización principal ─────────────────────────────────────────────────

async function init() {
  showLoader();

  const { tracking, live, meta } = await loadAll();  // carga rápida desde cache

  if (live.error || tracking.error) {
    showError(live.message ?? tracking.message);
    return;
  }

  hideLoader();

  await renderAll(live, tracking, meta, { initial: true });

  // Toggle dark/light
  let isDark = true;
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    isDark = !isDark;
    applyTheme(isDark);
  });

  // Botón actualizar → llama API en lugar de location.reload()
  document.getElementById('btn-refresh')?.addEventListener('click', refreshFromApi);
}

document.addEventListener('DOMContentLoaded', init);
