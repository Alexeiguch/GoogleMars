# TerraTwin

**TerraTwin busca en toda la Tierra los lugares que más se parecen a las zonas candidatas para una base lunar permanente y a sitios de exploración de Marte.** Para cada lugar dice en qué se parece y en qué no, dimensión por dimensión: terreno, superficie y clima.

Proyecto para el reto **"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"** del NASA Space Apps Challenge 2026. El repositorio y su carpeta se llaman `GoogleMars`; el nombre del proyecto es TerraTwin.

Este README describe la **versión 2** del método y de los datos (`src/data/results.json`, `version: 2`). El informe completo del método está en [`pipeline/INFORME_v2.md`](pipeline/INFORME_v2.md), con una fe de erratas al final.

## Cifras clave

Todas salen de `src/data/results.json` y `src/data/catalog.json`.

| Qué | Cifra |
|---|---|
| Ventanas de 30 km medidas en toda la tierra firme | 130.535 |
| Ventanas de 10 km del escaneo fino (L1) | 156.898 |
| Bloques del escaneo más fino (L2) | 270 |
| Referencias de la Luna a 30 km | 153 ventanas: 140 en el polo sur (139 puntúan) y 13 fuera del polo |
| Regiones de Artemis en el polo sur | 16: las 9 de octubre de 2024 y las 7 retiradas de agosto de 2022 |
| Sitios de Marte | 43 (25 puntúan; en 18 solo hay relieve MOLA de 463 m) |
| Grupos con gemelos terrestres | 57 (32 de la Luna y 25 de Marte), con 3 gemelos cada uno |
| Finalistas del ranking multiescala | 20 por cuerpo; lista «Solo nuevos»: 13 en la Luna y 20 en Marte |
| Historias destacadas | 10 (4 de la Luna y 6 de Marte) |
| Parches de 2 × 2 km para comparar en 3D | 374: 116 de Marte (HiRISE) y 258 de la Tierra |
| Validación con 11 análogos conocidos | 8 de 11 en el percentil 90 o más, en la Luna y en Marte |

## Cómo se ejecuta la app

La app usa Vite, TypeScript, three.js y Leaflet. No necesita el pipeline: los datos ya están en `src/data/` y `public/`.

```bash
npm ci
npm run dev        # http://localhost:5173 (abre los globos 3D) y /luna-marte.html (mapa)
npm run build      # comprueba tipos (tsc) y genera dist/
npm run preview    # sirve dist/
npm run test:e2e   # pruebas de extremo a extremo (carpeta tests/)
```

La interfaz está en español y en inglés. Los globos de cerca y las imágenes reales del mapa necesitan conexión a internet; sin ella se ven las imágenes globales de `public/imagery/`.

## Las dos páginas

La cabecera dice **TerraTwin** y enlaza las dos páginas y el planificador de rutas, que vive dentro de los globos. `index.html` solo redirige a `globos.html`.

### Globos 3D (`globos.html`)

- La Luna, la Tierra y Marte dibujados del mismo tamaño, con los sitios de referencia de la Luna y de Marte y los puntos de la Tierra que más se les parecen. Se puede ver solo los mejores o todos, filtrar por sitio e ir a un punto.
- Al elegir un punto se abre su ficha, con sus gemelos.
- Al acercarse, los globos cargan mosaicos según el zoom (`src/tiles.ts`). El polo sur de la Luna se dibuja con un relieve sombreado propio, de 78°S al polo.
- **Comparación de terreno en 3D** (antes era una página aparte, el «Visor 3D de Marte»). Se elige un sitio de la Luna o de Marte, se pulsa **«Buscar análogos»** (*Find analogs*) y se elige uno de sus análogos terrestres para compararlo en 3D, con la misma ventana, la misma escala y la cámara compartida. El terreno se colorea por relieve o por pendiente, y una tabla da las medidas de los dos.
  - Sitios de referencia de la Luna y de Marte: ventanas de 30 km con cuadrículas de altura de 100 × 100 celdas a 300 m (`public/terrain/l0/`). Si un sitio no tiene cuadrícula exportada, se muestra su relieve sombreado en 2D.
  - Sitios de Marte con relieve HiRISE: parches de 2 × 2 km de 100 × 100 celdas a 20 m (`public/terrain/*.f32`).

