# Informe v2: más referencias y búsqueda de grueso a fino

Fecha: 14/11/2026. Rama `integrate-global-analogs`. Plan previo: [`PLAN_v2.md`](PLAN_v2.md).
Datos de la app: `src/data/results.json` (lo escribe `python -m analogs.rank`).

## 1. Escalas por cuerpo y por qué

Regla: en cada comparación, la Tierra y la Luna o Marte usan la misma ventana y el mismo píxel, y el píxel no
es más fino que la resolución real del dato más grueso de esa comparación.

| Nivel | Luna ↔ Tierra | Marte ↔ Tierra | Dato más grueso (resolución real) |
|---|---|---|---|
| L0 | 30 km a 400 m | 30 km a 400 m | Tierra: escaneo global ya hecho a 400 m (GLO-90, 90 m). Luna: LOLA PGDA 40 m, resolución efectiva 15–36 m en las referencias. Marte: blend HRSC+MOLA 200 m donde hay HRSC |
| L1 | 10 km a 120 m (83 px) | 10 km a 200 m (50 px) | Luna: GLO-90 (90 m) → 120 m. Marte: HRSC 200 m |
| L2 | 5 km a 60 m (83 px) | 2 km a 30 m (67 px) | Luna: LOLA 40 m con resolución efectiva p50 ≤ 60 m comprobada en cada tesela (12,7–35,6 m). Marte: GLO-30 (30 m) frente a parches HiRISE (~1–2 m) remuestreados |

Datos y resolución real:
- **Luna:** `LDEM_80S_40MPP_ADJ` de NASA GSFC/PGDA (Barker et al. 2023, PSJ 4:183), 80–90°S, COG de 716 MB, con su
  capa de resolución efectiva `_EFFRES` (1,0 GB). URLs comprobadas (HTTP 200). Coincide con el LOLA global de
  118 m en Shackleton, Malapert y Haworth (diferencia media −3 a +1 m; correlación 0,9999).
  Se descartaron los productos de 5 m y 10 m: el 89–96 % de sus píxeles están interpolados, así que su
  resolución real es la misma que la del de 20 m.
- **Marte:** blend HRSC+MOLA v2 de 200 m, leído por rangos de bytes fila a fila (~0,1 MB por ventana en lugar
  de 52 MB). En un 42 % de los sitios (18 de 43) el blend solo tiene MOLA (463 m, interpolado entre trazas).
  Se detecta con una medida propia (R400 y eq1m frente al MOLA de 463 m). Esos sitios **no puntúan** a 400 m:
  compararlos aparentaba una precisión que no tienen. Además salían artificialmente lisos y llenaban el ranking
  de llanuras (viking1 era el n.º 1). Se mantienen descritos, con aviso.
- **Tierra:** Copernicus GLO-90 (L0 y L1), GLO-30 (L2) y ESA WorldCover 2021 (superficie, a ~120 m).
- **Imágenes de relieve:** la v1 dibujaba la Luna y Marte a 100 m, más fino que el dato. Ahora se dibujan a
  120 m (Luna) y 200 m (Marte) en 30 y 10 km, y a 60 m y 30 m en L2.

**¿Por qué no un escaneo global fino?** Medido en la banda 23–24°N: 14.373 ventanas de 10 km en 55 s y 498 MB.
Extrapolado al globo: ~1,4 millones de ventanas, ~49 GB (hasta 84 GB) y 1,5–3 h. El esquema de grueso a fino
costó 7,4 GB y 32 min en L1. Con una muestra de control de 1.500 tiles al azar sigue dando percentiles globales.
Se eligió grueso a fino.

## 2. Referencias nuevas

