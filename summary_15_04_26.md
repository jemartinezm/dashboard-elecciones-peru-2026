# Dashboard Elecciones Perú 2026 — Resumen de Cambios
**Fecha:** 15 de abril de 2026

---

## 1. Mejoras visuales generales (Visual Overhaul)

### Bar Chart (`js/barChart.js`)
- Corregido color del tooltip: borde `#4bff6b` (verde NES) y fondo adaptativo dark/light.
- Eje X dinámico: `computeXMax()` recalcula el máximo en cada actualización (`Math.ceil(maxPct * 1.2)`, mínimo 22).
- `updateBarChart()` ahora actualiza el máximo del eje en lugar de destruir y recrear la gráfica.
- Eliminado `datalabels: undefined` residual.

### Summary Bar (`js/summaryBar.js`)
- Icono de trofeo NES (`nes-icon trophy`) junto al líder.
- Barra de progreso más prominente (`summary-progress`, altura 28 px).
- Nueva línea "Votos válidos" en verde (`summary-vv`) calculada desde la suma de `vv` de todas las regiones.

### Candidate Table (`js/candidateTable.js`)
- Formato de números con apóstrofe de millones: `2'189,877`.
- Barras mini bajo cada porcentaje (ancho proporcional al líder).
- Filas zebra (`row-even` / `row-odd`) y hover highlight.
- Ícono de estrella NES en la fila del candidato líder.
- Dialog modal al hacer clic en una fila con detalles del candidato.

### Projection Panel (`js/projectionPanel.js`)
- Nueva columna **Δ** (diferencia resultado real vs. encuesta, en pp).
- Filas con mayor diferencia destacadas en amarillo suave.
- Nota explicativa con `nes-balloon from-left`.

### Region Filter (`js/regionFilter.js`)
- Envuelto en `nes-container is-dark` con layout `filter-row` flex.
- Badge de cobertura (`#region-coverage-badge`) con color según umbral: verde ≥70 %, amarillo ≥50 %, rojo <50 %.
- Advertencia `nes-balloon` cuando la cobertura regional es baja (<50 %).
- Parámetro `onRegionHighlight` para sincronización bidireccional con el mapa.

### CSS / Layout (`css/theme.css`)
- Grid `3fr 2fr` en desktop (≥768 px), máximo 1200 px.
- `font-size: 12px` base; fuentes escaladas con `clamp` y unidades `rem`.
- `.summary-progress`, `.summary-vv`, `.summary-stats`, `.mini-bar-wrap`, `.mini-bar` añadidos.
- `.filter-row`, `.region-badge`, `.warning-balloon` añadidos.
- `.projection-note-balloon` añadido como alias de `.projection-note`.
- Animación `fadeIn` en todas las secciones al cargar.
- Overrides `!important` para `nes-container.is-dark` en modo claro.
- Fila `"map"` añadida al grid en mobile y desktop.
- Estilos del mapa: `.map-svg-area`, `.map-tooltip` (sombra pixelada NES), `.map-legend`, `.legend-item`, `.legend-swatch`.

### App (`js/app.js`)
- `totalVV` calculado como suma de `vv` de todas las regiones.
- `await renderPeruMap(...)` integrado antes de `initRegionFilter`.
- Callback `onRegionHighlight` conectado al mapa.

---

## 2. Mapa Interactivo del Perú (M9)

### Nuevo archivo: `data/peru_geo.json`
- GeoJSON de los 25 departamentos del Perú.
- Propiedad `NOMBDEP` en mayúsculas sin tildes (ej. `ANCASH`, `SAN MARTIN`).
- Fuente: `juaneladio/peru-geojson` (GitHub).

### Nuevo módulo: `js/peruMap.js`
- Mapa coroplético D3.js v7 coloreado por candidato líder en cada departamento.
- Opacidad variable según porcentaje de actas procesadas (más actas → más opaco).
- Tooltip flotante con: nombre del departamento, candidato líder + %, actas procesadas %.
- Clic en departamento → actualiza dropdown de región + resalta con borde verde.
- Clic en fondo SVG → vuelve a vista nacional.
- Leyenda con los 5 candidatos (ordenados por departamentos ganados) + "Sin datos".
- Sincronización bidireccional con `initRegionFilter` sin bucle de eventos.
- `GEO_NAME_MAP` mapea los 25 `NOMBDEP` a los nombres exactos de `onpe_live.json`.
- "Extranjero" excluido del mapa sin generar errores.

### `index.html`
- CDN D3.js v7 añadido antes de Chart.js.
- `<section id="peru-map-container">` añadido entre filtro y bar chart.

---

## 3. Arquitectura de sincronización (bidireccional sin loop)

```
Clic en mapa → _onSelect(nm) → app: select.value = nm; dispatchEvent('change')
  → regionFilter.change handler → onRegionHighlight(nm) → highlightRegion(nm)
     (solo actualiza SVG strokes, NO llama _onSelect) → FIN

Cambio en dropdown → regionFilter.change handler → onRegionHighlight(nm)
  → highlightRegion(nm) (solo strokes) → FIN
```

---

## Archivos modificados / creados

| Archivo | Tipo |
|---------|------|
| `data/peru_geo.json` | Nuevo |
| `js/peruMap.js` | Nuevo |
| `js/app.js` | Modificado |
| `js/barChart.js` | Modificado |
| `js/candidateTable.js` | Modificado |
| `js/projectionPanel.js` | Modificado |
| `js/regionFilter.js` | Modificado |
| `js/summaryBar.js` | Modificado |
| `css/theme.css` | Modificado |
| `index.html` | Modificado |