### Planificador de rutas (`globos.html#path-planner`)

Dibuja una ruta en Marte o importa GeoJSON, GPX o KML. Compara las rutas propuestas en la Tierra y guarda un candidato para un ensayo. Se abre desde el enlace «Planificador de rutas» de la cabecera.

El planificador acepta una línea continua de 0,1 a 200 km, con coordenadas planetocéntricas y longitudes positivas al este. Las elevaciones salen de modelos digitales del terreno. En la Tierra se prueba la forma de la ruta de Marte en distintas posiciones y orientaciones, con longitudes del 85 %, 100 % y 115 % de la original. La puntuación pondera la distancia (20 %), el cambio de elevación (40 %) y la pendiente con signo (40 %). Los perfiles se comparan al mismo porcentaje recorrido y con escalas verticales compartidas.

- **Marte.** Parches HiRISE de 20 m y un recorte de Jezero del [modelo HRSC + MOLA de USGS](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m). Para rutas cortas fuera de esas zonas, cuando hay conexión, el planificador solicita muestras del modelo global USGS. La malla global empaquetada de [NASA MOLA](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) tiene una separación de aproximadamente 7,4 km en el ecuador y da estimaciones regionales.
- **Tierra.** Parches del visor para rutas cortas y 38 regiones de [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) con máscaras de agua de Natural Earth para rutas más extensas. Las rutas candidatas son trazados topográficos generados. Comprueba el acceso, los caminos y los peligros antes de un ensayo de campo.

Los datos empaquetados permiten buscar sin servicios de red externos. `scripts/export-path-mars.py` y `scripts/export-path-earth.py` reproducen las mallas adicionales. La selección para el ensayo se guarda en el navegador.

### Mapa Luna y Marte (`luna-marte.html`)

Mapa 2D de toda la Tierra con una pestaña para la Luna y otra para Marte:

- **Historias destacadas:** las 10 de la tabla de más abajo.
- **Ranking general**, con tres listas: final multiescala (30 km → 10 km → 5 o 2 km), «Solo nuevos» y a 30 km.
- **Referencias** de la Luna y de Marte, con su fuente.
- **Gemelos terrestres por grupo:** los 3 mejores lugares de la Tierra para cada región o sitio.
- **Validación** con análogos conocidos.
- **Comparación lado a lado:** relieve sombreado a la misma escala e imagen real.

## Método

El método busca de grueso a fino. Primero mide toda la Tierra con ventanas de 30 km, después repite la medida a 10 km en las zonas mejores y al final a 5 km (Luna) o 2 km (Marte).

### Escalas, datos y resolución real

Regla: en cada comparación, la Tierra y la Luna o Marte usan **la misma ventana y el mismo píxel**, y el píxel no es más fino que la resolución real del dato más grueso.

| Nivel | Luna ↔ Tierra | Marte ↔ Tierra | Dato de la Tierra |
|---|---|---|---|
| L0 | 30 km a 400 m | 30 km a 400 m | Copernicus GLO-90 (90 m) |
| L1 | 10 km a 120 m | 10 km a 200 m | Copernicus GLO-90 (90 m) |
| L2 | 5 km a 60 m | 2 km a 30 m | Copernicus GLO-30 (30 m) |

- **Luna, polo sur:** LOLA `LDEM_80S_40MPP_ADJ` de NASA GSFC/PGDA (Barker et al. 2023), con píxel de 40 m. En L2 solo se usan las teselas cuya resolución efectiva mediana es de 60 m o mejor.
- **Luna, fuera del polo:** SLDEM2015 (LOLA + Kaguya TC, 59 m, de 60°S a 60°N). Solo L0 y L1.
- **Marte, L0 y L1:** blend HRSC + MOLA v2 de 200 m. Donde el blend solo tiene MOLA (463 m), el sitio no puntúa.
- **Marte, L2:** 116 parches de modelos de terreno HiRISE (~1–2 m), remuestreados a 30 m.
- **Superficie de la Tierra:** ESA WorldCover 2021 (10 m).
- **Clima de la Tierra:** un año de datos diarios (2025) del reanálisis ERA5, vía Meteomatics.

### Referencias

