// M12 — Probability Bars (Segunda Vuelta)
// Barras de probabilidad de pasar a segunda vuelta para top-5 candidatos.
// Inspirado en Elecciones_2026-main (.prob-item con track + fill coloreado).

import { CANDIDATES } from './config.js';

const SIMULATIONS = 4000;

/** Muestra estándar normal usando Box-Muller. */
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Estima probabilidad de pasar a segunda vuelta (top 2) por Monte Carlo.
 * Más actas procesadas → menor incertidumbre (σ menor).
 *
 * @param {Array<{key, pct}>} candidates  Top-5 ordenados desc.
 * @param {number} pctActas               % actas procesadas (0–100).
 * @returns {Object<string, number>}      key → probabilidad (0–100).
 */
function simulateTopTwo(candidates, pctActas) {
  // σ base ≈ 1.5 puntos al 100%, escalado con sqrt((100 - actas) / 100).
  // A 73% actas → σ ≈ 1.5 * sqrt(27/100) ≈ 0.78
  const remaining = Math.max(0, 100 - Math.min(100, pctActas));
  const sigma = 1.5 * Math.sqrt(remaining / 100) + 0.3; // piso de 0.3 para nunca ser 100%

  const counts = {};
  candidates.forEach(c => { counts[c.key] = 0; });

  for (let i = 0; i < SIMULATIONS; i++) {
    const noisy = candidates.map(c => ({ key: c.key, score: c.pct + gauss() * sigma }));
    noisy.sort((a, b) => b.score - a.score);
    counts[noisy[0].key]++;
    counts[noisy[1].key]++;
  }

  const probs = {};
  candidates.forEach(c => { probs[c.key] = (counts[c.key] / SIMULATIONS) * 100; });
  return probs;
}

/**
 * Renderiza barras de probabilidad (top-5, sin "otros").
 * @param {Array} candidates      Con {key, name, pct, color}
 * @param {number} pctActas       Nacional (o regional).
 */
export function renderProbBars(candidates, pctActas) {
  const el = document.querySelector('#prob-bars');
  if (!el) return;

  const top5 = candidates.filter(c => c.key !== 'otros').slice(0, 5);
  const probs = simulateTopTwo(top5, pctActas);

  // Ordenar por probabilidad desc
  const sorted = [...top5].sort((a, b) => (probs[b.key] ?? 0) - (probs[a.key] ?? 0));

  el.innerHTML = `
    <div class="nes-container is-dark with-title prob-wrap">
      <p class="title">Pasar a 2da vuelta</p>
      <p class="prob-note">Probabilidad estimada (Monte Carlo · ${SIMULATIONS.toLocaleString('es-PE')} simulaciones)</p>
      <ul class="prob-list" role="list">
        ${sorted.map(c => {
          const p      = probs[c.key] ?? 0;
          const width  = Math.max(2, Math.min(100, p)).toFixed(1);
          const cfg    = CANDIDATES[c.key] ?? {};
          return `
            <li class="prob-item" role="listitem">
              <div class="prob-header">
                <span class="prob-initials" style="color:${c.color}; border-color:${c.color}">${cfg.initials ?? ''}</span>
                <span class="prob-name">${c.name}</span>
                <span class="prob-pct">${p.toFixed(1)}%</span>
              </div>
              <div class="prob-track" aria-hidden="true">
                <div class="prob-fill" style="width:${width}%; background:${c.color};"></div>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

/** Update on region change (recibe pctActas del summary). */
export function updateProbBars(candidates, pctActas) {
  renderProbBars(candidates, pctActas);
}
