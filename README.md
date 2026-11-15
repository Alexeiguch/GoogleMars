# Análogos terrestres de la Luna y Marte

Proyecto para el reto **"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"** (NASA Space Apps Challenge 2026).

Buscamos en **toda la Tierra** lugares que se parecen a las zonas candidatas para una base lunar permanente (polo sur, regiones de Artemis III) y a sitios de exploración de Marte. Para cada lugar explicamos **en qué se parece y en qué no**, dimensión por dimensión: terreno, superficie y clima.

Las vistas de la app se enlazan desde la cabecera:

| Vista | Página | Qué muestra |
|---|---|---|
| **Visor 3D de Marte** | `index.html` | 116 parches de Marte (HiRISE, 2 × 2 km a 20 m) frente a candidatos terrestres al mismo tamaño y escala, en 3D y con cámara compartida. |
| **Globos 3D** | `globos.html` | Luna, Tierra y Marte con sitios y análogos del mapa y del visor. |
| **Iluminación solar** | `globos.html#solar-illumination` | Compara el día y la noche en la Luna y Marte para la misma fecha y hora UTC, con reproducción a lo largo de 24 horas o 30 días. |
| **Planificador de rutas** | `globos.html#path-planner` | Dibuja una ruta en Marte o importa GeoJSON, GPX o KML. Compara las rutas propuestas en la Tierra y guarda un candidato para un ensayo. |
| **Mapa Luna y Marte** | `luna-marte.html` | Mapa 2D global con pestañas Luna/Marte, historias destacadas, gemelos por sitio, ranking general, validación con análogos conocidos y comparación lado a lado (relieve a la misma escala e imagen real). |