- **Luna, polo sur (140 ventanas de 30 km):** las 16 regiones de Artemis, 8 teselas de 30 km más en Mons Mouton Plateau, 3 sitios (IM-2 Athena, el borde sur de Shackleton y el centro de Shackleton) y una malla regular de 113 ventanas entre 84°S y 90°S. Las coordenadas de las regiones son el centro de los mosaicos LROC de cada una. Nobile Rim 1 comparte mosaico con Mons Mouton y no puntúa aparte, por eso puntúan 139.
- **Luna, fuera del polo (13 sitios):** Apollo 11, 12, 14, 15, 16 y 17, Chang'e 3, 4, 5 y 6, y los fosos de Marius Hills, Mare Tranquillitatis y Mare Ingenii. Solo tienen gemelos: no entran en el ranking ni en la validación.
- **Marte (43 sitios):** 10 aterrizajes, 10 zonas de exploración humana del taller de 2015 y 23 sitios por tipo de terreno. Puntúan 25.
- **Escalas finas:** 1.232 ventanas de 10 km y 113 teselas de 5 km en el polo sur lunar; 201 ventanas de 10 km en Marte.

Cada referencia lleva su fuente en `pipeline/analogs/reference_sites.py`.

### Puntuación

1. **Rasgos de terreno.** En cada ventana se miden seis: pendiente típica, pendiente del percentil 90, fracción llana (< 5°), fracción empinada (> 15°), relieve local (p5–p95) y rugosidad (~1 km en L0; la escala baja con el píxel en L1 y L2).
2. **Similitud de terreno.** Cada rasgo se convierte en su percentil dentro de la Tierra y se compara con el de la referencia. La similitud es exp(−(d/0,08)²), donde d es la diferencia cuadrática media de percentiles. Así la Luna, más abrupta que casi toda la Tierra, se compara con lo más abrupto de aquí.
3. **Terreno multiescala.** El terreno final es la media geométrica de la similitud a las tres escalas (T0, T1 y T2).
4. **Superficie.** Fracción de suelo desnudo, más 0,6 por la fracción de nieve o hielo y 0,3 por la de musgo y liquen.
5. **Clima.** Frío, sequedad y oscilación térmica diaria. Pesos en la Luna: 0,5, 0,25 y 0,25. En Marte: 0,35, 0,35 y 0,30. Solo se pide clima para lo que se muestra.
6. **Total = 0,5·terreno + 0,25·superficie + 0,25·clima.**
7. **Ranking y gemelos.** En el ranking los sitios están separados al menos 150 km, para que no se llene con el mismo desierto. Los 3 gemelos de cada grupo están separados al menos 300 km.
8. **«Solo nuevos».** Los mejores bloques L2 que no están cerca de un análogo conocido ni constan como ya estudiados en la bibliografía, con terreno^0,6 · superficie^0,4 ≥ 0,6.
9. **Robustez.** Se probaron 42 combinaciones de pesos. Cada candidato lleva el porcentaje de combinaciones en que sigue en el top 10 y su mejor y peor puesto.

La comparación en 3D de los parches de 2 km usa otra fórmula de terreno: 1 menos la media de |a − b| / (a + b) en pendiente mediana, pendiente p90 y relieve. Está en `pipeline/analogs/patches.py` y en `src/data.ts`; si cambias una, cambia la otra.

### Validación

Antes de ver resultados se fijaron 12 análogos ya usados por la ciencia. Se mide en qué percentil global queda la mejor ventana a menos de 50 km de cada uno. Lanzarote no tiene ninguna ventana de 30 km a esa distancia, así que cuentan 11.

- **A 30 km:** 8 de 11 quedan en el percentil 90 o más, en la Luna y en Marte. Medianas: 97,8 (Luna) y 97,5 (Marte).
- **De la versión 1 a la 2:** la media de la Luna se queda en 93,1 y la de Marte sube de 86,8 a 91,9. Ningún análogo baja más de 10 puntos; la mayor bajada es Meteor Crater en Marte (−5,5).
- **A 10 km, con el percentil «justo»:** 9 de 11 en la Luna (mediana 94,0) y 8 de 11 en Marte (mediana 91,6). «Justo» compara la mejor ventana cercana al análogo con la mejor ventana cercana a cada punto de control.

