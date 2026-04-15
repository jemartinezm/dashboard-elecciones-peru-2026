// M2 — Summary Bar (Header)
// Renderiza el encabezado con avance nacional de actas.

/**
 * Formatea fecha ISO a "DD mmm YYYY, HH:MM"
 * Ej: "2026-04-14T05:47:19" → "14 abr 2026, 05:47"
 */
function formatDate(isoStr) {
  if (!isoStr) return '—';
  // Parse manually to preserve Peru local time regardless of viewer's timezone.
  // JSON format is always "YYYY-MM-DDTHH:MM:SS" (no offset) — treat as-is.
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [datePart, timePart] = isoStr.split('T');
  if (!datePart || !timePart) return isoStr;
  const [year, month, day] = datePart.split('-');
  const [hh, mm]           = timePart.split(':');
  const mon = months[parseInt(month, 10) - 1];
  return `${day} ${mon} ${year}, ${hh}:${mm}`;
}

/** Formatea número con separador de miles: 68062 → "68,062" */
function fmtNum(n) {
  return (n ?? 0).toLocaleString('es-PE');
}

/**
 * Renderiza el header de avance nacional.
 *
 * @param {{pct: number, totalActas: number, actasContabilizadas: number, lastUpdate: string}} summary
 *   Resultado de getNationalSummary(live)
 */
export function renderSummary(summary) {
  const el = document.querySelector('#summary-bar');
  if (!el) return;

  const pct = (summary.pct ?? 0).toFixed(2);

  el.innerHTML = `
    <div class="nes-container is-dark with-title summary-container">
      <p class="title">Avance de conteo</p>
      <div class="summary-progress-row">
        <progress class="nes-progress is-success summary-progress"
          value="${pct}" max="100"
          aria-label="Porcentaje de actas procesadas"></progress>
        <span class="summary-pct">${pct}%</span>
      </div>
      <div class="summary-stats">
        <span>${fmtNum(summary.actasContabilizadas)} / ${fmtNum(summary.totalActas)} actas</span>
        <span class="summary-vv">Votos válidos: ${fmtNum(summary.totalVV ?? 12945863)}</span>
      </div>
      <p class="summary-update">
        Última actualización: ${formatDate(summary.lastUpdate)}
      </p>
    </div>
  `;
}
