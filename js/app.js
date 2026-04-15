// M8 — App Orchestrator
// Punto de entrada principal. Carga datos y conecta todos los módulos.

import { loadAll, getNationalSummary, getCandidateNational, getTrackingCuts } from './dataLoader.js';
import { renderSummary }    from './summaryBar.js';
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
        <p style="font-size:0.55rem">Asegúrate de servir con: <code>python -m http.server 8000</code></p>
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

// ─── Inicialización principal ─────────────────────────────────────────────────

async function init() {
  showLoader();

  const { tracking, live } = await loadAll();

  if (live.error || tracking.error) {
    showError(live.message ?? tracking.message);
    return;
  }

  hideLoader();

  // Marcar módulos con fade-in
  document.querySelectorAll('#app > *').forEach(el => el.classList.add('fade-in'));

  // Datos nacionales
  const summary = {
    ...getNationalSummary(live),
    totalVV: (live.regions ?? []).reduce((s, r) => s + (r.vv ?? 0), 0),
  };
  const nationalCandidates = getCandidateNational(live);
  const trackingCuts       = getTrackingCuts(tracking);

  // Render inicial de todos los módulos
  renderSummary(summary);
  renderTable(nationalCandidates, document.querySelector('#candidate-table'));
  renderBarChart(nationalCandidates, 'bar-chart');
  renderTrendChart(trackingCuts, 'trend-chart');
  renderProjection(tracking);

  // M9: Mapa interactivo — await asegura SVG listo antes del filtro
  await renderPeruMap(live, (selectedRegionName) => {
    const select = document.getElementById('region-select');
    if (select && select.value !== (selectedRegionName ?? '')) {
      select.value = selectedRegionName ?? '';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // Filtro regional — conecta M2, M3, M4
  initRegionFilter(live, {
    onTableUpdate:     (data) => renderTable(data, document.querySelector('#candidate-table')),
    onChartUpdate:     (data) => updateBarChart(data),
    onSummaryUpdate:   (data) => renderSummary(data),
    onRegionHighlight: (name) => highlightRegion(name),
  });

  // Toggle dark/light
  let isDark = true;
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    isDark = !isDark;
    applyTheme(isDark);
  });

  // Botón actualizar
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    location.reload();
  });
}

document.addEventListener('DOMContentLoaded', init);