| Análogo | Luna, 30 km | Luna, 10 km | Marte, 30 km | Marte, 10 km |
|---|---|---|---|---|
| Atacama (Yungay) | 100,0 | 100,0 | 99,7 | 99,5 |
| Cráter Haughton | 94,7 | 93,0 | 98,2 | 94,6 |
| Valle de la Muerte | 100,0 | 99,9 | 100,0 | 99,2 |
| Valles Secos de McMurdo | 97,8 | 94,0 | 97,5 | 90,5 |
| Askja | 97,9 | 96,4 | 98,9 | 94,6 |
| Mauna Kea | 94,8 | 96,2 | 90,5 | 89,0 |
| Bockfjorden | 98,1 | 92,4 | 97,5 | 91,6 |
| MDRS, Utah | 99,0 | 99,1 | 99,5 | 96,7 |
| Meteor Crater | 77,7 | 93,4 | 86,3 | 90,3 |
| Río Tinto | 78,7 | 72,5 | 66,5 | 59,0 |
| Pilbara | 85,1 | 76,0 | 76,5 | 70,7 |

Río Tinto es el más bajo en Marte a las dos escalas y en la Luna a 10 km; en la Luna a 30 km el más bajo es Meteor Crater (77,7). Río Tinto es un análogo mineralógico (aguas ácidas), no topográfico, y este método no mide minerales.

## Resultados destacados

Las 10 historias de `results.json → featured`. Las tres cifras de terreno son la similitud sobre 100 a 30 km, 10 km y 5 km (Luna) o 2 km (Marte).

| Lugar de la Tierra | Gemelo de | Tipo | Terreno | Dónde falla |
|---|---|---|---|---|
| Changtang, Tíbet occidental (33,77°N 84,39°E, ~4.800 m) | Llanuras del polo sur lunar | nuevo | 98 / 93 / 90 | Caen 333 mm al año; el relieve lo modelan el hielo y el agua |
| Alta cordillera de San Juan, Argentina (29,50°S 69,51°O, ~4.200 m) | Cráter Shackleton | nuevo | Pendiente típica 14,6° frente a 14,0° (30 km) | Shackleton es más profundo: 3.781 m de relieve frente a 2.027 m |
| Cuenca de Qaidam, China (38,14°N 91,44°E, ~3.250 m) | Zona de exploración de Jezero | validación | 96 / 99 / 96 | No es nuevo: ya está publicada como análogo de Marte. El método la sitúa arriba, aunque no era uno de los análogos fijados de antemano para la validación: es una coincidencia observada después |
| Meseta de Djado, Níger (22,68°N 11,84°E) | Llanuras del cráter Gusev (Spirit) | nuevo | 98 / 100 / 93 | Es calurosa: media de 23,7 °C |
| Iglesia, San Juan, Argentina (28,95°S 69,19°O, ~3.280 m) | Llanuras de Haworth | nuevo | 97 / 97 / 94 | Similitud climática de solo 31/100 |
| Cuenca alta del Loa, Chile (21,86°S 68,94°O, ~3.490 m) | Laderas de Mons Mouton Plateau | nuevo | 96 / 94 / 88 | Similitud climática de solo 28/100 |
| Llanura de la Tamesna, Argelia (20,14°N 6,16°E, ~490 m) | Cráter con hielo de Arcadia Planitia | nuevo | 95 / 94 / 96 | Media de 29,5 °C y nada de hielo |
| Colinas del Mar Rojo, Egipto (23,50°N 35,06°E, ~456 m) | Nili Fossae; a 2 km, capas de roca de Terra Sirenum | nuevo | 95 / 97 / 98 | Media de 26,9 °C |
| Borde norte del Changtang, Qiemo, Xinjiang (35,77°N 85,72°E, ~5.370 m) | Kasei Valles; a 2 km, un delta invertido | nuevo | 94,6 / 99,5 / 97,5 | Caen 368 mm al año |
| Llanura de Tim Mersoï, Níger (19,68°N 7,55°E, ~490 m) | Meridiani Planum (Opportunity) | nuevo | 98 / 94 / 96 | Media de 29,9 °C |

**«Nuevo» significa que no encontramos estudios que usen el lugar como análogo en una búsqueda limitada.** No garantiza que no existan. La bibliografía está en `pipeline/analogs/literature_v2.json`: 38 lugares, de los que 23 constan como no encontrados, 3 como ya estudiados y 12 como no verificados.

