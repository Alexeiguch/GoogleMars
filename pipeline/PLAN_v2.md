# Plan v2: más referencias y búsqueda de grueso a fino

Escrito el 14/11/2026 tras leer el código y una fase de investigación y medición
(5 agentes; scripts y salidas en el scratchpad de la sesión, nada en el repositorio).

## 1. Punto de partida (v1)

- 11 referencias (6 Luna, 5 Marte) y 130.535 ventanas terrestres de 30 km a 400 m.
- Validación v1 (`rank --no-climate`, percentil global): Luna 78,8–100; Marte 63,6–99,8.
  Lanzarote no aparece (no hay ventana de tierra a <50 km). Copia en `pipeline/data/backup_v1/`.
- Problemas de precisión encontrados en el código:
  - `relief_images.py` dibuja la Luna y Marte a 100 m/píxel, más fino que el dato (LOLA 118 m,
    HRSC 200 m). Se corrige: píxel por cuerpo (ver tabla de escalas).
  - `terrain_features` usa sigma = 2,5 px fijo: "rugosidad a ~1 km" solo es 1 km a 400 m.
    Se mantiene la fórmula (así la medida es siempre "a 2,5 píxeles" y la Tierra y el otro cuerpo
    se miden igual en cada comparación), pero la etiqueta dirá la escala real de cada nivel.
  - `patches.py` remuestrea GLO-30 (30 m) a 20 m para el visor 3D. No se toca el visor; la
    comparación nueva a 2 km se hace a 30 m.
  - En Marte el blend HRSC+MOLA solo tiene MOLA (463 m, con huecos entre trazas) en parte del
    planeta. Cada referencia de Marte lleva una medida de cobertura HRSC y se marca.

## 2. Datos verificados

| Dato | URL | Resolución real | Uso |
|---|---|---|---|
| Luna, PGDA LDEM_80S_40MPP_ADJ (Barker et al. 2023, PSJ 4:183) | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_40MPP_ADJ.TIF (716.299.920 B, HTTP 200, COG 512², estereográfica polar sur) | píxel 40 m; mediana de resolución efectiva (capa EFFRES del 20 m): 16–22 m a 87–90°S, 30–36 m a 83–86°S, 43–50 m a 80–82°S | todos los niveles de la Luna (80–90°S) |
| Luna, EFFRES del anterior | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_40MPP_ADJ_EFFRES.TIF (1.000.954.193 B, HTTP 200) | mapa de resolución efectiva por píxel | descartar ventanas cuya resolución real sea peor que el píxel común |
| Luna, LOLA global 118 m (v1) | planetarymaps.usgs.gov/.../Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif | 118 m, huecos de 1–4 km entre trazas interpolados | solo para reproducir la validación v1 |
| Marte, HRSC+MOLA blend v2 | planetarymaps.usgs.gov/.../Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif (11,4 GB, sin comprimir, 1 fila por strip) | 200 m donde hay HRSC; 463 m (o peor) donde solo hay MOLA | Marte L0 y L1, leído por rangos de bytes por fila (~13 s y ~0,1 MB por ventana) |
| Marte, MOLA 463 m | planetarymaps.usgs.gov/.../Mars_MGS_MOLA_DEM_mosaic_global_463m.tif | 463 m | prueba de cobertura HRSC |
| Marte, 116 parches HiRISE | `src/data/catalog.json` + `public/terrain/<id>.f32` (100×100 a 20 m) | ~1–2 m (DTM HiRISE) | Marte L2, remuestreados a 30 m |
| Tierra, Copernicus GLO-90 | Planetary Computer `cop-dem-glo-90` (tile 1°, un solo bloque de ~3,2 MB) | 90 m | Tierra L0 (ya hecho) y L1 |
| Tierra, Copernicus GLO-30 | `cop-dem-glo-30` (bloques 1024², ~3 MB por 5 km) | 30 m | Tierra L2 |
| Tierra, ESA WorldCover 2021 | `esa-worldcover` v2.0.0 (overviews; ~0,2 MB por bloque de 40 km a 120 m) | 10 m | superficie en L1 y L2 |

Productos LOLA descartados: los de 5 m (PGDA 87S, sitios PGDA, PDS LDEM_875S_5M) tienen un
89–96 % de píxeles interpolados (resolución real ~15–22 m); el de 10 m (83S) tiene la misma
resolución efectiva que el de 20 m; los GDR polares del PDS son anteriores y sin ajuste de órbitas.
El de 20 m (2,7 GB) no aporta nada al píxel común de 60 m elegido; el de 40 m basta.