La iluminación solar se calcula localmente para fechas del 1 de enero de 1800 al 31 de diciembre de 2050. El modelo usa [órbitas de JPL](https://ssd.jpl.nasa.gov/planets/approx_pos.html) y [orientaciones planetarias publicadas por NAIF](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc). Muestra el terminador global de una superficie esférica. Las sombras del relieve y los eclipses quedan fuera del modelo. Cuando WebGL no está disponible, la vista muestra mapas 2D con los mismos cálculos.

## Cómo se ejecuta

### App (Vite + TypeScript + three.js + Leaflet)

```bash
npm ci
npm run dev        # http://localhost:5173 (visor) y /luna-marte.html (mapa)
npm run build      # comprueba tipos (tsc) y genera dist/
```

La app no necesita el pipeline: los datos ya están en `src/data/` y `public/`.

### Pipeline (Python)

El pipeline está en `pipeline/` y se ejecuta **desde esa carpeta**, con un entorno virtual de Python (probado con 3.13):

```bash
cd pipeline
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt   # en macOS/Linux: .venv/bin/python
```

Credenciales de Meteomatics: copia `pipeline/.env.example` como `pipeline/.env` y rellena `METEOMATICS_USER` y `METEOMATICS_PASSWORD`. El archivo `.env` está en `.gitignore`.

Orden de ejecución, versión 2 (cada paso guarda caché y se puede reanudar). Plan y resultados: [`pipeline/PLAN_v2.md`](pipeline/PLAN_v2.md) e [`pipeline/INFORME_v2.md`](pipeline/INFORME_v2.md).

| Paso | Comando | Tarda | Escribe |
|---|---|---|---|
| 0. Caché del DEM lunar polar (LOLA PGDA 40 m + EFFRES, 1,7 GB, una vez) | `python -m analogs.dem_io --moon-cache` | ~30 min | `data/cache/moon/` |
| 1. Referencias Luna/Marte (L0 30 km, L1 10 km, L2 5/2 km; sitios con fuente en `analogs/reference_sites.py`) | `python -m analogs.references` | ~25 min la primera vez | `data/references_v2.json` |
| 2. Escaneo de la Tierra a 30 km (ya hecho; no relanzar) | `python -m analogs.earth_scan` | ~1 h | `data/earth/band_*.json` |
| 3. Ranking L0 y selección de tiles para el escaneo fino | `python -m analogs.rank --no-climate` | ~10 s | `data/fine_tiles.json` |
| 4. Escaneo fino L1 (ventanas de 10 km en ~1.900 tiles) | `python -m analogs.fine_scan --level 1` | ~30 min, ~7 GB | `data/fine/l1/` |
| 5. Ranking L1 y selección de bloques L2 | `python -m analogs.rank --no-climate` | ~1 min | `data/fine_l2_blocks.json` |
| 6. Escaneo fino L2 (Luna 5 km a 60 m, Marte 2 km a 30 m, GLO-30) | `python -m analogs.fine_scan --level 2` | ~5 min | `data/fine/l2/` |
| 7. Ranking final con clima (solo finalistas; `--climate-budget` es el máximo de consultas) | `python -m analogs.rank --climate-budget 60` | ~1 min | `../src/data/results.json` |
| 8. Imágenes de relieve (píxel del dato más grueso de cada comparación) | `python -m analogs.relief_images` | minutos | `../public/relieve/*_L0/L1/L2*.png` |
| 9. Parches de 2 km para el visor 3D | `python -m analogs.patches` | lento la primera vez | `../src/data/catalog.json`, `../public/terrain/g*.f32` |
| 10. Relieve del polo sur lunar para los globos 3D | `python -m analogs.moon_pole` | ~1 min | `../public/imagery/moon_south_pole.webp` |

La bibliografía de los candidatos está en `pipeline/analogs/literature_v2.json` (la lee `rank`). La versión 1 (11 referencias, solo 30 km) quedó en `data/references.json` y `data/backup_v1/`.

Para generar las imágenes de una versión 1, usa `python -m analogs.relief_images --legacy`.

**Pruebas sin gastar consultas ni tocar la app:**

```bash
python -m analogs.rank --no-climate                  # -> data/prueba/results.json (clima ficticio)
python -m analogs.patches --no-climate --regions 2   # -> data/prueba/catalog.json y data/prueba/terrain/
```

Con `--no-climate` o `--regions`, los resultados de prueba se guardan por defecto en `pipeline/data/prueba/`.
El ranking también guarda las selecciones L1 y L2 en `pipeline/data/`. Usa `--sel-dir` para indicar otra carpeta.

Pruebas unitarias sin red desde `pipeline/`: `python -m unittest discover -s tests -v`.

### Consultas a Meteomatics

La cuenta del hackathon permite **1.000 consultas al día** (vence el 22/11/2026). El clima se pide por lotes de 10 puntos (**1 consulta por lote**) y se guarda en `pipeline/data/climate_ecmwf-era5.json`. Solo se piden los puntos que no estén ya en esa caché.

- `analogs.rank` calcula cuántas consultas necesita a partir de la caché local y aplica el límite de `--climate-budget`.
- `analogs.patches` completo: hasta 120 regiones y 32 sitios curados (16 consultas con la caché vacía).

Se usa el modelo **ERA5** (`ecmwf-era5`). El modelo por defecto de Meteomatics ("mix") daba lluvias irreales en desiertos: 1.181 mm/año en la Puna frente a 195 con ERA5, y 702 frente a 21 en el Aïr. `pipeline/data/climate.json` es la caché antigua de ese modelo y ya no se usa.

## Método

> **Versión 2 (14/11/2026).** Lo que sigue describe la versión 1. La v2 añade:
> - Referencias con fuente: 140 ventanas del polo sur lunar con las 16 regiones de Artemis III (mosaicos LROC) y una malla de 84–90°S, y 43 sitios de Marte.
> - Búsqueda de grueso a fino: 30 km → 10 km → 5 km (Luna) o 2 km (Marte, parches HiRISE), siempre con la misma ventana y el mismo píxel que el dato más grueso de cada comparación.
> - Trece sitios lunares fuera del polo con datos de [SLDEM2015](https://astrogeology.usgs.gov/search/map/moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m) y gemelos terrestres por sitio. El ranking lunar general sigue dedicado al polo sur.
> - Validación antes y después, y revisión bibliográfica de los candidatos nuevos.
>
> Detalles y resultados en [`pipeline/INFORME_v2.md`](pipeline/INFORME_v2.md).

### Mapa Luna y Marte (ventanas de 30 km)

1. **Referencias.** Se toma una ventana de 30 km alrededor de 6 zonas del polo sur lunar y de 5 sitios de aterrizaje en Marte, y se miden las pendientes, la rugosidad y el relieve.
   - Luna: NASA LRO **LOLA** DEM, 118 m (USGS Astrogeology).
   - Marte: **HRSC + MOLA** blended DEM, 200 m (ESA Mars Express + NASA MGS, USGS Astrogeology).
   - Las coordenadas lunares son el centro del cráter que da nombre a cada región de Artemis III. Son **aproximadas**, porque NASA no publica coordenadas exactas.
2. **Escaneo de la Tierra.** Toda la tierra firme se divide en ventanas de 30 km (130.535 con datos) y en cada una se miden los mismos rasgos.
   - Relieve: **Copernicus DEM GLO-90** (vía Microsoft Planetary Computer).
   - Superficie: **ESA WorldCover 2021** (10 m), con la fracción de roca o arena desnuda, hielo y vegetación.
3. **Similitud de terreno.** Cada rasgo se convierte en su percentil dentro de la Tierra y se compara con el de cada referencia. Así la Luna, más abrupta que casi toda la Tierra, se compara con lo más abrupto de aquí.
4. **Clima**, solo para los mejores candidatos. Un año de datos diarios de **Meteomatics** (2025, ERA5): temperatura media y mínima, lluvia anual y oscilación térmica diaria.
5. **Puntuación** = 0,5·terreno + 0,25·superficie + 0,25·clima. Se eligen sitios separados al menos 150 km, para que el ranking no se llene con el mismo desierto.
6. **Gemelos por sitio.** Además del ranking general, se buscan los 3 mejores lugares de la Tierra para cada sitio de la Luna y de Marte, separados al menos 300 km entre sí.
7. **Validación.** Se comprueba en qué percentil global quedan análogos ya conocidos (Atacama, Haughton, Valles Secos de McMurdo, Mauna Kea, Meteor Crater…). Si quedan altos, el método detecta lo que la ciencia ya usa. Los candidatos que **no** están cerca de un análogo conocido se marcan como **nuevos**.
8. **Comparación lado a lado.** Las imágenes de relieve miden 30 × 30 km, con píxel de 100 m y el mismo sombreado para la Tierra, la Luna y Marte. Así lo único que cambia entre imágenes es el terreno. La imagen real usa Esri World Imagery para la Tierra y el mosaico global **CTX** para Marte. Del polo sur lunar no hay un mosaico de fotos que sirva en un mapa web.

### Visor 3D de Marte (parches de 2 × 2 km)

- **Marte.** 116 parches de 100 × 100 celdas a 20 m, del [catálogo de DTM HiRISE de USGS](https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/) y del [mosaico HiRISE de Jezero](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic). La fila 0 apunta al norte. Las categorías de terreno siguen las descripciones de las observaciones HiRISE.
- **Tierra, sitios curados.** 32 sitios de EE. UU. del [servicio de elevación USGS 3DEP](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer), elegidos y asignados a categorías a mano. Solo compiten dentro de su categoría.
- **Tierra, escaneo mundial** (`analogs.patches`). Elige unas 120 regiones de suelo desnudo o helado, repartidas por tipo de relieve, a partir del escaneo de 30 km. En cada una corta 49 parches de Copernicus DEM GLO-30, remuestreados de 30 a 20 m, y guarda los 3 mejores por sitio de Marte (una región por puesto).
- **Puntuación** = 0,5·terreno + 0,25·superficie + 0,25·clima.
  - Terreno = 1 − la media, en pendiente mediana, pendiente del percentil 90 y desnivel p5–p95, de |a − b| / (a + b).
  - Superficie = roca o arena desnuda; para los sitios polares de Marte cuentan más la nieve y el hielo.
  - Clima = frío 35 %, seco 35 % y oscilación diaria 30 %.
  - La fórmula está en `pipeline/analogs/patches.py` (para elegir parches) y en `src/data.ts` (para ordenar en la app). Las dos dan el mismo resultado; ver "Comprobación de fórmulas".
- Imágenes de los globos: [Viking MDIM 2.1](https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg) y [NASA Blue Marble, julio de 2004](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/).
- Polo sur de la Luna en los globos 3D: relieve sombreado del [DEM LRO LOLA de 118 m](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m), en proyección azimutal centrada en el polo, de 78°S al polo (237 m por píxel). Se funde con la imagen global entre 78°S y 80°S. La imagen global se estira en los polos, y las fotos del polo sur salen casi todas en sombra.
- Globos 3D de cerca: mosaicos que se cargan según el zoom (`src/tiles.ts`), como en Google Earth. Tierra: Esri World Imagery (la misma del mapa 2D). Luna: mosaico LRO WAC de 100 m (NASA Moon Trek). Marte: Viking MDIM 2.1 (NASA Mars Trek) de lejos y mosaico CTX beta01 de ~5 m (Caltech Murray Lab, vía Esri) de cerca, teñido con el color medio de Marte porque CTX es gris. Necesitan conexión; sin ella se ven las imágenes globales de `public/imagery/`. El servidor de CTX entrega algunos PNG cortados: se pasan por un canvas para conservar la parte buena, y los huecos se rellenan con el nivel anterior.

Para añadir terreno a mano: `python3 scripts/export-catalog.py <carpeta>`, con subcarpetas `mars-crops/` y `earth-crops/`. Cada recorte es un array NumPy de 100 × 100 con un JSON del mismo nombre que lleva sus metadatos. El script calcula las medidas y escribe el catálogo y las rejillas `.f32` en little-endian.

### Planificador de rutas

El planificador acepta una línea continua de 0,1 a 200 km, con coordenadas planetocéntricas y longitudes positivas al este. Las elevaciones salen de modelos digitales del terreno. En la Tierra se prueba la forma de la ruta de Marte en distintas posiciones y orientaciones, con longitudes del 85 %, 100 % y 115 % de la original. La puntuación pondera la distancia (20 %), el cambio de elevación (40 %) y la pendiente con signo (40 %). Los perfiles se comparan al mismo porcentaje recorrido y con escalas verticales compartidas.

- **Marte.** Parches HiRISE de 20 m y un recorte de Jezero del [modelo HRSC + MOLA de USGS](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m). Para rutas cortas fuera de esas zonas, cuando hay conexión, el planificador solicita muestras del modelo global USGS. La malla global empaquetada de [NASA MOLA](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) tiene una separación de aproximadamente 7,4 km en el ecuador y da estimaciones regionales.
- **Tierra.** Parches del visor para rutas cortas y 38 regiones de [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) con máscaras de agua de Natural Earth para rutas más extensas. Las rutas candidatas son trazados topográficos generados. Comprueba el acceso, los caminos y los peligros antes de un ensayo de campo.

Los datos empaquetados permiten buscar sin servicios de red externos. `scripts/export-path-mars.py` y `scripts/export-path-earth.py` reproducen las mallas adicionales. La selección para el ensayo se guarda en el navegador.

## Sitios destacados

| Sitio | Gemelo de | Tipo | Por qué |
|---|---|---|---|
| Alta cordillera de los Andes, ~29,5°S 69,5°O (~4.200 m) | Borde de Shackleton (Luna) | **nuevo** | Pendiente típica 14,6° frente a 14,1°; 48 % del terreno >15° frente a 47 %; 98 % roca desnuda; media −6 °C. No encontramos estudios que la usen como análogo lunar. |
| Cuenca de Qaidam, China, 37,5°N 95,7°E | Cráter Jezero (Marte) | **validación** | El método la encontró solo. Ya está publicada como análogo de Marte (lago evaporado, frío, seco, UV alto, yardangs). |
| Meseta de Ustyurt, Uzbekistán, 42,1°N 55,8°E | Elysium Planitia (Marte) | **nuevo** | Relieve 74 m frente a 74 m; 100 % suelo desnudo; inviernos fríos (mínima de −18 °C en 2025). Solo encontramos comparaciones turísticas, no científicas. |

"Nuevo" significa que no encontramos estudios en una búsqueda rápida, no que esté garantizado que no existan. Hay que revisarlo antes de presentarlo.

Ya existe al menos un trabajo con una idea parecida: una comparación cuantitativa de terreno para elegir zonas de pruebas de rovers (NHSJS 2026). Nuestra diferencia es el escaneo global, los gemelos por sitio de Artemis III y de los rovers de Marte, y la combinación de terreno, superficie y clima.

## Limitaciones (dónde se rompe la analogía)

- **Física.** La Tierra no puede reproducir la gravedad (Luna 0,17 g, Marte 0,38 g), el vacío lunar, la atmósfera fina de CO₂ de Marte ni su radiación.
- **Iluminación polar.** La luz casi permanente de las crestas y la sombra permanente de los cráteres del polo sur lunar no se modelan todavía.
- **Forma del terreno.** Las estadísticas de pendiente pueden coincidir aunque los procesos sean distintos: en la Tierra el agua y el hielo, en la Luna los impactos, en Marte cráteres, viento y agua antigua.
- **Antártida.** WorldCover no la cubre, así que se supone hielo o roca (superficie 0,6 en el mapa, marcada como "supuesta").
- **Clima.** Viene de modelos de reanálisis (ERA5 vía Meteomatics). Ningún lugar de la Tierra llega al frío de Marte ni al de la Luna, así que la puntuación de clima mide cercanía relativa.
  - ERA5 tiene celdas de unos 30 km, así que mezcla montañas y valles cercanos. Por ejemplo, los abanicos del Valle de la Muerte salen con ~205 mm/año, cuando el fondo del valle recibe mucho menos. Los dos conjuntos (el mapa y el visor 3D) usan ERA5.
- **Resolución.** GLO-30 se remuestrea de 30 m a 20 m, así que sus pendientes son algo más suaves que las de 3DEP y HiRISE.
- **Alcance de la puntuación.** Los sitios curados de EE. UU. solo compiten dentro de su categoría asignada a mano. La puntuación compara topografía, cobertura y clima: no estima la equivalencia geológica ni la idoneidad para una misión.
- **Coordenadas.** Las de las regiones de Artemis III son aproximadas.

## Comprobación de fórmulas

La puntuación de los parches de 2 km existe dos veces: en Python (`patches.py`, `total_score`) y en TypeScript (`src/data.ts`, `rankEarthSites`). Si cambias pesos o fórmulas, cámbialos en los dos sitios. El ranking de 30 km (`rank.py`) usa otra fórmula, por percentiles y con pesos de clima por cuerpo, y solo existe en Python: la app muestra sus puntuaciones ya calculadas.

## Estructura

```
index.html, luna-marte.html, globos.html      entradas declaradas en vite.config.ts
src/main.ts, viewer.ts, globes.ts, data.ts   visor 3D
src/lunaMarte.ts, lunaMarte.css              mapa Luna/Marte (Leaflet)
src/globos.ts, globosData.ts, tiles.ts       globos y mosaicos 3D
src/data/catalog.json         sitios del visor 3D (lo escribe analogs.patches)
src/data/results.json         ranking a 30 km (lo escribe analogs.rank)
public/terrain/*.f32          rejillas de 100 × 100 del visor 3D
public/relieve/*.png          imágenes de relieve del mapa (las escribe analogs.relief_images)
pipeline/analogs/             módulos de Python (una sola copia)
pipeline/meteomatics_client.py, planetary_client.py
pipeline/data/                cachés (no van al repositorio)
```

## Ideas para seguir

- Mineralogía con **NASA EMIT** (minerales de superficie) frente a mapas minerales de Marte (CRISM).
- Temperaturas de superficie lunar con **LRO Diviner**, y la terrestre con MODIS LST.
- Iluminación y sombra a partir del DEM (horizonte solar), para comparar con las crestas iluminadas del polo sur.
- Fichas automáticas por sitio redactadas por agentes de IA.
