# Dashboard Elecciones Perú 2026 — NES 8-bit

Visualización interactiva de resultados de la primera vuelta presidencial Perú 2026.
Estilo retro NES 8-bit con mapa por departamentos, tendencia temporal, probabilidades
de segunda vuelta (Monte Carlo) y conexión en vivo a la API de ONPE.

![dashboard](https://img.shields.io/badge/NES.css-2.3.0-blueviolet) ![chart.js](https://img.shields.io/badge/Chart.js-4-ff6384) ![d3](https://img.shields.io/badge/D3.js-7-f9a03c)

---

## Desarrollo local

> **Importante:** No abrir `index.html` con `file://` — los módulos ES fallarán por CORS.

El proyecto trae un servidor Python de desarrollo que además actúa como proxy de ONPE:

```bash
# Desde la raíz del proyecto:
python dev_server.py 8000

# Abrir en el navegador:
http://localhost:8000
```

El script `dev_server.py` hace dos cosas:

1. **Sirve los estáticos** con `Cache-Control: no-store` para que los módulos ES se recarguen en cada edición.
2. **Proxy de la API** — enruta `/api/snapshot` y `/api/tracking` al upstream configurado en `UPSTREAM_BASE`. El frontend solo habla con `localhost` → cero problemas de CORS.

### Cambiar el upstream

Edita una sola línea en [`dev_server.py`](dev_server.py):

```python
UPSTREAM_BASE = "https://onpe-proxy.renzonunez-af.workers.dev"
# ↑ cámbialo a tu propio Worker / scraper / backend
```

---

## Arquitectura

```
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
│   Browser    │──▶│  dev_server.py  │──▶│  UPSTREAM_BASE   │
│  (hero, KPIs,│    │  localhost:8000 │    │  (configurable)  │
│   mapa, etc.)│    │  cache TTL 15s  │    │                  │
└──────────────┘    └─────────────────┘    └──────────────────┘
```

| Módulo | Archivo | Rol |
|---|---|---|
| M0 | [`js/config.js`](js/config.js) | Constantes: candidatos, colores, paths |
| M1 | [`js/dataLoader.js`](js/dataLoader.js) | Carga live (API) o cache (JSON) con fallback |
| M2 | [`js/summaryBar.js`](js/summaryBar.js) | Progress bar de actas procesadas |
| M3 | [`js/candidateTable.js`](js/candidateTable.js) | Tabla de resultados |
| M4 | [`js/barChart.js`](js/barChart.js) | Barras horizontales Chart.js |
| M5 | [`js/trendChart.js`](js/trendChart.js) | Línea temporal + panel externo mobile |
| M6 | [`js/regionFilter.js`](js/regionFilter.js) | Filtro por departamento |
| M7 | [`js/projectionPanel.js`](js/projectionPanel.js) | Proyección vs encuestadoras |
| M8 | [`js/app.js`](js/app.js) | Orquestador + stagger reveal + refresh API |
| M9 | [`js/peruMap.js`](js/peruMap.js) | Choropleth SVG D3 |
| M10 | [`js/hero.js`](js/hero.js) | Gran % nacional + live dot (🟢/🟡/🔴) |
| M11 | [`js/kpiCards.js`](js/kpiCards.js) | Fila de 5 tarjetas con delta + hot-mover glow |
| M12 | [`js/probBars.js`](js/probBars.js) | Probabilidad 2da vuelta (Monte Carlo 4000 sims) |
| M13 | [`js/onpeApi.js`](js/onpeApi.js) | Cliente API: fetch + transformación de schema |

---

## Fuentes de datos

La dashboard opera en 2 modos según disponibilidad:

| Modo | Origen | Indicador visual |
|---|---|---|
| **EN VIVO** | `/api/snapshot` + `/api/tracking` (proxy local → ONPE) | 🟢 dot verde pulsante |
| **CACHÉ** | `data/onpe_live.json` + `data/tracking.json` | 🟡 dot ámbar estático |
| **OFFLINE** | Error al leer cache | 🔴 dot rojo |

La carga inicial siempre usa **caché** (rápida). El botón **↺ Actualizar** dispara la llamada al API; si falla, cae silenciosamente al caché.

Archivos de caché (actualizables manualmente):

- [`data/onpe_live.json`](data/onpe_live.json) — snapshot regional
- [`data/tracking.json`](data/tracking.json) — serie temporal + proyección + referencias encuestadoras
- [`data/peru_geo.json`](data/peru_geo.json) — GeoJSON de los 25 departamentos

---

## Deploy a GitHub Pages

GitHub Pages es **estático** — `dev_server.py` no corre en producción. El refresh fallará silenciosamente y la página mostrará los datos del caché embebido. Para datos "en vivo" en producción se necesita un backend propio (Cloudflare Worker, Vercel Function, etc.).

```bash
# Con gh CLI:
gh auth login
gh repo create dashboard-elecciones-peru-2026 --public --source=. --remote=origin --push
gh api -X POST /repos/:owner/:repo/pages -f source.branch=main -f source.path=/
# URL: https://{usuario}.github.io/dashboard-elecciones-peru-2026/
```

---

## Stack

- [NES.css 2.3.0](https://nostalgic-css.github.io/NES.css/) — componentes pixel-art
- [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) — tipografía 8-bit
- [Chart.js 4](https://www.chartjs.org/) — barras + líneas
- [D3.js 7](https://d3js.org/) — mapa choropleth
- Vanilla JS + ES modules — sin build tools, sin framework

---

## Créditos

- Datos: [ONPE](https://www.onpe.gob.pe) (Oficina Nacional de Procesos Electorales, Perú)
- Referencias encuestadoras: Datum Internacional, Ipsos Perú
- Inspiración visual: varios proyectos públicos de seguimiento electoral