## 3. Escalas por cuerpo (cada comparación: misma ventana y mismo píxel en los dos cuerpos)

| Nivel | Luna ↔ Tierra | Marte ↔ Tierra | Dato más grueso de la comparación |
|---|---|---|---|
| L0 (ya escaneado) | 30 km a 400 m | 30 km a 400 m | Tierra 400 m (escaneo hecho, no se relanza); Marte solo-MOLA 463 m → se marca |
| L1 | 10 km a 120 m (83 px) | 10 km a 200 m (50 px) | Luna: LOLA ~30–50 m y GLO-90 90 m → 120 m; Marte: HRSC 200 m |
| L2 | 5 km a 60 m (83 px) | 2 km a 30 m (67 px) | Luna: LOLA 30–50 m (EFFRES p50 ≤ 60 m obligatorio) y GLO-30; Marte: GLO-30 30 m frente a HiRISE |

Imágenes de relieve: misma ventana que el nivel; píxel 120 m (Luna) y 200 m (Marte) en L0 y L1,
60 m (Luna) y 30 m (Marte) en L2.

En Marte, las referencias "solo MOLA" (R400 < 1,15 o eq1m > 0,25) se mantienen en L0 con aviso
y se excluyen de L1 (a 200 m serían más finas que el dato).

## 4. Referencias nuevas (todas con fuente en `analogs/reference_sites.py`)

Luna (80–90°S):
- 9 regiones de Artemis III de oct-2024 y 7 regiones retiradas de ago-2022. Centro y límites de los
  mosaicos LROC NAC ROI "low-Sun controlled" (data.lroc.im-ldi.com/lroc/view_rdr/NAC_ROI_*),
  cotejados con la tabla de latitudes de NASA GSFC (NTRS 20250007692). Nobile Rim 1 y Mons Mouton
  comparten mosaico; de Gerlache Rim 2 y Slater Plain tienen longitud incierta: se marcan.
  Nota: desde feb-2026 el primer alunizaje tripulado es Artemis IV; las 9 regiones siguen vigentes.
- Sitios con coordenadas publicadas: IM-2 (LROC), Connecting Ridge C1/C2 y borde S de Shackleton
  (NTRS 20170007365), centro de Shackleton (IAU).
- Malla regular de 84–90°S (proyección azimutal polar): 30 km de paso en L0 (~115 ventanas) y
  10 km en L1 (~1.000 ventanas). Las regiones de Artemis por encima de 84°S (Peak near Cabeus B,
  83,6°S; Mons Mouton Plateau, 82,9–85,8°S) se cubren con sus propias teselas.
- L1: teselas de 10 km dentro de los límites LROC de cada región + malla de 10 km.
- L2: teselas de 5 km dentro de las 9 regiones de 2024 (en Mons Mouton Plateau, solo los 20 km
  centrales), descartando las de EFFRES p50 > 60 m.

Marte (43 sitios, todos con coordenada leída en la fuente):
- 10 aterrizajes (ODE/PDS, GeoJSON de NASA/JPL, Golombek et al. 2020, Liu et al. 2022).
- 10 zonas de exploración humana del taller NASA/LPI de 2015 (resúmenes 10xx.pdf).
- 23 sitios por tipo de terreno: cañones, volcanes, barrancos, cráteres, llanuras con hielo,
  depósitos polares, yardangs, dunas, caos, filosilicatos, carbonatos (páginas HiRISE y
  Gazetteer de la IAU).
- L1: 3×3 ventanas de 10 km dentro de la ventana de 30 km de cada sitio con HRSC.
- L2: los 116 parches HiRISE, a 30 m.

## 5. Búsqueda de grueso a fino

1. L0 (`rank`): con las referencias v2 se puntúan las 130.535 ventanas de 30 km.
2. Selección L1 (`rank` → `data/fine_tiles.json`): tiles GLO-90 de 1° que contienen
   (a) las 300 mejores ventanas por cuerpo (supresión de vecinos a 50 km), (b) las 5 mejores por
   grupo de referencias, (c) las ventanas a <50 km de los 12 análogos de validación, y
   (d) una muestra de control de 1.500 tiles al azar ponderada por tierra (semilla 2026), que da la
   población para los percentiles globales a escala fina. Coste medido: ~3,2 MB y ~0,35 s por tile
   con 8 hilos → ~2.100 tiles ≈ 7 GB y ~15 min.