## Limitaciones

Dónde se rompe la analogía y qué no hace el método:

- **Física.** La Tierra no reproduce la gravedad (Luna 0,17 g, Marte 0,38 g), el vacío lunar, la atmósfera fina de CO₂ de Marte ni su radiación.
- **Origen del terreno.** Las pendientes pueden coincidir aunque los procesos sean distintos: en la Tierra, agua, hielo y viento; en la Luna, impactos.
- **Superficie saturada.** Los 20 finalistas de Marte y 18 de los 20 de la Luna tienen superficie 1,00. WorldCover solo dice «desnudo», no qué roca es, así que la superficie apenas separa a los mejores.
- **Clima.** Ningún lugar de la Tierra llega al frío de Marte ni al de la Luna: la puntuación mide cercanía relativa. De los 10 primeros candidatos nuevos de Marte, 9 son desiertos cálidos, con medias de 20 a 30 °C. ERA5 tiene celdas de unos 30 km y mezcla montañas y valles cercanos.
- **Iluminación polar.** La luz casi permanente de las crestas y la sombra permanente de los cráteres del polo sur lunar no se modelan.
- **Marte sin dato fino.** 18 de los 43 sitios no puntúan porque allí solo hay MOLA. Separarlos del resto es una heurística calibrada con 8 puntos, con casos dudosos en terreno empinado (Coprates, Hale, Tooting).
- **L2 de Marte por categoría.** A 2 km casi siempre se compara con parches HiRISE de la misma categoría de terreno, no del mismo lugar: 109 de los 116 parches están a más de 100 km de todos los sitios de referencia.
- **Comparación 3D de 2 km.** Los parches terrestres de GLO-30 se remuestrean de 30 m a 20 m, más fino que el dato, así que sus pendientes podrían salir más suaves que las de HiRISE (no se ha medido).
- **Pesos.** Los pesos 0,5 / 0,25 / 0,25 (terreno, superficie, clima) son una elección; la robustez frente a 42 combinaciones está en `pipeline/INFORME_v2.md`, sección 3 ter.
- **Bibliografía breve en algunos sitios.** La búsqueda de Djado fue de 3 consultas y la de la alta cordillera de San Juan, breve: «no encontramos estudios» se refiere a esas búsquedas.
- **Nombres de lugar fuera del polo.** Los nombres de los gemelos de los sitios lunares fuera del polo salen de las coordenadas (país o región), no de un geocodificador verificado uno a uno.
- **Luna fuera del polo.** Solo gemelos a 30 y 10 km, sin L2. Los fosos miden decenas de metros: se compara el terreno que los rodea, no la cueva.
- **Coordenadas.** Las de las regiones de Artemis son el centro de los mosaicos LROC; no pudimos descargar los polígonos oficiales. Las longitudes de Nobile Rim 1, Mons Mouton, de Gerlache Rim 2 y Slater Plain son inciertas. En las zonas de exploración de Marte no sabemos si la latitud publicada es planetocéntrica o planetográfica (hasta ~0,3°).
- **Resolución efectiva lunar.** La capa que la mide no declara unidades; suponemos metros.
- **Percentil «justo» a 10 km.** Tiene un sesgo de borde pequeño.
- **Validación.** Río Tinto y Pilbara quedan bajos, y Lanzarote no se puede medir a 30 km porque es una isla.
- **Bibliografía.** Es una búsqueda limitada. Quedan 12 lugares no verificados, 7 de ellos sin búsquedas anotadas, y los candidatos de más abajo en las listas están sin revisar.
- **Antártida.** WorldCover no la cubre: allí se supone una superficie de 0,6.
- **Alcance.** La puntuación compara topografía, cobertura del suelo y clima. No estima la equivalencia geológica ni la idoneidad para una misión.

## Cómo regenerar los datos

No hace falta para usar la app. El pipeline está en `pipeline/` y se ejecuta **desde esa carpeta**, con un entorno virtual de Python (probado con 3.13):

```bash
cd pipeline
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt   # en macOS/Linux: .venv/bin/python
```

Las cachés van en `pipeline/data/`, que no está en el repositorio. Partiendo de cero, la versión 2 descargó unos 17 GB y tardó unas 2,5 horas de cálculo (ver el informe).

