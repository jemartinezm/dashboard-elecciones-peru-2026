// M5 — Trend Chart (evolución del conteo)
// Líneas escalonadas estilo pixel-art. Solo datos nacionales (tracking.cuts).

/* global Chart */

let _trendChart = null;  // referencia module-scoped

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
          backgroundColor: '#212529',
          borderColor:     '#4bff6b',
          borderWidth:     2,
          titleFont:  { family: "'Press Start 2P', monospace", size: 8 },
          bodyFont:   { family: "'Press Start 2P', monospace", size: 8 },
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
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