3. L1 (`fine_scan --level 1`): cada tile se lee entero una vez y se corta en ventanas de 10 km
   (malla local azimutal) a 120 m (Luna) y 200 m (Marte), con fracciones de WorldCover.
4. Selección L2 (`rank` → `data/fine_l2_blocks.json`): las 60 mejores ventanas L1 por cuerpo
   (incluidos gemelos) + 150 bloques de control al azar.
5. L2 (`fine_scan --level 2`): GLO-30 en bloques de 10 km; Luna 5 km a 60 m (paso 2,5 km),
   Marte 2 km a 30 m (paso 1 km). ~3 MB por bloque → ~0,8 GB.
6. Puntuación final: terreno multiescala = media geométrica de la similitud en los niveles
   disponibles (L0 de la ventana padre, L1 y, para los finalistas, L2). Superficie de WorldCover a
   la escala más fina. Clima solo para los finalistas.

¿Escaneo global fino? Medido en la banda 23–24°N: 14.373 ventanas de 10 km en 55 s y 498 MB.
Extrapolado: ~1,4 millones de ventanas, ~49 GB (cota 84 GB) y 1,5–3 h. Grueso a fino cuesta
~8 GB y ~30 min y, con la muestra de control, permite percentiles globales. No se hace el global.

## 6. Contrato entre módulos

`analogs/dem_io.py` (nuevo):
- `ensure_moon_cache()`: descarga una vez LDEM_80S_40MPP_ADJ.TIF y su EFFRES a `data/cache/moon/`.
- `sample_moon(lat, lon, window_km, px)`, `moon_effres(lat, lon, window_km) -> {p50, p90}`.
- `sample_mars(lat, lon, window_km, px, source="blend"|"mola")`: lectura por rangos de filas
  (≤ 8 hilos), caché de recortes en `data/cache/mars/`.
- `hrsc_check(lat, lon) -> {R400, eq1m, clase}`.
- `sample_earth(lat, lon, window_km, px, collection)`, `earth_cover(lat, lon, window_km, px)`,
  `read_glo90_tile(item)`, caché de WorldCover a ~120 m por tile de 3° en `data/cache/wc120/`.
- Todas devuelven una malla n×n local (azimutal equidistante), fila 0 = norte.

`data/references_v2.json`: lista de referencias con `id, body, level (L0|L1|L2), group, region,
name, lat, lon, kind, parent, source_url, source_note, coord_quality, features, quality`.

`data/fine/l1_<tile>.json`, `data/fine/l2_<bloque>.json`: ventanas con `lat, lon, level, tile,
control (bool), features_moon, features_mars, cover, elev_mean`.

`src/data/results.json` (v2): lo de v1 más `groups`, `levels`, `bodies[b].fine`, validación con
`before`/`after`/`fine`, y `literature` por sitio.

## 7. Reparto (un agente por archivo)

| Fase | Agente | Archivos |
|---|---|---|
| B1 | E/S | `dem_io.py` (nuevo), `terrain.py` (rasgos de forma opcionales) |
| B1 | Sitios | `reference_sites.py` (nuevo) |
| B2 | Referencias | `references.py` → ejecuta y escribe `data/references_v2.json` |
| B2 | Escaneo fino | `fine_scan.py` (nuevo) |
| B2 | Ranking | `rank.py` |
| B2 | Relieve | `relief_images.py` |
| C | Ejecución | L0 → selección → L1 → L2 → final (un proceso, 8 hilos: el límite por servidor) |
| C | Clima (uno solo) | `rank` con clima, presupuesto ≤ 300 consultas, guarda `--climate-budget` |
| C | Bibliografía | un agente por candidato "nuevo" del top 10 de cada cuerpo |
| D | App | `src/lunaMarte.ts`, `src/i18n.ts`, `src/lunaMarte.css`, `luna-marte.html` |

## 8. Estimación

| Paso | Tiempo | Descarga |
|---|---|---|
| Caché Luna (40 m + EFFRES) | ~5 min | 1,7 GB |
| Recortes de Marte (43 sitios, blend + MOLA) | ~15 min | < 50 MB |
| L1 (~2.100 tiles GLO-90 + WorldCover) | ~15–25 min | ~7–8 GB |
| L2 (~270 bloques GLO-30) | ~5 min | ~0,8 GB |
| Imágenes de relieve (~500) | ~15 min | ~1,5 GB |
| Clima | minutos | ≤ 300 consultas (previsto ~40) |
| Total | ~1–1,5 h de cálculo | ~11 GB |