| Cuerpo | L0 (30 km) | L1 (10 km) | L2 | De dónde salen las coordenadas |
|---|---|---|---|---|
| Luna | 140 (139 puntúan) | 1.246 (1.232) | 129 de 5 km (113) | 9 regiones de Artemis III (oct-2024) y 7 retiradas (ago-2022): centro y límites de los mosaicos LROC NAC ROI "low-Sun controlled" (data.lroc.im-ldi.com), cotejados con la tabla de latitudes de NASA GSFC (NTRS 20250007692). Sitios: IM-2 (LROC), borde S de Shackleton (NTRS 20170007365), centro de Shackleton (IAU). Malla regular de 84–90°S a 30 km (113) y a 10 km (1.041) |
| Marte | 43 sitios (25 puntúan) | 225 (201) | 116 parches HiRISE | 10 aterrizajes (ODE/PDS, GeoJSON de NASA/JPL, Golombek et al. 2020, Liu et al. 2022), 10 zonas de exploración humana del taller NASA/LPI de 2015 y 23 sitios por tipo (cañones, volcanes, barrancos, cráteres, llanuras con hielo, polos, yardangs, dunas, caos, filosilicatos): páginas HiRISE y Gazetteer de la IAU |

- Cada región de Artemis III tiene referencias en los tres niveles. NASA no publica coordenadas en las notas de
  prensa; las de los mosaicos LROC son las mejores fuentes oficiales que encontramos. Los polígonos oficiales
  (USGS, DOI 10.5066/P1MEQ6UK) no se pudieron descargar: ScienceBase pide un desafío anti-bots.
- Nobile Rim 1 y Mons Mouton comparten mosaico (mismo centro y límites), así que puntúan juntas.
- Las longitudes de de Gerlache Rim 2 y Slater Plain son inciertas y están marcadas.
- Desde feb-2026 el primer alunizaje tripulado es Artemis IV; las 9 regiones siguen vigentes.
- Todo, con fuente y nota, en `pipeline/analogs/reference_sites.py`.

## 3. Top 10 (ranking final multiescala: 30 km → 10 km → 5/2 km, con clima)

Total = 0,5·terreno + 0,25·superficie + 0,25·clima. El terreno es la media geométrica de la similitud a las
tres escalas (T0, T1 y T2). Clima: ERA5 de 2025 vía Meteomatics.

### Luna (polo sur)

| # | Lugar (lat, lon, altitud) | Gemelo | Total | Terreno (T0/T1/T2) | Sup. | Clima | Estado | En qué falla |
|---|---|---|---|---|---|---|---|---|
| 1 | Puna de Atacama, −28,59, −69,09, 3.881 m | malla polar 10 km; a 5 km, Mons Mouton Plateau | 0,83 | 0,98 (0,99/0,98/0,97) | 1,00 | 0,35 | conocido (Puna) | llueven 141 mm; media +1,6 °C |
| 2 | Puna de Atacama, −25,23, −68,05, 4.069 m | malla polar; Mons Mouton Plateau | 0,82 | 0,97 (0,96/0,96/0,98) | 1,00 | 0,32 | conocido (Puna) | media +3,7 °C |
| 3 | Cuenca de Qaidam, 38,32, 90,10, 3.373 m | malla polar; Haworth | 0,81 | 0,95 | 1,00 | 0,35 | conocido (Qaidam) | relieve eólico, no de impactos |
| 4 | Atacama, −23,05, −69,16, 2.187 m | malla polar; Haworth | 0,81 | 0,97 | 1,00 | 0,29 | conocido (Atacama) | cálido (media 16,4 °C) |
| 5 | Puna, −27,23, −68,80, 4.813 m | malla polar; Mons Mouton Plateau | 0,81 | 0,95 | 1,00 | 0,32 | conocido (Puna) | 164 mm de lluvia |
| 6 | Atacama costera, −24,32, −70,35, 2.100 m | Mons Mouton Plateau (10 y 5 km) | 0,80 | 0,96 | 1,00 | 0,29 | conocido (Atacama) | cálido (13,1 °C); oscilación diaria pequeña (7 °C) |
| 7 | **Changtang (Gêrzê, Tíbet)**, 33,77, 84,39, 4.826 m | malla polar 86,4°S; a 5 km, Haworth | 0,80 | 0,94 (0,98/0,93/0,90) | 1,00 | 0,32 | **nuevo**: no encontrado tras 8 búsquedas en inglés y chino | 333 mm de lluvia; relieve glaciar y fluvial |
| 8 | Desierto de Lut, 29,59, 60,40, 1.696 m | malla polar; Haworth | 0,79 | 0,96 | 1,00 | 0,23 | conocido (Lut) | cálido (19,9 °C) |
| 9 | Precordillera de Tarapacá (Chile), −20,41, −69,16, 2.702 m | malla polar; Mons Mouton | 0,78 | 0,96 | 1,00 | 0,21 | **nuevo**: no encontrado (2.ª ronda) | cálido (13,4 °C) |
| 10 | Tibesti / Emi Koussi, 19,77, 18,45, 1.996 m | malla polar; Mons Mouton Plateau | 0,77 | 0,95 | 1,00 | 0,18 | conocido (Emi Koussi) | cálido (18,9 °C); 250 mm |

