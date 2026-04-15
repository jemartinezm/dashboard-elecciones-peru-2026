// M7 — Projection Panel
// Comparación proyección ONPE vs encuestadoras. Sin valores hardcoded.

import { getProjectionComparison } from './dataLoader.js';

const DIFF_THRESHOLD = 1.0;  // pp — resaltar si |datum - ipsos| supera este umbral

/** Formatea pct o "—" si null */
function fmtPct(v) {
  return v !== null && v !== undefined ? v.toFixed(2) + '%' : '—';
}

/**
 * Renderiza el panel de proyección.
 *
 * @param {object} tracking  resultado de loadAll().tracking
 */
export function renderProjection(tracking) {
  const container = document.querySelector('#projection-panel');
  if (!container) return;

  const data = getProjectionComparison(tracking);
  _renderRows(container, data);
}

function _renderRows(container, data) {
  const rows = data.map(c => {
    const diff      = c.diffDatumIpsos;
    const highlight = diff !== null && diff > DIFF_THRESHOLD;
    const badge     = `<span class="candidate-badge" style="background:${c.color}"></span>`;
    const hlStyle   = highlight ? ' style="background:rgba(255,200,0,0.15)"' : '';
    const diffCell  = diff !== null
      ? `<td class="${highlight ? 'nes-text is-warning' : ''}">${diff.toFixed(2)}pp</td>`
      : '<td>—</td>';

    return `
      <tr${hlStyle}>
        <td>${badge} ${c.name}</td>
        <td>${fmtPct(c.proyeccion)}</td>
        <td>${fmtPct(c.datum)}</td>
        <td>${fmtPct(c.ipsos)}</td>
        ${diffCell}
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="nes-container is-dark with-title">
      <p class="title">Proyección vs Encuestadoras</p>
      <div class="table-scroll-wrapper">
        <table class="nes-table is-bordered is-dark projection-table">
          <thead>
            <tr>
              <th>Candidato</th>
              <th>ONPE*</th>
              <th>Datum</th>
              <th>Ipsos</th>
              <th>Δ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="nes-balloon from-left projection-note-balloon">
        <p>*Proyección lineal ONPE. <span class="nes-text is-warning">Δ &gt; ${DIFF_THRESHOLD}pp</span> = encuestadoras divergen.</p>
      </div>
    </div>
  `;
}
