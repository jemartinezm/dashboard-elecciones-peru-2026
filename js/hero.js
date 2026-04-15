// M10 — Hero Section
// Gran porcentaje nacional animado con count-up + live dot.
// Inspirado en Elecciones_2026-main (.hero-pct gradient + count-up).

/**
 * Anima un número desde 0 hasta target en ~800ms.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {number} duration
 */
function countUp(el, target, duration = 900) {
  if (!el || isNaN(target)) return;
  const start = performance.now();
  const from = 0;

  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    // Ease-out cubic para un aterrizaje suave en el número final
    const eased = 1 - Math.pow(1 - t, 3);
    const val = from + (target - from) * eased;
    el.textContent = `${val.toFixed(2)}%`;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/**
 * Renderiza el hero con el % nacional.
 *
 * @param {{pct: number, lastUpdate?: string}} summary
 * @param {{source?: 'api'|'cache'|'error', freshness?: string, warning?: string}} [meta]
 *   Origen de los datos. Controla el color del live-dot y el sub-texto.
 */
export function renderHero(summary, meta = null) {
  const el = document.querySelector('#hero');
  if (!el) return;

  const pct = Number(summary?.pct ?? 0);

  // Estado según la fuente de datos
  const source = meta?.source ?? 'cache';
  let dotClass, subText;
  if (source === 'api') {
    dotClass = 'is-live';
    subText = `EN VIVO · ONPE${meta?.freshness ? ' · ' + meta.freshness : ''}`;
  } else if (source === 'error') {
    dotClass = 'is-error';
    subText = 'OFFLINE · ' + (meta?.warning ?? 'sin datos');
  } else {
    dotClass = 'is-cache';
    subText = 'DATA CACHÉ · Elecciones Perú 2026';
  }

  el.innerHTML = `
    <p class="hero-label">Avance Nacional ONPE</p>
    <h2 class="hero-pct" id="hero-pct">0.00%</h2>
    <p class="hero-sub">
      <span class="live-dot ${dotClass}" aria-hidden="true"></span>
      <span>${subText}</span>
    </p>
  `;

  const pctEl = el.querySelector('#hero-pct');
  // Arrancar la animación en el próximo frame (el elemento ya está en DOM)
  requestAnimationFrame(() => countUp(pctEl, pct));
}
