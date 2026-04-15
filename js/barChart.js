// M4 — Bar Chart (resultados principales)
// Horizontal bars estilo 8-bit. Colores por key del candidato, no por posición.

/* global Chart */

let _barChart = null;  // referencia module-scoped para re-render seguro

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
function chartOptions() {
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
        borderColor:     '#ffffff',
        borderWidth:     2,
        titleFont:  { family: "'Press Start 2P', monospace", size: 8 },
        bodyFont:   { family: "'Press Start 2P', monospace", size: 8 },
        callbacks: {
          label: ctx => ` ${ctx.parsed.x.toFixed(3)}%`,
        },
      },
      datalabels: undefined,  // no plugin externo — usamos afterDraw custom
    },
    scales: {
      x: {
        beginAtZero: true,
        max:         22,
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
 * @param {string} canvasId
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
    options: chartOptions(),
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
  _barChart.data.labels            = d.labels;
  _barChart.data.datasets          = d.datasets;
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
  _barChart.options.scales.x.grid.color  = gridColor;
  _barChart.options.scales.x.ticks.color = tickColor;
  _barChart.options.scales.y.ticks.color = tickColor;
  _barChart.update();
}
