// M0 — Config y constantes
// Sin dependencias externas.

export const CANDIDATES = {
  fujimori: { name: 'Keiko Fujimori',   party: 'Fuerza Popular',     color: '#FF6B35' },
  rla:      { name: 'R. López Aliaga',  party: 'Renovación Popular', color: '#1E90FF' },
  nieto:    { name: 'Jorge Nieto',      party: 'Buen Gobierno',      color: '#32CD32' },
  sanchez:  { name: 'Roberto Sánchez',  party: 'Juntos por el Perú', color: '#DC143C' },
  belmont:  { name: 'Ricardo Belmont',  party: 'Cívico Obras',       color: '#FFD700' },
};

export const OTROS = {
  key:   'otros',
  name:  'Otros candidatos',
  party: '—',
  color: '#808080',
};

export const TOP_N = 5;

export const CANDIDATE_KEYS = Object.keys(CANDIDATES);

export const DATA_PATHS = {
  tracking: './data/tracking.json',
  live:     './data/onpe_live.json',
};