Credenciales de Meteomatics: copia `pipeline/.env.example` como `pipeline/.env` y rellena `METEOMATICS_USER` y `METEOMATICS_PASSWORD`. El archivo `.env` está en `.gitignore`.

| Paso | Comando | Escribe |
|---|---|---|
| 0. Caché del DEM lunar polar (1,7 GB, una vez) | `python -m analogs.dem_io --moon-cache` | `data/cache/` |
| 1. Referencias de la Luna y de Marte | `python -m analogs.references` | `data/references_v2.json` |
| 2. Escaneo de la Tierra a 30 km | `python -m analogs.earth_scan` | `data/earth/band_*.json` |
| 3. Ranking a 30 km y selección de tiles para L1 | `python -m analogs.rank --no-climate` | `data/fine_tiles.json` |
| 4. Escaneo fino L1 (10 km) | `python -m analogs.fine_scan --level 1` | `data/fine/l1/` |
| 5. Ranking L1 y selección de bloques para L2 | `python -m analogs.rank --no-climate` | `data/fine_l2_blocks.json` |
| 6. Escaneo fino L2 (5 km y 2 km) | `python -m analogs.fine_scan --level 2` | `data/fine/l2/` |
| 7. Ranking final con clima | `python -m analogs.rank --climate-budget 60` | `../src/data/results.json` |
| 8. Imágenes de relieve del mapa | `python -m analogs.relief_images` | `../public/relieve/*.png` |
| 9. Parches de 2 km para la comparación 3D | `python -m analogs.patches` | `../src/data/catalog.json`, `../public/terrain/g*.f32` |
| 10. Relieve del polo sur lunar para los globos | `python -m analogs.moon_pole` | `../public/imagery/moon_south_pole.webp` |
| 11. Cuadrículas de altura de 30 km a 300 m | `python -m analogs.height_grids` | `../public/terrain/l0/*.f32`, `index.json` |

Cada paso guarda caché y se puede reanudar.

- `--climate-budget N` es el máximo de consultas nuevas a Meteomatics: `rank` aborta si necesita más. Por defecto es 0.
- **`--help` no es seguro en todos los módulos.** `rank`, `references`, `fine_scan`, `relief_images` y `height_grids` lo admiten. `patches` y `moon_pole` no leen `--help` y se ejecutan igual, sobrescribiendo archivos de la app. `earth_scan` solo admite números de banda de latitud (por ejemplo, `python -m analogs.earth_scan -24`).

**Pruebas sin gastar consultas ni tocar la app:**

```bash
python -m analogs.rank --no-climate                  # -> data/prueba/results.json (clima ficticio)
python -m analogs.patches --no-climate --regions 2   # -> data/prueba/catalog.json y data/prueba/terrain/
python -m unittest discover -s tests -v              # pruebas unitarias, sin red
```

Cada ejecución de `rank`, con o sin clima, reescribe las selecciones `fine_tiles.json` y `fine_l2_blocks.json` en `data/` (o en la carpeta de `--fine-dir`, si se da). Usa `--sel-dir` para mandarlas a otra carpeta.

### Consultas a Meteomatics

- La cuenta del hackathon permite 1.000 consultas al día.
- El clima se pide por lotes de 10 puntos, con una consulta por lote, y se guarda en `pipeline/data/climate_ecmwf-era5.json`. Solo se piden los puntos que no están ya en esa caché, que hoy tiene 568.
- `analogs.patches` completo pide un punto por región (120) y uno por sitio curado (32): 16 consultas con la caché vacía.
- Se usa el modelo ERA5 (`ecmwf-era5`). La caché antigua, `pipeline/data/climate.json`, daba lluvias irreales en desiertos y ya no se usa. Por ejemplo, en un punto de la Puna (26,13°S 68,40°O) da 1.174 mm al año, frente a 106 con ERA5.

## Estructura

