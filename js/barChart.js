// M4 — Bar Chart (resultados principales)
// Horizontal bars estilo 8-bit. Colores por key del candidato, no por posición.
// Single-canvas module: _barChart tracks exactly one chart instance at a time.

/* global Chart */

let _barChart = null;  // referencia module-scoped para re-render seguro

/** Calcula el máximo del eje X: al menos 22, o techo del mayor pct * 1.2 */
function computeXMax(candidateArray) {
  const maxPct = Math.max(...candidateArray.map(c => c.pct));
  return Math.max(22, Math.ceil(maxPct * 1.2));
}

/** Convierte array de candidatos a datasets para Chart.js */
function toChartData(candidateArray) {
  return {
    labels:   candidateArray.map(c => c.name),
    datasets: [{
      data:            candidateArray.map(c => parseFloat(c.pct.toFixed(3))),
      backgroundColor: candidateArray.map(c => c.color),
      borderColor:     candidateArray.map(() => '#000000'),
      borderWidth:     3,
      borderRadius:    0,  // bordes cuadrados / pixel-art
      barThickness:    22,
    }],
  };
}

/** Opciones Chart.js compartidas para estilo 8-bit */
function chartOptions(xMax) {
  return {
    indexAxis:   'y',
    responsive:  true,
    maintainAspectRatio: false,
    layout: {
      padding: { left: 8, right: 40, top: 4, bottom: 4 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#212529',
        borderColor:     '#4bff6b',
        borderWidth:     2,
        titleFont:  { family: "'Press Start 2P', monospace", size: 8 },
        bodyFont:   { family: "'Press Start 2P', monospace", size: 8 },
        callbacks: {
          label: ctx => ` ${ctx.parsed.x.toFixed(3)}%`,
        },
      },
      // datalabels plugin no cargado — se usan afterDraw hooks custom si se necesita
    },
    scales: {
      x: {
        beginAtZero: true,
        max:         xMax,
        ticks: {
          font:     { family: "'Press Start 2P', monospace", size: 7 },
          color:    '#cccccc',
          callback: v => v + '%',
          maxTicksLimit: 6,
        },
        grid: { color: '#333333', borderDash: [4, 4] },
      },
      y: {
        ticks: {
          font:  { family: "'Press Start 2P', monospace", size: 7 },
          color: '#cccccc',
        },
        grid: { display: false },
      },
    },
  };
}

/**
 * Renderiza el bar chart por primera vez.
 * Si ya existe una instancia, la destruye primero.
 *
 * @param {Array} candidateArray  getCandidateNational() o getRegionData().candidates
 * @param {string} canvasId       ID del canvas (módulo soporta un único canvas a la vez)
 */
export function renderBarChart(candidateArray, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_barChart) {
    _barChart.destroy();
    _barChart = null;
  }

  _barChart = new Chart(canvas, {
    type:    'bar',
    data:    toChartData(candidateArray),
    options: chartOptions(computeXMax(candidateArray)),
  });
}

/**
 * Actualiza el chart existente sin destruirlo.
 * Usar para actualizaciones de filtro regional.
 *
 * @param {Array} candidateArray
 */
export function updateBarChart(candidateArray) {
  if (!_barChart) return;
  const d = toChartData(candidateArray);
  _barChart.data.labels                  = d.labels;
  _barChart.data.datasets                = d.datasets;
  _barChart.options.scales.x.max        = computeXMax(candidateArray);
  _barChart.update();
}

/**
 * Repinta colores de grid/ticks para sincronizar con dark/light toggle.
 * @param {boolean} isDark
 */
export function updateBarChartTheme(isDark) {
  if (!_barChart) return;
  const gridColor = isDark ? '#333333' : '#cccccc';
  const tickColor = isDark ? '#cccccc' : '#333333';
  const tooltipBg = isDark ? '#212529' : '#f8f8f8';
  _barChart.options.scales.x.grid.color              = gridColor;
  _barChart.options.scales.x.ticks.color             = tickColor;
  _barChart.options.scales.y.ticks.color             = tickColor;
  _barChart.options.plugins.tooltip.backgroundColor  = tooltipBg;
  _barChart.options.plugins.tooltip.borderColor      = '#4bff6b';
  _barChart.update();
}
