// M11 — KPI Cards Row
// Fila de 5 tarjetas con candidatos (top 5) mostrando %, delta vs cut anterior y ghost value.
// Inspirado en Elecciones_2026-main (.kpi card con count-up + ghost + hot-mover glow).

import { CANDIDATES } from './config.js';

/**
 * Devuelve el cut anterior al último desde tracking.cuts.
 * Si hay menos de 2 cuts o tracking no está disponible, retorna null.
 * @param {{cuts?: Array<Object>}} tracking
 */
function getPrevCut(tracking) {
  const cuts = tracking?.cuts ?? [];
  if (cuts.length < 2) return null;
  return cuts[cuts.length - 2];
}

/** Anima un número hasta target. */
function countUp(el, target, duration = 800) {
  if (!el || isNaN(target)) return;
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (target * eased).toFixed(2) + '%';
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/**
 * Dibuja la fila de KPIs con los top-5 candidatos.
 *
 * @param {Array<{key, name, pct, color, votes}>} candidates  (ordenados desc por pct)
 * @param {object|null} tracking  Opcional. Si se pasa, se muestra delta + ghost.
 */
export function renderKpiCards(candidates, tracking = null) {
  const el = document.querySelector('#kpi-cards');
  if (!el) return;

  // Top 5 reales (sin "otros")
  const top5 = candidates.filter(c => c.key !== 'otros').slice(0, 5);
  const prevCut = getPrevCut(tracking);

  // Calcular deltas y detectar hot-mover (mayor delta absoluto)
  const deltas = {};
  let hotKey = null;
  let hotAbs = 0;
  if (prevCut) {
    for (const c of top5) {
      const prev = Number(prevCut[c.key] ?? 0);
      const d    = c.pct - prev;
      deltas[c.key] = { prev, d };
      if (Math.abs(d) > hotAbs) {
        hotAbs = Math.abs(d);
        hotKey = c.key;
      }
    }
  }

  el.innerHTML = `
    <div class="kpi-row" role="list" aria-label="Top candidatos">
      ${top5.map(c => {
        const cfg      = CANDIDATES[c.key] ?? {};
        const initials = cfg.initials ?? '??';
        const bgTint   = cfg.bgTint   ?? 'transparent';
        const info     = deltas[c.key];
        const isHot    = hotKey === c.key && info && Math.abs(info.d) >= 0.05;

        let deltaHtml = '';
        let prevHtml  = '';
        if (info) {
          const cls = info.d > 0.05 ? 'up' : info.d < -0.05 ? 'down' : 'flat';
          const arrow = cls === 'up' ? '▲' : cls === 'down' ? '▼' : '–';
          const sign = info.d > 0 ? '+' : '';
          deltaHtml = `<span class="kpi-delta ${cls}">${arrow} ${sign}${info.d.toFixed(2)}</span>`;
          prevHtml  = `<span class="kpi-prev">prev ${info.prev.toFixed(2)}%</span>`;
        }

        const glowStyle = isHot
          ? `--glow: ${c.color}dd;`
          : '';

        return `
          <article class="kpi-card ${isHot ? 'is-hot' : ''}"
                   role="listitem"
                   style="border-top-color: ${c.color}; background: linear-gradient(180deg, ${bgTint} 0%, var(--bg-2) 80%); ${glowStyle}"
                   data-key="${c.key}">
            <div class="kpi-initials" style="color: ${c.color};">${initials}</div>
            <p class="kpi-name">${c.name}</p>
            <p class="kpi-pct" data-target="${c.pct}">0.00%</p>
            ${deltaHtml}
            ${prevHtml}
          </article>
        `;
      }).join('')}
    </div>
  `;

  // Animar count-up en cada .kpi-pct (secuencial con pequeño stagger)
  el.querySelectorAll('.kpi-pct').forEach((pctEl, i) => {
    const target = Number(pctEl.dataset.target);
    setTimeout(() => countUp(pctEl, target, 700), i * 120);
  });
}

/**
 * Actualiza los KPIs al cambiar región.
 * (La región no tiene histórico → sin delta/ghost.)
 * @param {Array} candidates
 */
export function updateKpiCards(candidates) {
  renderKpiCards(candidates, null);
}