```
index.html                        redirige a globos.html
globos.html, luna-marte.html      las dos páginas (declaradas en vite.config.ts)
src/globos.ts, globosData.ts      globos 3D
src/viewer.ts, data.ts            comparación de terreno en 3D
src/tiles.ts, globeTexture.ts     mosaicos e imágenes de los globos
src/lunaMarte.ts                  mapa Luna y Marte (Leaflet)
src/path*.ts, pathComparison.css  planificador de rutas
src/data/path-earth.json          regiones terrestres del planificador
public/terrain/path-*.i16.gz      mallas de elevación del planificador (las escriben scripts/export-path-*.py)
src/i18n.ts, prefs.ts             textos en español e inglés
src/data/results.json             referencias, rankings, gemelos y validación (lo escribe analogs.rank)
src/data/catalog.json             parches de 2 km (lo escribe analogs.patches)
public/terrain/*.f32              rejillas de 100 × 100 de los parches de 2 km
public/terrain/l0/                cuadrículas de altura de 30 km (las escribe analogs.height_grids)
public/relieve/*.png              imágenes de relieve del mapa (las escribe analogs.relief_images)
public/imagery/                   imágenes globales de los globos
pipeline/analogs/                 módulos de Python
pipeline/tests/                   pruebas unitarias del pipeline
pipeline/data/                    cachés (no van al repositorio)
tests/                            pruebas de extremo a extremo de la app
scripts/                          alta manual de terreno (no se usa en la versión 2) y mallas del planificador
```

## Fuentes de datos

| Dato | Fuente y crédito |
|---|---|
| Relieve del polo sur lunar | LOLA `LDEM_80S_40MPP_ADJ`, 40 m. NASA GSFC / PGDA (Barker et al. 2023) |
| Relieve lunar fuera del polo | SLDEM2015, 59 m. LOLA + Kaguya TC, USGS Astrogeology |
| Regiones de Artemis | Mosaicos LROC NAC (Arizona State University) |
| Relieve del polo sur en los globos y en el minimapa | DEM LRO LOLA de 118 m. USGS Astrogeology |
| Relieve de Marte a 30 y 10 km | Blend HRSC + MOLA v2, 200 m. ESA Mars Express, NASA MGS, USGS Astrogeology |
| Relieve de Marte a 2 km | Modelos de terreno HiRISE. NASA / JPL / USGS |
| Relieve de la Tierra | Copernicus DEM GLO-90 y GLO-30 (ESA), vía Microsoft Planetary Computer |
| Relieve de 32 sitios de EE. UU. | 3DEP, USGS |
| Superficie de la Tierra | ESA WorldCover 2021 |
| Clima de la Tierra | Reanálisis ERA5 (ECMWF), vía Meteomatics |
| Imagen de la Tierra | Esri World Imagery; NASA Blue Marble en el globo |
| Imagen de la Luna | CGI Moon Kit, NASA Scientific Visualization Studio; mosaico LRO WAC de 100 m (NASA / GSFC / Arizona State University), vía NASA Moon Trek |
| Relieve del planificador de rutas | Marte: HiRISE, HRSC + MOLA (USGS) y malla global MOLA MEGDR (NASA PDS). Tierra: Mapzen Terrain Tiles (AWS Open Data) con máscaras de agua de Natural Earth |
| Imagen de Marte | Viking MDIM 2.1, vía NASA Mars Trek; mosaico CTX (NASA / JPL / MSSS / Caltech Murray Lab), vía Esri |

Los enlaces a cada fuente están en el pie de las dos páginas de la app.

## Uso de IA

- **Código y documentación.** El pipeline, la app y esta documentación se escribieron con ayuda de asistentes de IA. Los commits en los que participó Claude (Anthropic) llevan la línea `Co-Authored-By` en el historial de git.
- **Revisión bibliográfica.** La hicieron agentes de IA: uno por candidato, con búsquedas en inglés y en el idioma local, y un verificador independiente que abrió cada enlace de los lugares «ya estudiados».
- **Historias destacadas.** Un agente redactó cada una solo con los datos de `results.json` y fuentes web citadas. Otro agente comprobó cada cifra y después se revisaron a mano.
- **Lo que no hace la IA.** Las puntuaciones las calcula código determinista (`pipeline/analogs/`), no un modelo de IA.

## Ideas para seguir

- Mineralogía con **NASA EMIT** frente a los mapas minerales de Marte (CRISM), para separar la superficie por tipo de roca.
- Temperatura de la superficie lunar con **LRO Diviner**, y la terrestre con MODIS LST.
- Iluminación y sombra a partir del DEM, para comparar con las crestas iluminadas del polo sur.
- Polo norte lunar y revisión bibliográfica de los candidatos que faltan.
