// M5 — Trend Chart (evolución del conteo)
// Líneas escalonadas estilo pixel-art. Solo datos nacionales (tracking.cuts).

/* global Chart */

let _trendChart = null;  // referencia module-scoped
const MOBILE_BREAKPOINT = 700;

/** Detecta si el viewport actual debe usar panel externo en vez de tooltip nativo. */
function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
}

/** Dibuja el panel externo con los valores del punto activo (o el último por defecto). */
function renderExternalPanel(chart, activeIndex = null) {
  const panel = document.querySelector('#trend-tooltip-panel');
  if (!panel || !chart) return;

  const datasets = chart.data.datasets ?? [];
  const labels   = chart.data.labels   ?? [];
  if (!datasets.length || !labels.length) { panel.innerHTML = ''; return; }

  // Por defecto usamos el último punto; si el usuario está hovering, usamos ese índice.
  const idx = activeIndex != null ? activeIndex : labels.length - 1;
  const label = labels[idx] ?? '';

  const rows = datasets
    .map(ds => ({ label: ds.label, color: ds.borderColor, value: Number(ds.data?.[idx] ?? 0) }))
    .sort((a, b) => b.value - a.value);

  const top = rows[0], sec = rows[1];
  const gap = top && sec ? (top.value - sec.value).toFixed(2) : '—';

  panel.innerHTML = `
    <div class="trend-panel-header">
      <span class="trend-panel-cut">Corte: ${label}</span>
      <span class="trend-panel-gap">1º-2º: ${gap} pts</span>
    </div>
    <ul class="trend-panel-list" role="list">
      ${rows.map(r => `
        <li class="trend-panel-item">
          <span class="trend-panel-swatch" style="background:${r.color}"></span>
          <span class="trend-panel-name">${r.label}</span>
          <span class="trend-panel-val">${r.value.toFixed(2)}%</span>
        </li>
      `).join('')}
    </ul>
  `;
}

/**
 * Renderiza el gráfico de evolución.
 * Si ya existe una instancia, la destruye primero.
 *
 * @param {{ labels: string[], datasets: object[] }} trackingCuts
 *   Resultado de getTrackingCuts(tracking)
 * @param {string} canvasId
 */
export function renderTrendChart(trackingCuts, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_trendChart) {
    _trendChart.destroy();
    _trendChart = null;
  }

  // Remontar listener una sola vez para sincronizar tooltip on/off en resize.
  if (!window.__trendResizeBound) {
    window.addEventListener('resize', () => {
      if (!_trendChart) return;
      _trendChart.options.plugins.tooltip.enabled = !isMobile();
      _trendChart.update('none');
    }, { passive: true });
    window.__trendResizeBound = true;
  }

  _trendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels:   trackingCuts.labels,
      datasets: trackingCuts.datasets,
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display:  true,
          position: 'bottom',
          labels: {
            font:          { family: "'Press Start 2P', monospace", size: 7 },
            color:         '#cccccc',
            boxWidth:      10,
            padding:       8,
            usePointStyle: true,
            pointStyle:    'rect',
          },
        },
        tooltip: {
          enabled: !isMobile(),  // en mobile usamos panel externo
          backgroundColor: '#212529',
          borderColor:     '#4bff6b',
          borderWidth:     2,
          titleFont:  { family: "'Press Start 2P', monospace", size: 8 },
          bodyFont:   { family: "'Press Start 2P', monospace", size: 8 },
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
          external: (ctx) => {
            // Sincroniza el panel externo con el punto activo del tooltip.
            const idx = ctx.tooltip?.dataPoints?.[0]?.dataIndex;
            renderExternalPanel(ctx.chart, idx ?? null);
          },
        },
      },
      onHover: (_evt, elements, chart) => {
        const idx = elements?.[0]?.index;
        if (idx != null) renderExternalPanel(chart, idx);
      },
      scales: {
        x: {
          title: {
            display: true,
            text:    '% actas procesadas',
            font:    { family: "'Press Start 2P', monospace", size: 7 },
            color:   '#cccccc',
          },
          ticks: {
            font:        { family: "'Press Start 2P', monospace", size: 6 },
            color:       '#cccccc',
            maxRotation: 0,
          },
          grid: { color: '#333333', borderDash: [4, 4] },
        },
        y: {
          min:  6,
          max:  18,
          title: {
            display: true,
            text:    '% votos',
            font:    { family: "'Press Start 2P', monospace", size: 7 },
            color:   '#cccccc',
          },
          ticks: {
            font:     { family: "'Press Start 2P', monospace", size: 6 },
            color:    '#cccccc',
            callback: v => v.toFixed(0) + '%',
            stepSize: 2,
          },
          grid: { color: '#333333', borderDash: [4, 4] },
        },
      },
    },
  });

  // Pinta el panel con el último cut como estado por defecto.
  renderExternalPanel(_trendChart, null);
}

/**
 * Repinta colores de grid/ticks para sincronizar con dark/light toggle.
 * @param {boolean} isDark
 */
export function updateTrendChartTheme(isDark) {
  if (!_trendChart) return;
  const gridColor  = isDark ? '#333333' : '#cccccc';
  const tickColor  = isDark ? '#cccccc' : '#333333';
  const tooltipBg  = isDark ? '#212529' : '#f8f8f8';
  _trendChart.options.scales.x.grid.color   = gridColor;
  _trendChart.options.scales.x.ticks.color  = tickColor;
  _trendChart.options.scales.x.title.color  = tickColor;
  _trendChart.options.scales.y.grid.color   = gridColor;
  _trendChart.options.scales.y.ticks.color  = tickColor;
  _trendChart.options.scales.y.title.color  = tickColor;
  _trendChart.options.plugins.legend.labels.color     = tickColor;
  _trendChart.options.plugins.tooltip.backgroundColor = tooltipBg;
  _trendChart.options.plugins.tooltip.borderColor     = '#4bff6b';
  _trendChart.update();
}