Nuevos más abajo en el top 20, ya revisados:
- No encontrados: sureste de Irán (Golshan, 27,68, 62,60; Mehrestán, 26,59, 61,70), Baluchistán (Awaran,
  Pakistán, 27,14, 65,90), Hoggar oriental (Argelia, 22,86, 8,16) y Tabas (Irán, 32,32, 57,39).
- Ya estudiado: Pampa de Majes (Perú, −16,23, −72,17), a ~54 km de la Pampa de La Joya, publicada como análogo
  de Marte ([NTRS 20160009111](https://ntrs.nasa.gov/api/citations/20160009111/downloads/20160009111.pdf)).

Historias destacadas de la Luna:
- **Changtang** (nuevo).
- **Alta cordillera de San Juan, Argentina** (−29,50, −69,51), gemela del cráter Shackleton a 30 km
  (pendiente típica 14,6° frente a 14,0°): nuevo según una búsqueda breve. Falla en que Shackleton es más profundo.

### Marte

| # | Lugar | Gemelo (10 km; 2 km) | Total | Terreno (T0/T1/T2) | Sup. | Clima | Estado | En qué falla |
|---|---|---|---|---|---|---|---|---|
| 1 | **Meseta de Djado (Níger)**, 22,68, 11,84, 881 m | Spirit/Gusev; HiRISE de Utopia (misma categoría) | 0,84 | 0,97 (0,98/1,00/0,93) | 1,00 | 0,44 | **nuevo**: no encontrado (búsqueda breve, inglés y francés) | cálido (23,7 °C) |
| 2 | Desierto Oriental (Mar Rojo, Egipto), 23,50, 35,06, 456 m | Nili Fossae; HiRISE de Terra Sirenum | 0,84 | 0,97 | 1,00 | 0,42 | **nuevo**: no encontrado | muy cálido (26,9 °C) |
| 3 | Cuenca de Qaidam, 38,14, 91,44, 3.252 m | EZ Jezero; HiRISE de delta invertido | 0,84 | 0,97 (0,96/0,99/0,96) | 1,00 | 0,41 | conocido (validación) | — |
| 4 | Atacama, −23,59, −68,94, 2.436 m | EZ Jezero; delta invertido | 0,83 | 0,97 | 1,00 | 0,39 | conocido | cálido (14,2 °C) |
| 5 | Tibesti / Emi Koussi, 20,59, 17,93, 1.111 m | Nili Fossae | 0,83 | 0,98 | 1,00 | 0,37 | conocido | cálido |
| 6 | Desierto Oriental (Mar Rojo, Egipto), 22,23, 35,74, 446 m | Nili Fossae | 0,83 | 0,97 | 1,00 | 0,38 | **nuevo**: no encontrado | muy cálido (26,1 °C) |
| 7 | Condado de Qiemo (Xinjiang/Tíbet), 35,77, 85,72, 5.367 m | Kasei Valles; delta invertido | 0,83 | 0,97 | 1,00 | 0,37 | **nuevo**: no encontrado | 368 mm de lluvia |
| 8 | Cerca de Arlit (Agadez, Níger), 19,68, 7,55, 492 m | Meridiani; crestas de Diacria | 0,83 | 0,96 | 1,00 | 0,40 | **nuevo**: no encontrado | muy cálido (29,9 °C) |
| 9 | Cuenca de Mouydir (Argelia), 25,95, 4,60, 964 m | Kasei Valles; Western Jezero | 0,82 | 0,97 | 1,00 | 0,33 | no verificado (indicios sin fuente confirmada) | cálido |
| 10 | Sur Lípez (Bolivia), −22,68, −67,55, 4.698 m | Kasei Valles; delta invertido | 0,82 | 0,97 | 1,00 | 0,33 | ya estudiado (High Lakes Project, NASA) | 238 mm de lluvia |

Historias destacadas de Marte:
- **Qaidam** (validación): el método la encuentra sola, a las tres escalas.
- **Meseta de Djado** (nuevo).

**Lo que falla en todos.** La Tierra no reproduce la gravedad (0,17 g y 0,38 g), el vacío lunar, la atmósfera
de CO₂ de Marte ni su radiación. El terreno de los análogos lo modelan el viento, el agua y el hielo; en la Luna,
los impactos. Ningún lugar llega al frío lunar ni al marciano. Y la superficie está saturada (1,00 en casi todo
el top): WorldCover solo dice "desnudo", no qué roca es.

## 3 bis. Luna fuera del polo (añadido después, solo gemelos)

El texto oficial del reto pide análogos de "candidate permanent Moon-base locations", sin limitarse al polo
sur. Por eso se añadieron 13 sitios con coordenadas publicadas por LROC:

- **Coordenadas:** los módulos de Apollo 11, 12, 14, 15, 16 y 17 y de Chang'e 3, 4, 5 y 6 vienen del shapefile
  "Anthropogenic Objects", actualizado en 2025. Los fosos de Marius Hills, Mare Tranquillitatis y Mare Ingenii,
  posibles tragaluces de tubos de lava, vienen del Atlas de fosos.
- **Dato:** SLDEM2015 (LOLA + estéreo Kaguya TC, 59 m, 60°S–60°N; 22,6 GB en el USGS, leído por rangos de
  bytes). No se usa el LOLA global de 118 m porque cerca del ecuador tiene huecos de 1–4 km entre trazas
  rellenados por interpolación. Frente al LOLA en Apollo 11: diferencia media de −0,18 m, correlación 0,9986.
- **Escalas:** 30 km a 400 m (L0) y 3×3 ventanas de 10 km a 120 m (L1). No hay L2: falta un producto con
  resolución real ≤ 60 m comprobada fuera del polo.
- **Solo gemelos:** estos sitios no entran en el ranking ni en la validación del polo sur. Se comprobó que la
  validación y el top 5 final de la Luna quedan idénticos.
- **Coste:** 13 sitios en ~13 min, 24 tiles L1 más (87 MB) y 8 consultas más a Meteomatics.

| Sitio | Mejor gemelo a 30 km | Total | Terreno | Clima | Estado |
|---|---|---|---|---|---|
| Apollo 11 (Mare Tranquillitatis) | 43,87, 101,99 (Gobi, Mongolia) | 0,78 | 0,93 | 0,26 | sin revisar |
| Apollo 12 (Oceanus Procellarum) | 22,50, 14,21 (Sáhara) | 0,71 | 0,74 | 0,37 | sin revisar |
| Apollo 14 (Fra Mauro) | 22,50, 11,88 (Sáhara) | 0,80 | 0,94 | 0,33 | sin revisar |
| Apollo 15 (Hadley–Apeninos) | −21,87, −68,37 (Andes) | 0,78 | 0,91 | 0,32 | sin revisar |
| Apollo 16 (Descartes) | 23,13, 6,62 (Sáhara) | 0,81 | 0,98 | 0,29 | sin revisar |
| Apollo 17 (Taurus–Littrow) | 38,87, 89,55 (Qaidam) | 0,81 | 0,96 | 0,32 | conocido (Qaidam) |
| Chang'e 3 (Mare Imbrium) | 20,87, 32,74 (Sudán) | 0,79 | 0,90 | 0,36 | sin revisar |
| Chang'e 4 (Von Kármán) | 24,87, 22,03 (Libia) | 0,75 | 0,82 | 0,35 | sin revisar |
| Chang'e 5 (Mons Rümker) | 25,13, 5,11 (Argelia) | 0,79 | 0,93 | 0,29 | sin revisar |
| Chang'e 6 (cuenca Apollo) | 25,87, 17,06 (Libia) | 0,82 | 0,96 | 0,37 | sin revisar |
| Foso de Marius Hills | 29,50, 33,38 (Sinaí) | 0,81 | 0,96 | 0,31 | sin revisar |
| Foso de Mare Tranquillitatis | 23,87, 3,68 (Argelia) | 0,81 | 0,96 | 0,34 | sin revisar |
| Foso de Mare Ingenii | 23,50, 44,26 (Arabia) | 0,80 | 0,97 | 0,27 | sin revisar |

**Dónde falla:**
- Los mares lunares son llanuras volcánicas muy planas; sus gemelos son llanuras desérticas cálidas
  (medias de 20–28 °C), parecidas en pendiente pero no en origen ni en temperatura.
- Los fosos miden decenas de metros, así que a 30 y 10 km se compara el terreno que los rodea, no la cueva.
  Para eso harían falta análogos de tubos de lava (Lanzarote, Hawái, Idaho), que este método topográfico no
  detecta a esta escala.
- Los nombres de lugar de la tabla vienen de las coordenadas (país o región), no de un geocodificador
  verificado uno a uno.

## 3 ter. Top 10 de candidatos nuevos y robustez frente a los pesos

El reto pide sobre todo análogos **nuevos**, y en el ranking final quedan arriba los ya conocidos (Puna,
Atacama, Qaidam, Lut). Por eso hay una segunda lista (`fine.final_new`, opción «Solo nuevos» en la app):
- Toma los mejores bloques L2 que no están cerca de un análogo conocido ni constan como ya estudiados en la
  bibliografía.
- Exige terreno^0,6 · superficie^0,4 ≥ 0,6.

**Bibliografía (segunda ronda, 22 candidatos más):**
- Mismo protocolo: un agente por candidato, búsquedas en inglés y en el idioma local, y un verificador
  independiente que abre cada enlace de "ya estudiado".
- Resultado: 15 no encontrados, 2 ya estudiados y confirmados, y 5 no verificados (hay indicios, pero sin
  fuente confirmada).
  - Puna junto al volcán Socompa: Schmidt et al. 2018, doi:10.1007/s10482-018-1066-0.
  - Sur Lípez, Bolivia: High Lakes Project de NASA.
- En total, 38 lugares revisados.

**Robustez:** los pesos 0,5/0,25/0,25 son una elección. Se probaron 42 combinaciones: terreno de 0,35 a 0,7,
superficie de 0,1 a 0,35 y clima el resto (al menos 0,1). Para cada candidato se da el porcentaje de
combinaciones en que sigue en el top 10 de su lista, y su mejor y peor puesto.

### Luna

| # | Lugar (bibliografía) | lat, lon | Gemelo | Total | Terreno (T0/T1/T2) | Clima (media, lluvia) | Bibliografía | Robustez top 10 |
|---|---|---|---|---|---|---|---|---|
| 1 | Departamento Iglesia, provincia de San Juan, Argentina | -28,95, -69,19 | malla polar 84–90°S | 0,80 | 0,96 (0,97/0,97/0,94) | 6,4 °C, 187 mm | no encontrado | 100 % (puesto 1–2) |
| 2 | Condado de Gêrzê | 33,77, 84,39 | malla polar 84–90°S | 0,80 | 0,94 (0,98/0,93/0,90) | -2,2 °C, 333 mm | no encontrado | 100 % (puesto 1–3) |
| 3 | Provincia de El Loa, Región de Antofagasta, Chile | -21,86, -68,94 | malla polar 84–90°S | 0,78 | 0,93 (0,96/0,94/0,88) | 7,5 °C, 68 mm | no encontrado | 100 % (puesto 3–4) |
| 4 | Provincia del Tamarugal, Región de Tarapacá, Chile | -20,41, -69,16 | malla polar 84–90°S | 0,78 | 0,96 (0,98/0,93/0,97) | 13,4 °C, 131 mm | no encontrado | 100 % (puesto 2–6) |
| 5 | Bajsh central del condado de Golshan | 27,68, 62,60 | malla polar 84–90°S | 0,76 | 0,90 (0,94/0,97/0,78) | 25,6 °C, 44 mm | no encontrado | 100 % (puesto 5–6) |
| 6 | Tehsil Jhal Jhao, distrito de Awaran | 27,14, 65,90 | malla polar 84–90°S | 0,76 | 0,90 (0,93/0,98/0,81) | 25,6 °C, 104 mm | no encontrado | 100 % (puesto 5–7) |
| 7 | Dehestán de Ashar, distrito de Ashar, condado de Mehres | 26,59, 61,70 | malla polar 84–90°S | 0,75 | 0,87 (0,93/0,95/0,75) | 24,5 °C, 63 mm | no encontrado | 100 % (puesto 7–9) |
| 8 | Hoggar oriental | 22,86, 8,16 | malla polar 84–90°S | 0,74 | 0,83 (0,97/0,92/0,64) | 25,2 °C, 7 mm | no encontrado | 100 % (puesto 4–8) |
| 9 | Dehestán Kavir, distrito de Dehuk | 32,32, 57,39 | malla polar 84–90°S | 0,71 | 0,79 (0,94/0,95/0,56) | 22,3 °C, 76 mm | no encontrado | 88 % (puesto 9–11) |
| 10 | — | 34,41, 82,72 | malla polar 84–90°S | 0,68 | 0,72 (0,55/0,81/0,84) | -6,5 °C, 328 mm | sin revisar | 55 % (puesto 8–11) |

### Marte

| # | Lugar (bibliografía) | lat, lon | Gemelo | Total | Terreno (T0/T1/T2) | Clima (media, lluvia) | Bibliografía | Robustez top 10 |
|---|---|---|---|---|---|---|---|---|
| 1 | Daïra de In Guezzam, Provincia de Tamanrasset, Argelia | 20,14, 6,16 | Arcadia Planitia (cráter con hielo) | 0,85 | 0,95 (0,95/0,94/0,96) | 29,5 °C, 2 mm | no encontrado | 100 % (puesto 1–6) |
| 2 | Meseta de Djado, departamento de Bilma, Níger | 22,68, 11,84 | Spirit (cráter Gusev) | 0,84 | 0,97 (0,98/1,00/0,93) | 23,7 °C, 4 mm | no encontrado | 100 % (puesto 1–2) |
| 3 | Gobernación del Mar Rojo | 23,50, 35,06 | Nili Fossae: llanuras con carbonatos | 0,84 | 0,97 (0,95/0,97/0,98) | 26,9 °C, 5 mm | no encontrado | 100 % (puesto 2–3) |
| 4 | Gobernación del Mar Rojo | 22,23, 35,74 | Nili Fossae: llanuras con carbonatos | 0,83 | 0,97 (0,98/0,95/0,98) | 26,1 °C, 12 mm | no encontrado | 100 % (puesto 3–7) |
| 5 | Condado de Qiemo | 35,77, 85,72 | Kasei Valles (isla aerodinámica) | 0,83 | 0,97 (0,95/0,99/0,97) | -10,3 °C, 368 mm | no encontrado | 100 % (puesto 3–8) |
| 6 | Cerca de Arlit, región de Agadez, Níger | 19,68, 7,55 | Opportunity (Meridiani Planum) | 0,83 | 0,96 (0,98/0,94/0,96) | 29,9 °C, 18 mm | no encontrado | 100 % (puesto 5–7) |
| 7 | Provincia de Tamanrasset | 23,77, 4,06 | EZ Hebrus Valles | 0,83 | 0,94 (0,96/0,98/0,87) | 27,7 °C, 6 mm | no encontrado | 86 % (puesto 4–17) |
| 8 | Cuenca de Mouydir | 25,95, 4,60 | Kasei Valles (isla aerodinámica) | 0,82 | 0,97 (0,96/0,98/0,99) | 25,8 °C, 38 mm | no verificado | 100 % (puesto 5–10) |
| 9 | Daïra de Tazrouk, wilaya de Tamanrasset, Argelia | 23,14, 7,45 | EZ cráter Columbus (Terra Sirenum) | 0,82 | 0,92 (0,92/0,90/0,95) | 26,0 °C, 6 mm | no encontrado | 60 % (puesto 5–20) |
| 10 | — | 29,32, 37,19 | Spirit (cráter Gusev) | 0,81 | 0,95 (0,98/0,96/0,92) | 20,4 °C, 19 mm | sin revisar | 57 % (puesto 9–16) |


Los 9 primeros nuevos de la Luna y los 9 primeros de Marte tienen revisión bibliográfica, y casi todos siguen
en el top 10 con cualquier combinación de pesos. En los nuevos de Marte el fallo es siempre el mismo: son
desiertos cálidos (medias de 20–30 °C). El terreno y la sequedad se parecen; el frío no.

## 4. Validación (12 análogos fijados antes de ver resultados)

Percentil global de la mejor ventana a menos de 50 km de cada análogo.

- **L0 antes:** referencias v1 con el método v1.
- **L0 después:** referencias v2.
- **L1 justo:** a 10 km, comparando con la mejor ventana a menos de 50 km de cada punto de control. Comparar con
  ventanas sueltas lo inflaba: había ~75 ventanas en 50 km.

| Análogo | Luna antes | Luna después | Luna L1 | Marte antes | Marte después | Marte L1 |
|---|---|---|---|---|---|---|
| Atacama (Yungay) | 100,0 | 100,0 | 100,0 | 99,8 | 99,7 | 99,5 |
| Haughton | 92,0 | 94,7 | 93,0 | 90,7 | 98,2 | 94,6 |
| Valle de la Muerte | 99,5 | 100,0 | 99,9 | 91,3 | 100,0 | 99,2 |
| Valles Secos de McMurdo | 99,1 | 97,8 | 94,0 | 85,7 | 97,5 | 90,5 |
| Askja | 95,9 | 97,9 | 96,4 | 98,9 | 98,9 | 94,6 |
| Mauna Kea | 96,4 | 94,8 | 96,2 | 83,5 | 90,5 | 89,0 |
| Bockfjorden | 99,3 | 98,1 | 92,4 | 81,1 | 97,5 | 91,6 |
| MDRS | 98,4 | 99,0 | 99,1 | 96,7 | 99,5 | 96,7 |
| Meteor Crater | 81,0 | 77,7 | 93,4 | 91,8 | 86,3 | 90,3 |
| Río Tinto | 83,5 | 78,7 | 72,5 | 63,6 | 66,5 | 59,0 |
| Pilbara | 78,8 | 85,1 | 76,0 | 71,5 | 76,5 | 70,7 |
| Lanzarote | sin ventana | sin ventana | sin ventana | sin ventana | sin ventana | sin ventana |
| **Media (11)** | **93,1** | **93,1** | | **86,8** | **91,9** | |

Ningún análogo baja más de 10 percentiles en L0. Mayor bajada: Río Tinto en la Luna (−4,8).

En la primera ejecución v2, Pilbara en Marte bajaba 12,4. La causa eran los sitios "solo MOLA" (lisura
artificial). Excluirlos lo corrigió (+5,0) y subió la media de Marte de 86,8 a 91,9.

Río Tinto es el más bajo en las tres medidas porque es un análogo mineralógico (aguas ácidas, jarosita), no
topográfico: este método no mide minerales.

Lanzarote no tiene ventana de tierra de 30 km a menos de 50 km (es una isla), así que no puntúa en L0 ni en el
terreno multiescala.

Rasgos de forma (curvatura, depresiones cerradas, integral hipsométrica): se calcularon igual en los tres cuerpos
y se probaron en L1. No se adoptan: con el percentil justo, en la Luna la media no mejora (92,1 frente a 92,0) y
un análogo baja 10,9; en Marte la media baja (88,7 a 88,0) y un análogo baja 13,0.

## 5. Consultas a Meteomatics, tiempos y descarga

- **Meteomatics:** 32 consultas en total, de un presupuesto de 300: 24 para la v2 (238 puntos nuevos en lotes de
  10) y 8 para los gemelos de la Luna fuera del polo (71 puntos). La caché pasa de 247 a 556 puntos. Solo se pidió clima para los finalistas; todo lo demás, con `--no-climate`.

| Paso | Tiempo | Descarga |
|---|---|---|
| Fase de investigación y medición (5 agentes en paralelo) | 44 min | ~2,7 GB (incluye 2,1 GB de MOLA bajados por error en una prueba; no se guardaron) |
| Caché lunar (LDEM 40 m + EFFRES) | ~27 min (PGDA sirve a ~0,7 MB/s) | 1,72 GB |
| Referencias v2 (1.899 ventanas) | 24 min | < 0,2 GB (Marte por rangos de bytes, 15 MB de recortes) |
| L1: 1.856 tiles GLO-90 + WorldCover (154.363 ventanas) | 32 min | 7,4 GB de GLO-90 + WorldCover (caché en disco de 735 MB; descarga no medida) |
| L2: 270 bloques GLO-30 | ~6 min | 3,2 GB (1,9 GB de ellos, repeticiones por un fallo de identificadores ya corregido) |
| Imágenes de relieve (698) | 4 min | ~1–2 GB (no medido) |
| Ranking (L0 + L1 + L2) | ~1 min | — |
| **Total** | ~2,5 h de cálculo | **~17 GB** |

## 6. Qué no se pudo verificar y siguientes pasos

No verificado:
- **Bibliografía:** se revisaron 38 lugares en dos rondas, con verificación independiente de cada "ya
  estudiado". Los 9 primeros nuevos de cada cuerpo están revisados. Quedan como "no verificado" 5 lugares
  con indicios sin fuente confirmada (entre ellos Mouydir y varios gemelos de la Luna fuera del polo), y como
  "sin revisar" los que están más abajo en las listas. En los Andes de San Juan, un punto vecino del mismo
  departamento (−28,95, −69,19, a ~70 km) se revisó a fondo en la segunda ronda (11 búsquedas): no
  encontrado. Djado mantiene la búsqueda breve (3 consultas).
- **Coordenadas:** las longitudes de Nobile Rim 1, Mons Mouton, de Gerlache Rim 2 y Slater Plain; los polígonos
  oficiales de las regiones (ScienceBase bloqueado). Los resúmenes del taller de 2015 no dicen si la latitud es
  planetocéntrica o planetográfica (diferencia de hasta ~0,3°, ~18 km).
- **Unidades de la capa EFFRES:** no están declaradas. Se suponen metros (rango 2,6–1.035).
- **Clasificación HRSC/solo MOLA:** es una heurística calibrada con 8 puntos. Hay casos dudosos en terreno
  empinado (Coprates, Hale, Tooting).
- **Sesgo de borde en L1:** el percentil "justo" tiene un sesgo de borde pequeño (puntos de control junto al
  borde de su tile).
- **Comparación L2 de Marte:** casi siempre es contra parches HiRISE de la misma categoría (109 de 116 parches
  no están a menos de 100 km de un sitio de referencia), no del mismo lugar.
- **Visor 3D:** sigue remuestreando GLO-30 a 20 m (más fino que el dato). No se tocó.

Siguientes pasos:
1. Terminar la revisión bibliográfica de los 15 candidatos pendientes (después del 15/11 a las 07:00).
2. Luna fuera del polo: hecho para 13 sitios (sección 3 bis). Faltan el polo norte (SLDEM2015 llega solo a
   60°N) y la revisión bibliográfica de sus gemelos.
3. Separar superficie por mineralogía (EMIT, frente a CRISM en Marte), porque la superficie está saturada.
4. Iluminación y sombra a partir del DEM para las crestas del polo sur.
5. Polígonos oficiales de Artemis III cuando se puedan descargar.
