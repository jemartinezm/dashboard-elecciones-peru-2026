// M3 — Candidate Table
// Tabla de resultados con top 5 candidatos + fila "Otros".

import { OTROS } from './config.js';

/** Formato con apóstrofe como separador de millones (2'189,877) */
function fmtNum(n) {
  if (n === null || n === undefined) return '0';
  const s = Math.round(n).toString();
  if (s.length <= 6) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Separar millones con apóstrofe, miles con coma
  const millions  = s.slice(0, s.length - 6);
  const rest      = s.slice(s.length - 6);
  const thousands = rest.slice(0, 3);
  const units     = rest.slice(3);
  return `${millions}'${thousands},${units}`;
}

/** Formatea porcentaje con 3 decimales */
function fmtPct(p) {
  return (p ?? 0).toFixed(3) + '%';
}

/**
 * Renderiza la tabla de candidatos.
 *
 * @param {Array<{key, name, party, pct, votes, color}>} candidateArray
 *   Resultado de getCandidateNational() o getRegionData().candidates
 * @param {HTMLElement|string} container  Selector o elemento DOM
 */
export function renderTable(candidateArray, container) {
  const el = typeof container === 'string'
    ? document.querySelector(container)
    : container;
  if (!el) return;

  const filtered = candidateArray.filter(c => c.key !== OTROS.key);
  const maxPct   = filtered.length ? Math.max(...filtered.map(c => c.pct)) : 0;

  const rows = candidateArray.map((c, i) => {
    const isOtros  = c.key === OTROS.key;
    const rank     = isOtros ? '—' : `<span>${i + 1}</span>`;
    const isLeader = !isOtros && i === 0;
    const starIcon = isLeader ? '<i class="nes-icon star is-small"></i> ' : '';
    const badge    = `<span class="candidate-badge" style="background:${c.color}"></span>`;
    const rowClass = isOtros ? 'row-otros' : (i % 2 === 0 ? 'row-candidate row-even' : 'row-candidate row-odd');
    const clickAttr = isOtros ? '' : `data-key="${c.key}"`;
    const barWidth  = isOtros ? 0 : Math.round((c.pct / maxPct) * 100);
    const miniBar   = isOtros ? '' : `
    <div class="mini-bar-wrap">
      <div class="mini-bar" style="width:${barWidth}%;background:${c.color}"></div>
    </div>`;

    return `
    <tr class="${rowClass}" ${clickAttr} ${isOtros ? '' : 'style="cursor:pointer"'}>
      <td>${rank}</td>
      <td>${badge} ${starIcon}${c.name}</td>
      <td class="col-partido">${c.party}</td>
      <td class="col-votos">${fmtNum(c.votes)}</td>
      <td class="col-pct">${fmtPct(c.pct)}${miniBar}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="table-scroll-wrapper">
      <table class="nes-table is-bordered is-dark">
        <thead>
          <tr>
            <th>#</th>
            <th>Candidato</th>
            <th class="col-partido">Partido</th>
            <th class="col-votos">Votos</th>
            <th class="col-pct">%</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <dialog id="candidate-dialog" class="nes-dialog is-dark is-rounded">
      <form method="dialog">
        <p class="title" id="dialog-title"></p>
        <p id="dialog-body"></p>
        <menu class="dialog-menu">
          <button class="nes-btn is-primary" value="close">Cerrar</button>
        </menu>
      </form>
    </dialog>
  `;

  // Click en filas de candidatos → dialog
  el.querySelectorAll('tr[data-key]').forEach(row => {
    row.addEventListener('click', () => {
      const key = row.dataset.key;
      const c   = candidateArray.find(x => x.key === key);
      if (!c) return;
      const dlg = el.querySelector('#candidate-dialog');
      el.querySelector('#dialog-title').textContent = c.name;
      el.querySelector('#dialog-body').innerHTML =
        `<strong>Partido:</strong> ${c.party}<br>` +
        `<strong>Votos:</strong> ${fmtNum(c.votes)}<br>` +
        `<strong>%:</strong> ${fmtPct(c.pct)}`;
      dlg.showModal();
    });
  });
}
