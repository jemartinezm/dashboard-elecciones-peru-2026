// M0 — Config y constantes
// Sin dependencias externas.

// bgTint = color al 15% de opacidad, usado como fondo sutil en cards/rows
export const CANDIDATES = {
  fujimori: { name: 'Keiko Fujimori',   party: 'Fuerza Popular',     color: '#FF6B35', bgTint: 'rgba(255,107,53,0.15)',  initials: 'KF' },
  rla:      { name: 'R. López Aliaga',  party: 'Renovación Popular', color: '#1E90FF', bgTint: 'rgba(30,144,255,0.15)',  initials: 'RL' },
  nieto:    { name: 'Jorge Nieto',      party: 'Buen Gobierno',      color: '#32CD32', bgTint: 'rgba(50,205,50,0.15)',   initials: 'JN' },
  sanchez:  { name: 'Roberto Sánchez',  party: 'Juntos por el Perú', color: '#DC143C', bgTint: 'rgba(220,20,60,0.15)',   initials: 'RS' },
  belmont:  { name: 'Ricardo Belmont',  party: 'Cívico Obras',       color: '#FFD700', bgTint: 'rgba(255,215,0,0.15)',   initials: 'RB' },
};

export const OTROS = {
  key:     'otros',
  name:    'Otros candidatos',
  party:   '—',
  color:   '#808080',
  bgTint:  'rgba(128,128,128,0.15)',
  initials:'??',
};

export const TOP_N = 5;

export const CANDIDATE_KEYS = Object.keys(CANDIDATES);

export const DATA_PATHS = {
  tracking: './data/tracking.json',
  live:     './data/onpe_live.json',
};
