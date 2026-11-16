// Idioma (es/en) compartido por las dos páginas.
// El idioma inicial lo fija el script en línea del <head> de cada HTML (localStorage → idioma del navegador).
import { DATOS_EN } from "./i18n.datos.en";
import { DATOS_ES } from "./i18n.datos.es";
import { NOMBRES_ID } from "./i18n.datos.ids";

export type Lang = "es" | "en";
export const LANG_KEY = "analogs-lang";

type Params = Record<string, string | number>;

const messages: Record<Lang, Record<string, string>> = {
  es: {
    "site.title": "GeoTwin",
    "nav.label": "Vistas",
    "nav.viewer": "Visor 3D de Marte",
    "nav.map": "Mapa Luna y Marte",
    "nav.globes": "Globos 3D",
    "nav.sources": "Fuentes de datos",
    "prefs.label": "Preferencias",
    "prefs.lang": "Idioma",
    "prefs.toLight": "Cambiar a tema claro",
    "prefs.toDark": "Cambiar a tema oscuro",
    "sources.title": "Fuentes de datos",
    "sources.ai": "Hecho con ayuda de IA: el código, los textos y las historias destacadas se escribieron con asistentes de IA (Claude, de Anthropic) y se revisaron a mano. Las puntuaciones no las da una IA: las calcula código determinista a partir de los datos abiertos de esta lista.",
    "planet.mars": "Marte",
    "planet.earth": "Tierra",
    "planet.moon": "Luna",

    // Globos 3D (globos.html, globos.ts)
    "gl.docTitle": "GeoTwin · Globos 3D",
    "path.title": "Planificador de rutas",
    "path.docTitle": "GeoTwin · Planificador de rutas",
    "path.stage": "Rutas en los globos de Marte y la Tierra",
    "path.draw": "Dibujar ruta",
    "path.upload": "Subir ruta",
    "path.example": "Probar una ruta en Jezero",
    "path.exampleName": "Ruta de Jezero",
    "path.undo": "Deshacer punto",
    "path.fit": "Encuadrar rutas",
    "path.clear": "Borrar ruta",
    "path.search": "Buscar rutas en la Tierra",
    "path.cancel": "Cancelar búsqueda",
    "path.comparison": "Comparación de rutas",
    "path.help": "Marca puntos en Marte. Arrastra para mover la vista.",
    "path.keyboard": "Usa las flechas para mover el centro de la vista, más y menos para cambiar el zoom y Enter para agregar un punto.",
    "path.marsMap": "Globo de Marte. Pulsa Enter para agregar un punto en el centro.",
    "path.zoomIn": "Acercar Marte",
    "path.zoomOut": "Alejar Marte",
    "path.reset.mars": "Restablecer vista de Marte",
    "path.reset.earth": "Restablecer vista de la Tierra",
    "path.distance": "{distance} km",
    "path.distancePreview": "Vista previa · {distance} km",
    "path.range.empty": "Rango permitido · {min}–{max} km",
    "path.range.short": "Por debajo del mínimo · {min}–{max} km",
    "path.range.ready": "Dentro del rango · {min}–{max} km",
    "path.range.long": "Por encima del máximo · {min}–{max} km",
    "path.waypoint": "1 punto",
    "path.waypoints": "{n} puntos",
    "path.importing": "Abriendo ruta…",
    "path.searching": "Buscando rutas en la Tierra… {percent}",
    "path.drawUnavailable": "El globo no está disponible. Sube un archivo de ruta o prueba la ruta de Jezero.",
    "path.error.unsupported-format": "Sube un archivo GeoJSON, GPX o KML.",
    "path.error.file-too-large": "El archivo supera los 10 MB. Exporta una ruta más pequeña.",
    "path.error.malformed-file": "No se pudo leer el archivo. Vuelve a exportar la ruta.",
    "path.error.no-route": "El archivo no contiene una ruta. Exporta una línea con dos o más puntos.",
    "path.error.multiple-routes": "El archivo contiene rutas separadas. Exporta una sola ruta continua.",
    "path.error.invalid-coordinate": "Hay coordenadas no válidas en la ruta. Comprueba la latitud y la longitud.",
    "path.error.too-many-points": "La ruta supera los 20.000 puntos. Simplifica el trazado y vuelve a subirlo.",
    "path.error.route-too-short": "Agrega al menos dos puntos distintos a la ruta.",
    "path.error.coverage": "Faltan datos de elevación para esta ruta de Marte. Prueba Jezero o ajusta la ruta.",
    "path.error.earthData": "No se pudo consultar el catálogo de terrenos terrestres. Intenta buscar de nuevo.",
    "path.error.noMatch": "Ninguna ruta terrestre del catálogo encaja con este trazado. Prueba ajustar la ruta.",
    "path.error.distance": "La ruta debe medir entre {min} y {max} km. Ajusta el trazado e inténtalo de nuevo.",
    "path.error.route": "No se pudo analizar la ruta. Comprueba sus puntos e inténtalo de nuevo.",
    "gl.modeLabel": "Puntos que se muestran",
    "gl.best": "Mejores",
    "gl.all": "Todos",
    "gl.count": "{n} puntos visibles",
    "gl.legend": "Leyenda",
    "gl.refPicker": "Sitio de la Luna o de Marte",
    "gl.goto": "Ir a un punto",
    "gl.allSites": "Todos los sitios",
    "gl.choosePoint": "Elige un punto…",
    "gl.group": "{body} ({n})",
    "gl.stageLabel": "Globos de la Luna, la Tierra y Marte",
    "gl.radius.moon": "radio 1.737 km",
    "gl.radius.earth": "radio 6.371 km",
    "gl.radius.mars": "radio 3.390 km",
    "gl.reset": "Restablecer vista",
    "gl.error": "Los globos 3D no están disponibles en este navegador. Usa los desplegables de arriba para consultar los puntos.",
    "gl.detailLabel": "Detalle del punto",
    "gl.close": "Cerrar detalle",
    "gl.howto": "Arrastra un globo para girarlo; usa la rueda o pellizca con dos dedos para acercar. Los globos se dibujan del mismo tamaño: el radio real va en la etiqueta de cada uno.",
    "gl.window": "Ventana de 30 km · {coord}",
    "gl.refKicker": "{body} · sitio de referencia",
    "gl.refRole.moon": "Referencia de la Luna",
    "gl.refRole.mars": "Referencia de Marte",
    "gl.twinsTitle": "Gemelos en la Tierra",
    "gl.analogOf.moon": "Análogo de la Luna",
    "gl.analogOf.mars": "Análogo de Marte",
    "gl.closestTo": "Más parecido a",
    "gl.total": "Puntuación total",
    "gl.terrain": "Terreno",
    "gl.surface": "Superficie",
    "gl.assumed": " (supuesta)",
    "gl.climate": "Clima",
    "gl.climateTitle": "Clima (2025)",
    "gl.tMean": "Temperatura media",
    "gl.tMin": "Mínima del año",
    "gl.tMax": "Máxima del año",
    "gl.diurnal": "Oscilación diaria",
    "gl.precip": "Lluvia anual",
    "gl.role.site.moon": "N.º {rank} del ranking de la Luna",
    "gl.role.site.mars": "N.º {rank} del ranking de Marte",
    "gl.role.twin": "Gemelo n.º {rank} de {ref}",
    "gl.role.featured": "Historia destacada · {tag}",
    "gl.role.validation.moon": "Análogo conocido de la Luna · percentil {p}",
    "gl.role.validation.mars": "Análogo conocido de Marte · percentil {p}",
    "gl.role.curated": "Catálogo del visor de Marte · sitio elegido a mano (USGS 3DEP)",
    "gl.role.global": "Catálogo del visor de Marte · escaneo mundial",
    "gl.nasaComparisons": "Análogos de NASA",
    "gl.nasaPairLink": "Ver comparación",
    "gl.patchKicker": "Marte · parche HiRISE del catálogo",
    "gl.terrainTitle": "Terreno",
    "gl.medianSlope": "Pendiente mediana",
    "gl.steepSlope": "Pendiente del percentil 90",
    "gl.relief": "Desnivel (percentiles 5–95)",
    "gl.medianElev": "Elevación mediana",
    "gl.source": "Fuente",
    "gl.heatKicker.moon": "Tierra · celda del mapa de calor de la Luna",
    "gl.heatKicker.mars": "Tierra · celda del mapa de calor de Marte",
    "gl.heatNote": "Las celdas del mapa de calor solo tienen la puntuación total.",
    "gl.lg.ref": "Sitio de referencia",
    "gl.lg.featured": "Historia destacada",
    "gl.lg.site": "Top 20 o gemelo · {moon} {moonMin}+ · {mars} {marsMin}+",
    "gl.lg.validation": "Análogo conocido",
    "gl.lg.catalog": "Catálogo (Tierra) · parche HiRISE (Marte)",
    "gl.lg.heat": "Mapa de calor (más claro = más parecido)",
    "gl.src.moonSldem": "Luna fuera del polo · SLDEM2015 (LOLA + Kaguya TC, 59 m)",
    "gl.src.moonRefs": "Referencias del polo sur de la Luna · LOLA LDEM_80S_40MPP_ADJ, 40 m (NASA PGDA, Barker et al. 2023)",
    "gl.src.marsRefs": "Referencias de Marte · HRSC + MOLA 200 m (USGS)",
    "gl.src.hirise": "Parches de Marte · catálogo HiRISE (USGS)",
    "gl.src.copernicus": "Tierra · Copernicus DEM GLO-90",
    "gl.src.worldcover": "Tierra · ESA WorldCover 2021",
    "gl.src.climate": "Clima 2025 · Meteomatics (ERA5)",
    "gl.src.earthImage": "Imagen de la Tierra · NASA Blue Marble",
    "gl.src.marsImage": "Imagen de Marte · Viking MDIM 2.1",
    "gl.src.moonImage": "Imagen de la Luna · CGI Moon Kit, NASA's Scientific Visualization Studio (LRO LROC)",
    "gl.src.moonPole": "Polo sur de la Luna · relieve sombreado del DEM LRO LOLA 118 m (USGS), hasta 78°S",
    "gl.src.earthTiles": "Tierra de cerca · Esri World Imagery (Esri, Vantor, Earthstar Geographics y la comunidad de usuarios de SIG)",
    "gl.src.moonTiles": "Luna de cerca · mosaico LRO WAC de 100 m (NASA/GSFC/Arizona State University), vía NASA Moon Trek",
    "gl.src.marsTiles": "Marte de cerca · Viking MDIM 2.1 vía NASA Mars Trek y mosaico CTX beta01 (NASA/JPL/MSSS/Caltech Murray Lab/Esri)",

    // Visor 3D (index.html, main.ts)
    "v.docTitle": "GeoTwin · Visor 3D",
    "v.globesLabel": "Globos de los planetas",
    "v.marsPicker": "Sitio de terreno de Marte",
    "v.find": "Buscar análogos",
    "v.globesCanvas": "Globos de Marte y la Tierra. Arrastra Marte para girarlo.",
    "v.globeError": "Los globos no están disponibles. Elige un sitio de Marte arriba para comparar el terreno.",
    "v.matchesTitle": "Análogos en la Tierra",
    "v.compareLink": "Comparar terreno",
    "v.matchListLabel": "Sitios de la Tierra ordenados por terreno, superficie y clima",
    "v.comparisonLabel": "Comparación de terreno",
    "v.colorLabel": "Color del terreno",
    "v.relief": "Relieve",
    "v.slope": "Pendiente",
    "v.cameraLabel": "Cámara compartida",
    "v.topView": "Vista cenital",
    "v.resetView": "Restablecer vista",
    "v.terrainCanvas": "Vistas de terreno sincronizadas. Arrastra o usa las flechas para girar los dos terrenos. Usa la rueda o más y menos para acercar.",
    "v.legendLabel": "Pendiente en grados",
    "v.metricsTitle": "Medidas del terreno",
    "v.measure": "Medida",
    "v.method.summary": "Cómo se puntúan los análogos",
    "v.method.p1": "Los candidatos terrestres vienen de dos conjuntos: sitios de EE. UU. elegidos a mano (USGS 3DEP), que solo compiten dentro de la categoría de terreno del sitio de Marte, y parches de 2 × 2 km de un escaneo mundial de suelo desnudo o helado (Copernicus DEM GLO-30), que compiten solo por sus medidas.",
    "v.method.p2": "<strong>Terreno (50 %)</strong> es 1 menos la distancia de terreno: para la pendiente mediana, la pendiente del percentil 90 y el desnivel, se divide la diferencia absoluta entre la suma de los dos valores y se promedian las tres. <strong>Superficie (25 %)</strong> es la fracción de roca o arena desnuda del parche (ESA WorldCover); para los sitios polares de Marte cuentan más la nieve y el hielo. <strong>Clima (25 %)</strong> premia los lugares fríos, secos y con gran oscilación térmica diaria, a partir de un año de datos de Meteomatics. Ningún lugar de la Tierra llega a las condiciones de Marte, así que mide cercanía relativa.",
    "v.method.p3": "La puntuación compara topografía, cobertura del suelo y clima. No estima la equivalencia geológica ni la idoneidad para una misión.",
    "v.gridScale": "{w} × {w} km · celdas de {c} m · escala vertical real",
    "v.viewerError": "No se pudo cargar la vista 3D. Las medidas del terreno están más abajo.",
    "v.loading": "Cargando terreno…",
    "v.loadError": "No se pudieron cargar estos terrenos. Vuelve a elegir el candidato para reintentar.",
    "v.origin.curated": "Curado · USGS 3DEP",
    "v.origin.near": "Escaneo mundial · cerca de {name}",
    "v.origin.new": "Escaneo mundial · candidato nuevo",
    "v.group.surface": "Superficie · ESA WorldCover (Marte: sin vegetación)",
    "v.bare": "Roca o arena desnuda",
    "v.dustRock": "polvo y roca",
    "v.snowIce": "Nieve o hielo",
    "v.iceRich": "suelo rico en hielo",
    "v.vegetation": "Vegetación",
    "v.assumed": " (supuesto)",
    "v.group.climate": "Clima · Meteomatics 2025 (Marte: valores típicos)",
    "v.tMean": "Temperatura media",
    "v.diurnal": "Oscilación térmica diaria",
    "v.precip": "Precipitación anual",
    "v.group.score": "Puntuación",
    "v.terrainSim": "Parecido del terreno · {p}",
    "v.surfaceW": "Superficie · {p}",
    "v.climateW": "Clima · {p}",
    "v.total": "Total",
    "v.bestOf": "Mejor de {n} · ",
    "v.score": "Puntuación {v}",
    "v.bar.terrain": "Terreno",
    "v.bar.surface": "Cobertura",
    "v.bar.climate": "Clima",
    "v.siteCount": "{n} sitios",
    "metric.medianSlope": "Pendiente mediana",
    "metric.steepSlope": "Pendiente del percentil 90",
    "metric.relief": "Desnivel (percentiles 5–95)",
    "cat.Valleys & fans": "Valles y abanicos",
    "cat.Impact terrain": "Terreno de impacto",
    "cat.Ridges & layered terrain": "Crestas y terreno estratificado",
    "cat.Volcanic terrain": "Terreno volcánico",
    "cat.Dunes": "Dunas",
    "cat.Ice & polar terrain": "Hielo y terreno polar",
    "src.marsElev": "Elevación de Marte · catálogo HiRISE (USGS)",
    "src.earth3dep": "Elevación de la Tierra · USGS 3DEP",
    "src.earthGlo30": "Elevación de la Tierra · Copernicus DEM GLO-30",
    "src.cover": "Cobertura del suelo · ESA WorldCover 2021",
    "src.climate": "Clima de la Tierra (2025) · Meteomatics",
    "src.marsImg": "Imagen de Marte · Viking MDIM 2.1",
    "src.earthImg": "Imagen de la Tierra · NASA Blue Marble",

    // Mapa Luna/Marte (luna-marte.html, lunaMarte.ts)
    "lm.docTitle": "GeoTwin · Mapa de la Luna y Marte",
    "lm.layoutLabel": "Análogos de la Luna y Marte en toda la Tierra",
    "lm.tabsLabel": "Cuerpo de referencia",
    "lm.tabMoon": "Luna",
    "lm.tabMars": "Marte",
    "lm.featured": "Historias destacadas",
    "lm.twins": "Gemelos terrestres de cada sitio",
    "lm.ranking": "Ranking general",
    "lm.validation": "Validación con análogos conocidos",
    "lm.nasa": "Análogos de NASA",
    "lm.nasaTerrainWindow": "Terreno de {km} × {km} km · celdas de {m} m",
    "lm.nasaMetric": "Medida",
    "lm.nasaTerrainScore": "Similitud del terreno: {score}/100.",
    "lm.nasaMaxScore": "En Salda se midieron solo celdas de tierra firme. La puntuación total puede alcanzar {max}/100 frente al {best}/100 del mejor candidato medido en Jezero.",
    "lm.nasaRankScore": "Puntuación total {score}/100 · puesto {rank} · mejor resultado {best}/100.",
    "lm.nasaViewer": "Comparar en el visor 3D",
    "lm.validationNote": "Percentil global (entre todas las ventanas de 30 km de tierra firme) del mejor punto a menos de 50 km de cada análogo ya conocido. Cuanto más alto, mejor detecta el método los lugares que la ciencia ya usa.",
    "lm.mapLabel": "Mapa de la Tierra con los candidatos",
    "lm.src.moon": "Luna · LOLA LDEM_80S_40MPP_ADJ, 40 m (NASA PGDA, Barker et al. 2023)",
    "lm.src.mars": "Marte a 30 y 10 km · HRSC + MOLA blend v2, 200 m (USGS)",
    "lm.src.glo90": "Tierra a 30 y 10 km · Copernicus DEM GLO-90",
    "lm.src.cover": "Tierra · ESA WorldCover 2021",
    "lm.src.climate": "Clima 2025 · Meteomatics (ERA5)",
    "lm.src.earthImg": "Imagen de la Tierra · Esri World Imagery",
    "lm.src.marsImg": "Imagen de Marte · mosaico CTX (Caltech Murray Lab, vía Esri)",
    "lm.attribution": "Imágenes © Esri, Maxar, Earthstar Geographics",
    "lm.legend": "<b>Puntos tenues</b>: el 3 % de la Tierra más parecido (terreno × superficie).<br><b>Números</b>: mejores candidatos tras sumar el clima. <b>★</b>: historias destacadas.",
    "lm.pill.known": "conocido",
    "lm.pill.new": "nuevo",
    "lm.pill.val": "validación",
    "lm.rankTitle": "Ranking n.º {n}",
    "lm.similarTo": "parecido a {name}",
    "lm.noStudies": "sin estudios como análogo encontrados",
    "lm.twinTitle": "Gemelo n.º {k} de {name}",
    "lm.cardNote": "Puntuación {s} · terreno {t}",
    "lm.knownAnalog": "Análogo conocido",
    "lm.percentile": "Percentil",
    "lm.ok.terrain": "Terreno muy parecido a <b>{name}</b> ({v}/100).",
    "lm.no.terrain": "El terreno se parece solo moderadamente a {name} ({v}/100).",
    "lm.cover": "{bare} % roca o arena desnuda y {ice} % hielo o nieve (ESA WorldCover).",
    "lm.noCover": "Sin datos de cobertura (Antártida): se supone hielo o roca.",
    "lm.temp": "Temperatura media {m} °C (mínima {min} °C).",
    "lm.rain": "Lluvia {v} mm/año.",
    "lm.swing": "Oscilación térmica diaria {v} °C.",
    "lm.altitude": "altitud media {v} m",
    "lm.nearKnown": "cerca de un análogo conocido: {name}",
    "lm.notStudied": "no hemos encontrado estudios que lo usen como análogo",
    "lm.bar.total": "Total",
    "lm.bar.terrain": "Terreno · 50 %",
    "lm.bar.surface": "Superficie · 25 %",
    "lm.bar.climate": "Clima · 25 %",
    "lm.cmpLabel": "Comparación lado a lado",
    "lm.cmpRelief": "Relieve · misma escala",
    "lm.cmpReal": "Imagen real",
    "lm.scale": "10 km · cada recuadro mide 30 × 30 km",
    "lm.terrainWindow": "Terreno (ventana de 30 km)",
    "lm.here": "Aquí",
    "lm.breaks": "Dónde se rompe la analogía",
    "lm.altEarth": "Relieve sombreado del sitio terrestre",
    "lm.altRef": "Relieve sombreado de {name}",
    "lm.noImage": "Todavía no hay imagen de relieve de este lugar.",
    "lm.noMoonMosaic": "No hay un mosaico de fotos del polo sur lunar que se pueda usar en un mapa web: los mapas planos lo deforman y gran parte está en sombra permanente. Usa la vista de relieve (LRO LOLA).",

    // Mapa Luna/Marte · v2 (referencias, multiescala, bibliografía)
    "lm.introFine": " Los mejores se vuelven a medir más de cerca: {l1} ventanas de 10 km y {l2} de 5 km (Luna) o 2 km (Marte).",
    "lm.refs": "Referencias",
    "lm.refsSummary": "{n0} referencias a 30 km, {n1} a 10 km y {n2} a {k2} km.",
    "lm.refsUnusable": " {u} no puntúan (ver calidad).",
    "lm.refsOutside": "{n} sitios fuera del polo (Apollo, Chang'e y fosos de posibles tubos de lava, con el DEM SLDEM2015 de 59 m) no caben en este mapa: están en «Gemelos terrestres por grupo». Sus comparaciones se muestran por sitio, aparte del ranking y de la validación del polo sur.",
    "lm.refsGroup": "Grupo",
    "lm.refsMapLabel.moon": "Minimapa del polo sur de la Luna (de 80°S al polo) con las referencias",
    "lm.refsMapLabel.mars": "Minimapa de Marte con los sitios de referencia",
    "lm.refPick": "Referencia o grupo",
    "lm.refPickHint": "Pulsa un punto del minimapa o elige en la lista.",
    "lm.refPickNone": "Elige una referencia…",
    "lm.refPickGroups": "Grupos de gemelos",
    "lm.refPickRefs": "Referencias a 30 km",
    "lm.lg.l1": "Ventanas de 10 km y 5 km (L1, L2)",
    "lm.lg.l1mars": "Ventanas de 10 km (L1) y parches HiRISE de 2 km (L2)",
    "lm.lg.usable": "Sitio que puntúa (HRSC)",
    "lm.lg.mola": "Puntúa a 30 km, solo MOLA (sin 10 km)",
    "lm.lg.unusable": "Solo MOLA, no puntúa",
    "lm.lg.selected": "Seleccionado",
    "lm.ring": "{lat}°S",
    "lm.groupOf": "Grupo de gemelos: {name}",
    "lm.refCounts": "{n0} a 30 km · {n1} a 10 km · {n2} a {k2} km",
    "lm.gridPoints": "Puntos generados en una malla regular de 84–90°S, no son sitios publicados.",
    "lm.quality": "Calidad",
    "lm.coordQuality": "Coordenada",
    "lm.source": "Fuente",
    "lm.sourceLink": "Abrir la fuente",
    "lm.sourceNote": "Nota de la fuente",
    "lm.noSource": "Sin enlace: punto generado por el método.",
    "lm.q.effres": "Resolución efectiva LOLA (EFFRES): mediana {p50} m, p90 {p90} m.",
    "lm.q.hrsc": "Cubierto por HRSC (R400 = {r}, fracción MOLA {m}).",
    "lm.q.mola": "Solo MOLA (463 m o peor; R400 = {r}, fracción MOLA {m}).",
    "lm.q.unusable": "No puntúa.",
    "lm.q.none": "Sin medida de calidad.",
    "lm.refTwins": "Sus gemelos terrestres",
    "lm.twins30": "A 30 km",
    "lm.twins10": "A 10 km",
    "lm.noTwins": "Sin gemelos en los datos.",
    "lm.showRef": "Ver la ficha de la referencia",
    "lm.bestTwin": "mejor gemelo",
    "lm.twinsGroups": "Gemelos terrestres por grupo",
    "lm.twinsHint": "Ordenados por la puntuación de su mejor gemelo. Ábrelos para ver los gemelos a 30 km y a 10 km.",
    "lm.rankMode": "Tipo de ranking",
    "lm.rankFinal": "Final multiescala (30 km → 10 km → 5/2 km)",
    "lm.rankL0": "A 30 km",
    "lm.rankNew": "Solo nuevos",
    "lm.robust": "Robustez: sigue en el top 10 de su lista en el {p} % de {n} combinaciones de pesos (terreno 0,35–0,7; superficie 0,1–0,35; clima, el resto); puesto entre {a} y {b}.",
    "lm.newTitle": "Nuevo n.º {n}",
    "lm.newNote": "Solo candidatos lejos de los análogos conocidos y sin estudios encontrados: lo que el reto pide descubrir. «Sin revisar» = bibliografía pendiente.",
    "lm.finalTitle": "Final n.º {n}",
    "lm.pinGroup": "Puestos {list}: acerca el mapa para verlos por separado",
    "lm.levelsShort": "terreno 30/10/{k} km: {a} · {b} · {c}",
    "lm.terrainLevels": "Terreno por escala",
    "lm.levelBar": "{km} km ({lv})",
    "lm.cmpLevel": "Escala de la comparación",
    "lm.cmpWindow": "Ventana {w} km · píxel {p} m",
    "lm.cmpImgPx": " (imagen a {p} m)",
    "lm.cmpData": "Datos: Tierra, {earth}; {body}, {ref}.",
    "lm.scaleKm": "{bar} · cada recuadro mide {w} × {w} km",
    "lm.terrainWindowKm": "Terreno (ventana de {km} km)",
    "lm.noRefFeatures": "Los datos no incluyen los rasgos de la referencia a esta escala.",
    "lm.tileOf": "ventana de {km} km",
    "lm.hirisePatch": "Parche HiRISE {id}",
    "lm.scope": "Comparado a {km} km con: {s}.",
    "lm.scope.all": "todas las referencias de esa escala",
    "lm.scope.cat": "los parches HiRISE de la categoría «{c}»",
    "lm.scope.region": "las teselas de {name}",
    "lm.lit": "Bibliografía",
    "lm.lit.known": "Ya estudiado como análogo",
    "lm.lit.none": "No encontramos estudios que lo usen como análogo",
    "lm.lit.unverified": "No verificado: no hemos revisado la bibliografía de este lugar.",
    "lm.lit.link": "Ver el estudio",
    "lm.lit.km": "a {km} km",
    "lm.pill.studied": "estudiado",
    "lm.pill.unreviewed": "sin revisar",
    "lm.notReviewed": "bibliografía sin revisar para este lugar",
    "lm.before": "Antes (v1)",
    "lm.after": "Después (v2)",
    "lm.fine": "Escala fina (10 km)",
    "lm.noWindow": "sin ventana a <50 km",
    "lm.validationNoteV2": "Percentil global del mejor punto a menos de 50 km de cada análogo ya conocido. Antes: método v1 (11 referencias, ventanas de 30 km). Después: referencias v2 a 30 km. Escala fina: entre las ventanas de 10 km medidas (incluida una muestra de control al azar). «—»: no hay ventana de 10 km cerca. Cuanto más alto, mejor detecta el método los lugares que la ciencia ya usa.",
    "lm.legendV2": "<b>Puntos tenues</b>: el 3 % de la Tierra más parecido a 30 km.<br><b>Números</b>: el ranking elegido. <b>★</b>: historias destacadas.",
    "lm.kind.region_centro": "región (centro)",
    "lm.kind.region_tesela": "tesela de una región",
    "lm.kind.region": "región",
    "lm.kind.sitio": "sitio",
    "lm.kind.malla": "punto de la malla",
    "lm.kind.grupo": "grupo",
    "lm.kind.hirise": "parche HiRISE",
    "lm.grp.artemis_2024": "Regiones Artemis III (oct. 2024)",
    "lm.grp.artemis_2022_retirada": "Regiones retiradas (ago. 2022)",
    "lm.grp.sitios_polo_sur": "Sitios del polo sur",
    "lm.grp.malla_polar": "Malla polar (84–90°S)",
    "lm.grp.luna_fuera_del_polo": "Luna fuera del polo (solo gemelos)",
    "lm.grp.aterrizaje": "Aterrizajes",
    "lm.grp.llanura_hielo": "Llanuras con hielo",
    "lm.grp.canon": "Cañones",
    "lm.grp.crater": "Cráteres",
    "lm.grp.barrancos": "Barrancos",
    "lm.grp.polar": "Polar",
    "lm.grp.volcan": "Volcanes",
    "lm.grp.otro": "Otros terrenos",
    "lm.grp.none": "Sitios de referencia",
    "lm.cq.malla_generada": "generada por el método",
    "lm.cq.centro_crater_iau": "centro del cráter según la IAU",
    "lm.cq.centro_crater_iau_lon_no_verificada": "centro del cráter (IAU); longitud no verificada",
    "lm.cq.centro_mosaico_lroc": "centro del mosaico LROC NAC de la región",
    "lm.cq.centro_mosaico_lroc_compartido_lon_no_verificada": "centro de un mosaico LROC compartido; longitud no verificada",
    "lm.cq.lat_gsfc_lon_mosaico_compartido_no_verificada": "latitud de NASA GSFC; longitud de un mosaico compartido, no verificada",
    "lm.cq.no_verificada_centro_mosaico_compartido": "no verificada (centro de un mosaico compartido)",
    "lm.cq.no_verificada_punto_c2_glaser": "no verificada (punto C2 de Gläser et al.)",
    "lm.cq.punto_c1_glaser_no_es_centro": "punto C1 de Gläser et al. (no es el centro)",
    "lm.cq.publicada_lroc": "publicada por LROC",
    "lm.cq.de_articulo_cientifico": "de un artículo científico",
    "lm.cq.verificada_en_fuente": "leída en la fuente",
    "lm.src.moonSldem": "Luna fuera del polo · SLDEM2015, 59 m (LOLA + Kaguya TC, USGS)",
    "lm.sldemData": "SLDEM2015 (LOLA + Kaguya TC, 59 m)",
    "lm.src.moonPgda": "Luna · LOLA LDEM_80S_40MPP_ADJ, 40 m (NASA PGDA, Barker et al. 2023)",
    "lm.src.moonMini": "Minimapa del polo sur · relieve del DEM LRO LOLA 118 m (USGS)",
    "lm.src.lroc": "Regiones de Artemis III · mosaicos LROC NAC ROI (Arizona State University)",
    "lm.src.hirise": "Marte a 2 km · DTM HiRISE (USGS)",
    "lm.src.glo30": "Tierra a 5 y 2 km · Copernicus DEM GLO-30",
    "lm.src.marsMini": "Minimapa de Marte · Viking MDIM 2.1",
  },
  en: {
    "site.title": "GeoTwin",
    "nav.label": "Views",
    "nav.viewer": "Mars 3D viewer",
    "nav.map": "Moon & Mars map",
    "nav.globes": "3D globes",
    "nav.sources": "Data sources",
    "prefs.label": "Preferences",
    "prefs.lang": "Language",
    "prefs.toLight": "Switch to light theme",
    "prefs.toDark": "Switch to dark theme",
    "sources.title": "Data sources",
    "sources.ai": "Made with AI assistance: the code, the texts and the featured stories were written with AI assistants (Claude, by Anthropic) and checked by hand. The scores do not come from an AI: deterministic code computes them from the open data listed here.",
    "planet.mars": "Mars",
    "planet.earth": "Earth",
    "planet.moon": "Moon",

    // 3D globes (globos.html, globos.ts)
    "gl.docTitle": "GeoTwin · 3D globes",
    "path.title": "Path Planner",
    "path.docTitle": "GeoTwin · Path Planner",
    "path.stage": "Routes on the Mars and Earth globes",
    "path.draw": "Draw route",
    "path.upload": "Upload route",
    "path.example": "Try a route in Jezero",
    "path.exampleName": "Jezero route",
    "path.undo": "Undo point",
    "path.fit": "Fit routes",
    "path.clear": "Clear route",
    "path.search": "Find Earth routes",
    "path.cancel": "Cancel search",
    "path.comparison": "Route comparison",
    "path.help": "Mark waypoints on Mars. Drag to move the view.",
    "path.keyboard": "Use the arrow keys to move the center of the view, plus and minus to zoom, and Enter to add a point.",
    "path.marsMap": "Mars globe. Press Enter to add a waypoint at the center.",
    "path.zoomIn": "Zoom in on Mars",
    "path.zoomOut": "Zoom out on Mars",
    "path.reset.mars": "Reset Mars view",
    "path.reset.earth": "Reset Earth view",
    "path.distance": "{distance} km",
    "path.distancePreview": "Preview · {distance} km",
    "path.range.empty": "Allowed range · {min}–{max} km",
    "path.range.short": "Below minimum · {min}–{max} km",
    "path.range.ready": "In range · {min}–{max} km",
    "path.range.long": "Above maximum · {min}–{max} km",
    "path.waypoint": "1 waypoint",
    "path.waypoints": "{n} waypoints",
    "path.importing": "Opening route…",
    "path.searching": "Searching Earth routes… {percent}",
    "path.drawUnavailable": "The globe is unavailable. Upload a route file or try the Jezero route.",
    "path.error.unsupported-format": "Upload a GeoJSON, GPX, or KML file.",
    "path.error.file-too-large": "This file exceeds 10 MB. Export a smaller route.",
    "path.error.malformed-file": "The file could not be read. Export the route again.",
    "path.error.no-route": "The file has no route. Export a line with two or more points.",
    "path.error.multiple-routes": "This file contains separate routes. Export a single continuous route.",
    "path.error.invalid-coordinate": "The route has invalid coordinates. Check the latitude and longitude.",
    "path.error.too-many-points": "The route exceeds 20,000 points. Simplify it and upload it again.",
    "path.error.route-too-short": "Add at least two distinct waypoints to the route.",
    "path.error.coverage": "Mars elevation data is missing for this route. Try Jezero or adjust the route.",
    "path.error.earthData": "The Earth terrain catalog could not be loaded. Try searching again.",
    "path.error.noMatch": "No land route in the catalog fits this route shape. Try adjusting the route.",
    "path.error.distance": "Routes must be between {min} and {max} km. Adjust the route and try again.",
    "path.error.route": "The route could not be analyzed. Check the waypoints and try again.",
    "gl.modeLabel": "Points shown",
    "gl.best": "Best",
    "gl.all": "All",
    "gl.count": "{n} visible points",
    "gl.legend": "Legend",
    "gl.refPicker": "Moon or Mars site",
    "gl.goto": "Go to a point",
    "gl.allSites": "All sites",
    "gl.choosePoint": "Choose a point…",
    "gl.group": "{body} ({n})",
    "gl.stageLabel": "Globes of the Moon, Earth and Mars",
    "gl.radius.moon": "radius 1,737 km",
    "gl.radius.earth": "radius 6,371 km",
    "gl.radius.mars": "radius 3,390 km",
    "gl.reset": "Reset view",
    "gl.error": "The 3D globes are not available in this browser. Use the drop-downs above to look up the points.",
    "gl.detailLabel": "Point details",
    "gl.close": "Close details",
    "gl.howto": "Drag a globe to rotate it; use the wheel or pinch with two fingers to zoom. The globes are drawn at the same size: each label gives the real radius.",
    "gl.window": "30 km window · {coord}",
    "gl.refKicker": "{body} · reference site",
    "gl.refRole.moon": "Moon reference",
    "gl.refRole.mars": "Mars reference",
    "gl.twinsTitle": "Twins on Earth",
    "gl.analogOf.moon": "Moon analog",
    "gl.analogOf.mars": "Mars analog",
    "gl.closestTo": "Closest to",
    "gl.total": "Total score",
    "gl.terrain": "Terrain",
    "gl.surface": "Surface",
    "gl.assumed": " (assumed)",
    "gl.climate": "Climate",
    "gl.climateTitle": "Climate (2025)",
    "gl.tMean": "Mean temperature",
    "gl.tMin": "Yearly minimum",
    "gl.tMax": "Yearly maximum",
    "gl.diurnal": "Daily range",
    "gl.precip": "Annual precipitation",
    "gl.role.site.moon": "No. {rank} in the Moon ranking",
    "gl.role.site.mars": "No. {rank} in the Mars ranking",
    "gl.role.twin": "Twin no. {rank} of {ref}",
    "gl.role.featured": "Featured story · {tag}",
    "gl.role.validation.moon": "Known Moon analog · percentile {p}",
    "gl.role.validation.mars": "Known Mars analog · percentile {p}",
    "gl.role.curated": "Mars viewer catalog · hand-picked site (USGS 3DEP)",
    "gl.role.global": "Mars viewer catalog · global scan",
    "gl.nasaComparisons": "NASA analogs",
    "gl.nasaPairLink": "View comparison",
    "gl.patchKicker": "Mars · HiRISE patch from the catalog",
    "gl.terrainTitle": "Terrain",
    "gl.medianSlope": "Median slope",
    "gl.steepSlope": "90th percentile slope",
    "gl.relief": "Relief (5th–95th percentiles)",
    "gl.medianElev": "Median elevation",
    "gl.source": "Source",
    "gl.heatKicker.moon": "Earth · Moon heat-map cell",
    "gl.heatKicker.mars": "Earth · Mars heat-map cell",
    "gl.heatNote": "Heat-map cells only have the total score.",
    "gl.lg.ref": "Reference site",
    "gl.lg.featured": "Featured story",
    "gl.lg.site": "Top 20 or twin · {moon} {moonMin}+ · {mars} {marsMin}+",
    "gl.lg.validation": "Known analog",
    "gl.lg.catalog": "Catalog (Earth) · HiRISE patch (Mars)",
    "gl.lg.heat": "Heat map (lighter = more similar)",
    "gl.src.moonSldem": "Moon away from the pole · SLDEM2015 (LOLA + Kaguya TC, 59 m)",
    "gl.src.moonRefs": "Lunar south pole references · LOLA LDEM_80S_40MPP_ADJ, 40 m (NASA PGDA, Barker et al. 2023)",
    "gl.src.marsRefs": "Mars references · HRSC + MOLA 200 m (USGS)",
    "gl.src.hirise": "Mars patches · HiRISE catalog (USGS)",
    "gl.src.copernicus": "Earth · Copernicus DEM GLO-90",
    "gl.src.worldcover": "Earth · ESA WorldCover 2021",
    "gl.src.climate": "Climate 2025 · Meteomatics (ERA5)",
    "gl.src.earthImage": "Earth imagery · NASA Blue Marble",
    "gl.src.marsImage": "Mars imagery · Viking MDIM 2.1",
    "gl.src.moonImage": "Moon imagery · CGI Moon Kit, NASA's Scientific Visualization Studio (LRO LROC)",
    "gl.src.moonPole": "Lunar south pole · shaded relief from the LRO LOLA 118 m DEM (USGS), down to 78°S",
    "gl.src.earthTiles": "Earth close-up · Esri World Imagery (Esri, Vantor, Earthstar Geographics and the GIS User Community)",
    "gl.src.moonTiles": "Moon close-up · LRO WAC 100 m mosaic (NASA/GSFC/Arizona State University), via NASA Moon Trek",
    "gl.src.marsTiles": "Mars close-up · Viking MDIM 2.1 via NASA Mars Trek and the CTX beta01 mosaic (NASA/JPL/MSSS/Caltech Murray Lab/Esri)",

    "v.docTitle": "GeoTwin · 3D viewer",
    "v.globesLabel": "Planet globes",
    "v.marsPicker": "Mars terrain site",
    "v.find": "Find analogs",
    "v.globesCanvas": "Globes of Mars and Earth. Drag Mars to rotate it.",
    "v.globeError": "The globes are unavailable. Pick a Mars site above to compare terrain.",
    "v.matchesTitle": "Analogs on Earth",
    "v.compareLink": "Compare terrain",
    "v.matchListLabel": "Earth sites ranked by terrain, surface and climate",
    "v.comparisonLabel": "Terrain comparison",
    "v.colorLabel": "Terrain color",
    "v.relief": "Relief",
    "v.slope": "Slope",
    "v.cameraLabel": "Shared camera",
    "v.topView": "Top view",
    "v.resetView": "Reset view",
    "v.terrainCanvas": "Synced terrain views. Drag or use the arrow keys to rotate both terrains. Use the mouse wheel or plus and minus to zoom.",
    "v.legendLabel": "Slope in degrees",
    "v.metricsTitle": "Terrain measurements",
    "v.measure": "Measure",
    "v.method.summary": "How analogs are scored",
    "v.method.p1": "Earth candidates come from two sets: hand-picked US sites (USGS 3DEP), which only compete within the Mars site's terrain category, and 2 × 2 km patches from a worldwide scan of bare or icy ground (Copernicus DEM GLO-30), which compete on their measurements alone.",
    "v.method.p2": "<strong>Terrain (50%)</strong> is 1 minus the terrain distance: for the median slope, the 90th-percentile slope and the relief, the absolute difference is divided by the sum of both values, and the three are averaged. <strong>Surface (25%)</strong> is the patch's fraction of bare rock or sand (ESA WorldCover); for polar Mars sites, snow and ice count more. <strong>Climate (25%)</strong> rewards cold, dry places with a large daily temperature swing, from one year of Meteomatics data. No place on Earth reaches Martian conditions, so it measures relative closeness.",
    "v.method.p3": "The score compares topography, land cover and climate. It does not estimate geological equivalence or suitability for a mission.",
    "v.gridScale": "{w} × {w} km · {c} m cells · true vertical scale",
    "v.viewerError": "The 3D view could not be loaded. The terrain measurements are below.",
    "v.loading": "Loading terrain…",
    "v.loadError": "These terrains could not be loaded. Pick the candidate again to retry.",
    "v.origin.curated": "Curated · USGS 3DEP",
    "v.origin.near": "Global scan · near {name}",
    "v.origin.new": "Global scan · new candidate",
    "v.group.surface": "Surface · ESA WorldCover (Mars: no vegetation)",
    "v.bare": "Bare rock or sand",
    "v.dustRock": "dust and rock",
    "v.snowIce": "Snow or ice",
    "v.iceRich": "ice-rich ground",
    "v.vegetation": "Vegetation",
    "v.assumed": " (assumed)",
    "v.group.climate": "Climate · Meteomatics 2025 (Mars: typical values)",
    "v.tMean": "Mean temperature",
    "v.diurnal": "Daily temperature swing",
    "v.precip": "Annual precipitation",
    "v.group.score": "Score",
    "v.terrainSim": "Terrain similarity · {p}",
    "v.surfaceW": "Surface · {p}",
    "v.climateW": "Climate · {p}",
    "v.total": "Total",
    "v.bestOf": "Best of {n} · ",
    "v.score": "Score {v}",
    "v.bar.terrain": "Terrain",
    "v.bar.surface": "Land cover",
    "v.bar.climate": "Climate",
    "v.siteCount": "{n} sites",
    "metric.medianSlope": "Median slope",
    "metric.steepSlope": "90th-percentile slope",
    "metric.relief": "Relief (5th–95th percentile)",
    "cat.Valleys & fans": "Valleys & fans",
    "cat.Impact terrain": "Impact terrain",
    "cat.Ridges & layered terrain": "Ridges & layered terrain",
    "cat.Volcanic terrain": "Volcanic terrain",
    "cat.Dunes": "Dunes",
    "cat.Ice & polar terrain": "Ice & polar terrain",
    "src.marsElev": "Mars elevation · HiRISE catalog (USGS)",
    "src.earth3dep": "Earth elevation · USGS 3DEP",
    "src.earthGlo30": "Earth elevation · Copernicus DEM GLO-30",
    "src.cover": "Land cover · ESA WorldCover 2021",
    "src.climate": "Earth climate (2025) · Meteomatics",
    "src.marsImg": "Mars imagery · Viking MDIM 2.1",
    "src.earthImg": "Earth imagery · NASA Blue Marble",

    "lm.docTitle": "GeoTwin · Moon & Mars map",
    "lm.layoutLabel": "Moon and Mars analogs across the whole Earth",
    "lm.tabsLabel": "Reference body",
    "lm.tabMoon": "Moon",
    "lm.tabMars": "Mars",
    "lm.featured": "Featured stories",
    "lm.twins": "Earth twins of each site",
    "lm.ranking": "Overall ranking",
    "lm.validation": "Validation against known analogs",
    "lm.nasa": "NASA analogs",
    "lm.nasaTerrainWindow": "{km} × {km} km terrain · {m} m cells",
    "lm.nasaMetric": "Measurement",
    "lm.nasaTerrainScore": "Terrain similarity: {score}/100.",
    "lm.nasaMaxScore": "Salda’s terrain measurements use land cells. Its overall score can reach {max}/100, compared with {best}/100 for the best measured Jezero match.",
    "lm.nasaRankScore": "Overall score {score}/100 · rank {rank} · best match {best}/100.",
    "lm.nasaViewer": "Compare in the 3D viewer",
    "lm.validationNote": "Global percentile (among all 30 km windows of dry land) of the best point within 50 km of each known analog. The higher it is, the better the method detects the places science already uses.",
    "lm.mapLabel": "Map of Earth with the candidates",
    "lm.src.moon": "Moon · LOLA LDEM_80S_40MPP_ADJ, 40 m (NASA PGDA, Barker et al. 2023)",
    "lm.src.mars": "Mars at 30 and 10 km · HRSC + MOLA blend v2, 200 m (USGS)",
    "lm.src.glo90": "Earth at 30 and 10 km · Copernicus DEM GLO-90",
    "lm.src.cover": "Earth · ESA WorldCover 2021",
    "lm.src.climate": "Climate 2025 · Meteomatics (ERA5)",
    "lm.src.earthImg": "Earth imagery · Esri World Imagery",
    "lm.src.marsImg": "Mars imagery · CTX mosaic (Caltech Murray Lab, via Esri)",
    "lm.attribution": "Imagery © Esri, Maxar, Earthstar Geographics",
    "lm.legend": "<b>Faint dots</b>: the 3% of Earth most similar (terrain × surface).<br><b>Numbers</b>: best candidates after adding climate. <b>★</b>: featured stories.",
    "lm.pill.known": "known",
    "lm.pill.new": "new",
    "lm.pill.val": "validation",
    "lm.rankTitle": "Rank #{n}",
    "lm.similarTo": "similar to {name}",
    "lm.noStudies": "no analog studies found",
    "lm.twinTitle": "Twin #{k} of {name}",
    "lm.cardNote": "Score {s} · terrain {t}",
    "lm.knownAnalog": "Known analog",
    "lm.percentile": "Percentile",
    "lm.ok.terrain": "Terrain very similar to <b>{name}</b> ({v}/100).",
    "lm.no.terrain": "The terrain is only moderately similar to {name} ({v}/100).",
    "lm.cover": "{bare}% bare rock or sand and {ice}% ice or snow (ESA WorldCover).",
    "lm.noCover": "No land-cover data (Antarctica): ice or rock is assumed.",
    "lm.temp": "Mean temperature {m} °C (minimum {min} °C).",
    "lm.rain": "Precipitation {v} mm/year.",
    "lm.swing": "Daily temperature swing {v} °C.",
    "lm.altitude": "mean elevation {v} m",
    "lm.nearKnown": "near a known analog: {name}",
    "lm.notStudied": "we found no studies that use it as an analog",
    "lm.bar.total": "Total",
    "lm.bar.terrain": "Terrain · 50%",
    "lm.bar.surface": "Surface · 25%",
    "lm.bar.climate": "Climate · 25%",
    "lm.cmpLabel": "Side-by-side comparison",
    "lm.cmpRelief": "Relief · same scale",
    "lm.cmpReal": "Real imagery",
    "lm.scale": "10 km · each box is 30 × 30 km",
    "lm.terrainWindow": "Terrain (30 km window)",
    "lm.here": "Here",
    "lm.breaks": "Where the analogy breaks down",
    "lm.altEarth": "Shaded relief of the Earth site",
    "lm.altRef": "Shaded relief of {name}",
    "lm.noImage": "There is no relief image of this place yet.",
    "lm.noMoonMosaic": "There is no photo mosaic of the lunar south pole that works in a web map: flat maps distort it and much of it is in permanent shadow. Use the relief view (LRO LOLA).",

    "lm.introFine": " The best ones are measured again more closely: {l1} windows of 10 km and {l2} of 5 km (Moon) or 2 km (Mars).",
    "lm.refs": "References",
    "lm.refsSummary": "{n0} references at 30 km, {n1} at 10 km and {n2} at {k2} km.",
    "lm.refsUnusable": " {u} are not scored (see quality).",
    "lm.refsOutside": "{n} sites away from the pole (Apollo, Chang'e and possible lava-tube pits, with the 59 m SLDEM2015 DEM) do not fit on this map: see “Earth twins by group”. Their matches are shown by site, separately from the south-pole ranking and validation.",
    "lm.refsGroup": "Group",
    "lm.refsMapLabel.moon": "Mini map of the lunar south pole (80°S to the pole) with the references",
    "lm.refsMapLabel.mars": "Mini map of Mars with the reference sites",
    "lm.refPick": "Reference or group",
    "lm.refPickHint": "Click a point on the mini map or pick one from the list.",
    "lm.refPickNone": "Choose a reference…",
    "lm.refPickGroups": "Twin groups",
    "lm.refPickRefs": "References at 30 km",
    "lm.lg.l1": "10 km and 5 km windows (L1, L2)",
    "lm.lg.l1mars": "10 km windows (L1) and 2 km HiRISE patches (L2)",
    "lm.lg.usable": "Scored site (HRSC)",
    "lm.lg.mola": "Scored at 30 km, MOLA only (no 10 km)",
    "lm.lg.unusable": "MOLA only, not scored",
    "lm.lg.selected": "Selected",
    "lm.ring": "{lat}°S",
    "lm.groupOf": "Twin group: {name}",
    "lm.refCounts": "{n0} at 30 km · {n1} at 10 km · {n2} at {k2} km",
    "lm.gridPoints": "Points generated on a regular grid from 84 to 90°S; they are not published sites.",
    "lm.quality": "Quality",
    "lm.coordQuality": "Coordinate",
    "lm.source": "Source",
    "lm.sourceLink": "Open the source",
    "lm.sourceNote": "Source note",
    "lm.noSource": "No link: point generated by the method.",
    "lm.q.effres": "LOLA effective resolution (EFFRES): median {p50} m, p90 {p90} m.",
    "lm.q.hrsc": "Covered by HRSC (R400 = {r}, MOLA fraction {m}).",
    "lm.q.mola": "MOLA only (463 m or coarser; R400 = {r}, MOLA fraction {m}).",
    "lm.q.unusable": "Not scored.",
    "lm.q.none": "No quality measure.",
    "lm.refTwins": "Its Earth twins",
    "lm.twins30": "At 30 km",
    "lm.twins10": "At 10 km",
    "lm.noTwins": "No twins in the data.",
    "lm.showRef": "Show the reference card",
    "lm.bestTwin": "best twin",
    "lm.twinsGroups": "Earth twins by group",
    "lm.twinsHint": "Sorted by the score of their best twin. Open them to see the twins at 30 km and at 10 km.",
    "lm.rankMode": "Ranking type",
    "lm.rankFinal": "Multiscale final (30 km → 10 km → 5/2 km)",
    "lm.rankL0": "At 30 km",
    "lm.rankNew": "New only",
    "lm.robust": "Robustness: stays in the top 10 of its list in {p}% of {n} weight combinations (terrain 0.35–0.7; surface 0.1–0.35; climate, the rest); rank between {a} and {b}.",
    "lm.newTitle": "New #{n}",
    "lm.newNote": "Only candidates away from known analogs and with no studies found: what the challenge asks us to discover. «Not reviewed» = literature pending.",
    "lm.finalTitle": "Final #{n}",
    "lm.pinGroup": "Ranks {list}: zoom in to see them one by one",
    "lm.levelsShort": "terrain 30/10/{k} km: {a} · {b} · {c}",
    "lm.terrainLevels": "Terrain by scale",
    "lm.levelBar": "{km} km ({lv})",
    "lm.cmpLevel": "Comparison scale",
    "lm.cmpWindow": "{w} km window · {p} m pixel",
    "lm.cmpImgPx": " (image at {p} m)",
    "lm.cmpData": "Data: Earth, {earth}; {body}, {ref}.",
    "lm.scaleKm": "{bar} · each box is {w} × {w} km",
    "lm.terrainWindowKm": "Terrain ({km} km window)",
    "lm.noRefFeatures": "The data do not include the reference's features at this scale.",
    "lm.tileOf": "{km} km window",
    "lm.hirisePatch": "HiRISE patch {id}",
    "lm.scope": "Compared at {km} km with: {s}.",
    "lm.scope.all": "all references at that scale",
    "lm.scope.cat": "the HiRISE patches in the “{c}” category",
    "lm.scope.region": "the tiles of {name}",
    "lm.lit": "Literature",
    "lm.lit.known": "Already studied as an analog",
    "lm.lit.none": "We found no studies that use it as an analog",
    "lm.lit.unverified": "Not verified: we have not reviewed the literature for this place.",
    "lm.lit.link": "See the study",
    "lm.lit.km": "{km} km away",
    "lm.pill.studied": "studied",
    "lm.pill.unreviewed": "not reviewed",
    "lm.notReviewed": "literature not reviewed for this place",
    "lm.before": "Before (v1)",
    "lm.after": "After (v2)",
    "lm.fine": "Fine scale (10 km)",
    "lm.noWindow": "no window within 50 km",
    "lm.validationNoteV2": "Global percentile of the best point within 50 km of each known analog. Before: v1 method (11 references, 30 km windows). After: v2 references at 30 km. Fine scale: among the measured 10 km windows (including a random control sample). “—”: there is no 10 km window nearby. The higher it is, the better the method detects the places science already uses.",
    "lm.legendV2": "<b>Faint dots</b>: the 3% of Earth most similar at 30 km.<br><b>Numbers</b>: the chosen ranking. <b>★</b>: featured stories.",
    "lm.kind.region_centro": "region (center)",
    "lm.kind.region_tesela": "tile of a region",
    "lm.kind.region": "region",
    "lm.kind.sitio": "site",
    "lm.kind.malla": "grid point",
    "lm.kind.grupo": "group",
    "lm.kind.hirise": "HiRISE patch",
    "lm.grp.artemis_2024": "Artemis III regions (Oct 2024)",
    "lm.grp.artemis_2022_retirada": "Retired regions (Aug 2022)",
    "lm.grp.sitios_polo_sur": "South-pole sites",
    "lm.grp.malla_polar": "Polar grid (84–90°S)",
    "lm.grp.luna_fuera_del_polo": "Moon away from the pole (twins only)",
    "lm.grp.aterrizaje": "Landing sites",
    "lm.grp.llanura_hielo": "Icy plains",
    "lm.grp.canon": "Canyons",
    "lm.grp.crater": "Craters",
    "lm.grp.barrancos": "Gullies",
    "lm.grp.polar": "Polar",
    "lm.grp.volcan": "Volcanoes",
    "lm.grp.otro": "Other terrains",
    "lm.grp.none": "Reference sites",
    "lm.cq.malla_generada": "generated by the method",
    "lm.cq.centro_crater_iau": "crater center according to the IAU",
    "lm.cq.centro_crater_iau_lon_no_verificada": "crater center (IAU); longitude not verified",
    "lm.cq.centro_mosaico_lroc": "center of the region's LROC NAC mosaic",
    "lm.cq.centro_mosaico_lroc_compartido_lon_no_verificada": "center of a shared LROC mosaic; longitude not verified",
    "lm.cq.lat_gsfc_lon_mosaico_compartido_no_verificada": "latitude from NASA GSFC; longitude from a shared mosaic, not verified",
    "lm.cq.no_verificada_centro_mosaico_compartido": "not verified (center of a shared mosaic)",
    "lm.cq.no_verificada_punto_c2_glaser": "not verified (point C2 of Gläser et al.)",
    "lm.cq.punto_c1_glaser_no_es_centro": "point C1 of Gläser et al. (not the center)",
    "lm.cq.publicada_lroc": "published by LROC",
    "lm.cq.de_articulo_cientifico": "from a scientific paper",
    "lm.cq.verificada_en_fuente": "read in the source",
    "lm.src.moonSldem": "Moon away from the pole · SLDEM2015, 59 m (LOLA + Kaguya TC, USGS)",
    "lm.sldemData": "SLDEM2015 (LOLA + Kaguya TC, 59 m)",
    "lm.src.moonPgda": "Moon · LOLA LDEM_80S_40MPP_ADJ, 40 m (NASA PGDA, Barker et al. 2023)",
    "lm.src.moonMini": "South-pole mini map · relief from the LRO LOLA 118 m DEM (USGS)",
    "lm.src.lroc": "Artemis III regions · LROC NAC ROI mosaics (Arizona State University)",
    "lm.src.hirise": "Mars at 2 km · HiRISE DTMs (USGS)",
    "lm.src.glo30": "Earth at 5 and 2 km · Copernicus DEM GLO-30",
    "lm.src.marsMini": "Mars mini map · Viking MDIM 2.1",
  },
};

/**
 * Textos que llegan en español desde los datos (src/data/results.json y catalog.json, generados por el pipeline).
 * Se traducen por su texto exacto (aquí y en i18n.datos.en.ts) o con las reglas de dataRules, que componen
 * las notas con parte variable. Si el pipeline cambia un texto y no queda cubierto, se muestra en español:
 * noche/tools/marca-datos-traducidos.mjs recorre los datos y falla cuando eso ocurre.
 */
const dataEn: Record<string, string> = {
  "Pendiente típica (°)": "Typical slope (°)",
  "Pendiente alta, p90 (°)": "High slope, p90 (°)",
  "Fracción llana <5°": "Flat fraction <5°",
  "Fracción empinada >15°": "Steep fraction >15°",
  "Relieve local p5–p95 (m)": "Local relief p5–p95 (m)",
  "Rugosidad a ~1 km (m)": "Roughness at ~1 km (m)",

  "Borde del cráter Shackleton": "Shackleton crater rim",
  "de Gerlache (región Artemis III 'de Gerlache Rim 2')": "de Gerlache (Artemis III region 'de Gerlache Rim 2')",
  "Haworth (región Artemis III)": "Haworth (Artemis III region)",
  "Nobile (regiones Artemis III 'Nobile Rim 1/2')": "Nobile (Artemis III regions 'Nobile Rim 1/2')",
  "Malapert (región Artemis III 'Malapert Massif')": "Malapert (Artemis III region 'Malapert Massif')",
  "Cabeus (región Artemis III 'Peak near Cabeus B')": "Cabeus (Artemis III region 'Peak near Cabeus B')",
  "Cráter Jezero (Perseverance)": "Jezero crater (Perseverance)",
  "Cráter Gale (Curiosity)": "Gale crater (Curiosity)",

  "Junto al polo sur; zonas de luz casi permanente y cráteres en sombra permanente.":
    "Next to the south pole; areas of near-permanent sunlight and permanently shadowed craters.",
  "Región candidata Artemis III más cercana al polo.": "Artemis III candidate region closest to the pole.",
  "Región candidata Artemis III.": "Artemis III candidate region.",
  "Región candidata Artemis III; objetivo previsto del rover VIPER.":
    "Artemis III candidate region; planned target of the VIPER rover.",
  "Macizo con luz solar casi continua.": "Massif with almost continuous sunlight.",
  "Lugar del impacto LCROSS (2009), que detectó hielo de agua.":
    "Site of the LCROSS impact (2009), which detected water ice.",
  "Antiguo lago con delta; búsqueda de biofirmas.": "Ancient lake with a delta; search for biosignatures.",
  "Sedimentos lacustres y Monte Sharp.": "Lake sediments and Mount Sharp.",
  "Llanura con hematita, evidencia de agua antigua.": "Hematite-bearing plain, evidence of ancient water.",
  "Llanura del norte; posible hielo subterráneo.": "Northern plain; possible subsurface ice.",
  "Llanura muy plana y segura para aterrizar.": "Very flat plain, safe for landing.",

  "Desierto de Atacama (Yungay)": "Atacama Desert (Yungay)",
  "Cráter Haughton, isla Devon": "Haughton crater, Devon Island",
  "Valle de la Muerte": "Death Valley",
  "Valles Secos de McMurdo": "McMurdo Dry Valleys",
  "Askja, Islandia": "Askja, Iceland",
  "Mauna Kea, Hawái": "Mauna Kea, Hawaii",
  "Río Tinto, España": "Río Tinto, Spain",
  "Cuenca de Qaidam, China (análogo de Marte publicado)": "Qaidam Basin, China (published Mars analog)",
  "Ladakh / Tso Kar, India (estación análoga Luna/Marte)": "Ladakh / Tso Kar, India (Moon/Mars analog station)",
  "Puna de Atacama (análogo de Marte y astrobiología)": "Puna de Atacama (Mars and astrobiology analog)",
  "Emi Koussi, Tibesti (análogo de Elysium Mons)": "Emi Koussi, Tibesti (Elysium Mons analog)",

  // results.json v2: rasgos de forma, escalas y fuentes por nivel (rank.py, terrain.py)
  "Curvatura alta, p90 de |laplaciano| (1/m)": "High curvature, p90 of |Laplacian| (1/m)",
  "Fracción en depresiones cerradas": "Fraction in closed depressions",
  "Integral hipsométrica": "Hypsometric integral",
  "LOLA LDEM_80S_40MPP_ADJ (PGDA, Barker et al. 2023): píxel 40 m, resolución efectiva 16–50 m según la latitud":
    "LOLA LDEM_80S_40MPP_ADJ (PGDA, Barker et al. 2023): 40 m pixel, effective resolution 16–50 m depending on latitude",
  "Blend HRSC+MOLA v2: 200 m donde hay HRSC; 463 m o peor donde solo hay MOLA (esas referencias no puntúan a 400 m)":
    "HRSC+MOLA blend v2: 200 m where there is HRSC; 463 m or coarser where there is only MOLA (those references are not scored at 400 m)",
  "Blend HRSC+MOLA v2: 200 m donde hay HRSC; 463 m o peor donde solo hay MOLA (esas referencias se marcan)":
    "HRSC+MOLA blend v2: 200 m where there is HRSC; 463 m or coarser where there is only MOLA (those references are flagged)",
  "LOLA PGDA 40 m (EFFRES ~30–50 m)": "LOLA PGDA 40 m (EFFRES ~30–50 m)",
  "Blend HRSC+MOLA v2, solo teselas con HRSC (200 m)": "HRSC+MOLA blend v2, HRSC tiles only (200 m)",
  "LOLA PGDA 40 m; solo teselas con EFFRES p50 ≤ 60 m": "LOLA PGDA 40 m; only tiles with EFFRES p50 ≤ 60 m",
  "116 parches HiRISE DTM (~1–2 m) del visor, 100×100 a 20 m, remuestreados a 30 m":
    "116 HiRISE DTM patches (~1–2 m) from the viewer, 100×100 at 20 m, resampled to 30 m",
  "sin ventana a <50 km": "no window within 50 km",
  "Antártida (muy estudiada como análogo)": "Antarctica (widely studied as an analog)",
  "Bockfjorden, Svalbard": "Bockfjorden, Svalbard",
  "Pilbara, Australia": "Pilbara, Australia",
  "Desierto de Lut, Irán (yardangs y TARs, análogo de Marte)": "Lut Desert, Iran (yardangs and TARs, Mars analog)",

  // Nombres de grupos y referencias v2 (reference_sites.py, rank.py)
  "Malla polar de 84–90°S (generada, no es un sitio publicado)": "Polar grid from 84 to 90°S (generated, not a published site)",
  "Mons Mouton (antes Leibnitz Beta Plateau)": "Mons Mouton (formerly Leibnitz Beta Plateau)",
  "Mons Mouton y Nobile Rim 1 (comparten mosaico LROC)": "Mons Mouton and Nobile Rim 1 (shared LROC mosaic)",
  "Intuitive Machines IM-2 (Athena), posición final en Mons Mouton": "Intuitive Machines IM-2 (Athena), final position on Mons Mouton",
  "Borde S de Shackleton (punto de alta iluminación)": "South rim of Shackleton (highly illuminated point)",
  "Cráter Shackleton (centro según la IAU)": "Shackleton crater (center according to the IAU)",
  "Aram Chaos: bloques levantados de depósitos claros estratificados": "Aram Chaos: uplifted blocks of light-toned layered deposits",
  "Arcadia Planitia: cráter nuevo que expuso hielo": "Arcadia Planitia: new crater that exposed ice",
  "Arsia Mons (NE): pozo candidato a entrada de caverna": "Arsia Mons (NE): pit, candidate cave entrance",
  "Cabecera de Chasma Boreale: depósitos estratificados del polo norte": "Head of Chasma Boreale: north polar layered deposits",
  "Candor Chasma occidental: depósitos sedimentarios estratificados": "Western Candor Chasma: layered sedimentary deposits",
  "Coprates Chasma: borde norte y pared con fallas y capas": "Coprates Chasma: north rim and faulted, layered wall",
  "Cráter Eberswalde: delta": "Eberswalde crater: delta",
  "Cráter Gasa: barrancos activos": "Gasa crater: active gullies",
  "Cráter Hale: barrancos en el borde noroeste": "Hale crater: gullies on the northwest rim",
  "Cráter Holden: depósitos estratificados bajo abanicos aluviales": "Holden crater: layered deposits below alluvial fans",
  "Cráter Korolev": "Korolev crater",
  "Cráter Tooting": "Tooting crater",
  "Cráter sin nombre dentro de Newton: barrancos diversos": "Unnamed crater inside Newton: diverse gullies",
  "Curiosity, Bradbury Landing (cráter Gale)": "Curiosity, Bradbury Landing (Gale crater)",
  "Deuteronilus Mensae: delantal de derrubios lobulado": "Deuteronilus Mensae: lobate debris apron",
  "EZ Protonilus Mensae (Gallegos y Newsom)": "EZ Protonilus Mensae (Gallegos and Newsom)",
  "EZ Valles Marineris – Coprates Chasma occidental (Mojarro et al.)": "EZ Valles Marineris – western Coprates Chasma (Mojarro et al.)",
  "EZ borde de Hellas (Levy y Holt)": "EZ Hellas rim (Levy and Holt)",
  "EZ cráter Columbus (Terra Sirenum, Lynch y Wray)": "EZ Columbus crater (Terra Sirenum, Lynch and Wray)",
  "Kasei Valles: canales en una isla aerodinámica": "Kasei Valles: channels on a streamlined island",
  "Llanuras al sur de Pavonis Mons: pequeños respiraderos eruptivos": "Plains south of Pavonis Mons: small eruptive vents",
  "Mawrth Vallis: filosilicatos": "Mawrth Vallis: phyllosilicates",
  "Medusae Fossae: yardangs": "Medusae Fossae: yardangs",
  "Nili Fossae: llanuras con carbonatos": "Nili Fossae: carbonate-bearing plains",
  "Nili Patera: dunas y ripples activos": "Nili Patera: active dunes and ripples",
  "Olympus Mons: abanicos de lava en el flanco": "Olympus Mons: lava fans on the flank",
  "Opportunity (Meridiani Planum, cráter Eagle)": "Opportunity (Meridiani Planum, Eagle crater)",
  "Perseverance, Octavia E. Butler Landing (cráter Jezero)": "Perseverance, Octavia E. Butler Landing (Jezero crater)",
  "Phoenix (Vastitas Borealis, llanuras polares del norte)": "Phoenix (Vastitas Borealis, northern polar plains)",
  "Planum Australe: afloramientos de los depósitos estratificados del polo sur": "Planum Australe: outcrops of the south polar layered deposits",
  "Spirit (cráter Gusev)": "Spirit (Gusev crater)",
  "Utopia Planitia: terreno festoneado y polígonos": "Utopia Planitia: scalloped terrain and polygons",
  "Zhurong / Tianwen-1 (Utopia Planitia sur)": "Zhurong / Tianwen-1 (southern Utopia Planitia)",
  // Historias destacadas (results.json → featured; las escribe FEATURED en pipeline/analogs/rank.py).
  "Changtang (Tíbet occidental, ~4.800 m), gemelo de las llanuras del polo sur lunar":
    "Changtang (western Tibet, ~4,800 m), twin of the lunar south pole plains",
  "A 10 km, esta ventana del altiplano de Changtang (condado de Gêrzê, Ngari) tiene casi la misma distribución de pendientes que una ventana de la malla polar a 86,4°S (pendiente típica 2,9° frente a 3,1°; p90 8,7° frente a 9,9°; 72 % llano frente a 68 %; relieve 234 m frente a 261 m). La similitud se mantiene a 30 km (98/100) y a 5 km (90/100, frente a una tesela de la región Haworth de Artemis III). Es suelo desnudo al 100 %, con una media de −2,2 °C y mínimas de −27 °C (ERA5, 2025): un lugar para ensayar movilidad y aterrizaje en las llanuras entre cráteres del polo sur, con frío y a gran altitud. Tras 8 búsquedas en inglés y chino no encontramos estudios que lo usen como análogo; los análogos tibetanos publicados están en la cuenca de Qaidam, a más de 600 km. Dónde falla: aquí el relieve lo modelan el hielo y el agua, no los impactos, y caen 333 mm al año.":
    "At 10 km, this window on the Changtang plateau (Gêrzê County, Ngari) has almost the same slope distribution as a polar grid window at 86.4°S (typical slope 2.9° vs 3.1°; p90 8.7° vs 9.9°; 72% flat vs 68%; relief 234 m vs 261 m). The similarity holds at 30 km (98/100) and at 5 km (90/100, against a tile of the Haworth Artemis III region). It is 100% bare ground, with a mean of −2.2 °C and minimums of −27 °C (ERA5, 2025): a place to rehearse mobility and landing on the plains between the south pole craters, in the cold and at high altitude. After 8 searches in English and Chinese we found no studies that use it as an analog; the published Tibetan analogs are in the Qaidam Basin, more than 600 km away. Where it fails: here the relief was shaped by ice and water, not by impacts, and it gets 333 mm of precipitation a year.",
  "Alta cordillera de San Juan (Argentina, ~4.200 m), gemela del cráter Shackleton":
    "High cordillera of San Juan (Argentina, ~4,200 m), twin of Shackleton crater",
  "Una ventana de 30 km en el departamento de Iglesia (San Juan) tiene casi la misma pendiente que el cráter Shackleton medido con el DEM LOLA de 40 m (pendiente típica 14,6° frente a 14,0°; 48 % del terreno por encima de 15° frente a 47 %), con un 98 % de roca desnuda, media de −6,2 °C y mínimas de −39 °C. Sirve para probar rovers y aterrizajes en laderas empinadas como las de las crestas iluminadas del polo sur. Dónde falla: Shackleton es más profundo (relieve 3.781 m frente a 2.027 m) y sus pendientes extremas son mayores (p90 31° frente a 25°). En una búsqueda breve (inglés y español) no encontramos estudios que usen esta zona como análogo; los análogos andinos publicados están en la Puna y en Atacama, a más de 300 km.":
    "A 30 km window in the Iglesia department (San Juan) has almost the same slope as Shackleton crater measured with the 40 m LOLA DEM (typical slope 14.6° vs 14.0°; 48% of the terrain above 15° vs 47%), with 98% bare rock, a mean of −6.2 °C and minimums of −39 °C. It is useful for testing rovers and landings on steep slopes like those of the sunlit ridges at the south pole. Where it fails: Shackleton is deeper (relief 3,781 m vs 2,027 m) and its extreme slopes are steeper (p90 31° vs 25°). In a brief search (English and Spanish) we found no studies that use this area as an analog; the published Andean analogs are in the Puna and the Atacama, more than 300 km away.",
  "Cuenca de Qaidam (China), gemela de la zona de exploración de Jezero":
    "Qaidam Basin (China), twin of the Jezero exploration zone",
  "Sin decírselo, el método encontró la cuenca de Qaidam (~3.250 m) como el mejor gemelo de la zona de exploración humana Jezero–Syrtis–Isidis, con terreno parecido a las tres escalas: 96/100 a 30 km, 99/100 a 10 km y 96/100 a 2 km frente a un parche HiRISE de un delta invertido (pendiente típica 5,2° frente a 4,5°; relieve 93 m frente a 102 m). Qaidam ya está publicada como análogo de Marte (antiguo lago evaporado, frío y seco, con yardangs y sales): que el método la redescubra sin saberlo es una prueba de que funciona.":
    "Without being told, the method found the Qaidam Basin (~3,250 m) as the best twin of the Jezero–Syrtis–Isidis human exploration zone, with similar terrain at all three scales: 96/100 at 30 km, 99/100 at 10 km and 96/100 at 2 km against a HiRISE patch of an inverted delta (typical slope 5.2° vs 4.5°; relief 93 m vs 102 m). Qaidam is already published as a Mars analog (an ancient evaporated lake, cold and dry, with yardangs and salts): that the method rediscovers it without knowing is evidence that it works.",
  "Meseta de Djado (Níger), gemela de las llanuras del cráter Gusev":
    "Djado Plateau (Niger), twin of the Gusev crater plains",
  "Es el n.º 1 del ranking final de Marte. A 10 km se parece mucho a una ventana de las llanuras de Gusev donde aterrizó Spirit (pendiente típica 2,3° frente a 2,3°; p90 8,1° frente a 8,5°; 77 % llano frente a 77 %; relieve 187 m frente a 179 m: 100/100), y también a 30 km (98/100) y a 2 km (93/100 frente a un parche HiRISE de Utopia Planitia de la misma categoría). Es roca desnuda casi sin lluvia (4 mm en 2025). En una búsqueda breve (inglés y francés) no encontramos estudios que lo usen como análogo; hay trabajos regionales sobre el Teneré que no sitúan su zona aquí. Dónde falla: es caluroso (media de 23,7 °C), al contrario que Marte.":
    "It is #1 in the final Mars ranking. At 10 km it closely resembles a window of the Gusev plains where Spirit landed (typical slope 2.3° vs 2.3°; p90 8.1° vs 8.5°; 77% flat vs 77%; relief 187 m vs 179 m: 100/100), and also at 30 km (98/100) and at 2 km (93/100 against a HiRISE patch of Utopia Planitia in the same category). It is bare rock with almost no rain (4 mm in 2025). In a brief search (English and French) we found no studies that use it as an analog; there is regional work on the Ténéré that does not place its study area here. Where it fails: it is hot (mean of 23.7 °C), unlike Mars.",
  "Iglesia (San Juan, Argentina, ~3.280 m), gemelo de las llanuras de Haworth":
    "Iglesia (San Juan, Argentina, ~3,280 m), twin of the Haworth plains",
  "A 5 km, esta ventana del departamento de Iglesia (San Juan, Cordillera Frontal andina) se parece a una tesela de 5 km de la región Haworth de Artemis III: pendiente típica 3,2° frente a 4,1°; p90 9,1° frente a 7,9°; 71 % llano frente a 64 %; relieve 172 m frente a 181 m (94/100). A 10 y 30 km se parece a celdas de la malla polar de 84–90°S (97/100 en las dos escalas). Es suelo desnudo al 99 %, con media de 6,4 °C, mínima de −22,1 °C y 187 mm de lluvia (ERA5, 2025). Como hipótesis, serviría para ensayar movilidad de rovers en llanuras suaves con algunas pendientes, a gran altitud. Tras 11 búsquedas en inglés y español no encontramos estudios que lo usen como análogo; los análogos andinos que aparecen (Dos Lenguas, Ojos del Salado, Maricunga) son de Marte y están a más de 150 km (distancias estimadas). Dónde falla: hay atmósfera y lluvia, la máxima llega a 26,9 °C y la similitud climática es solo 31/100.":
    "At 5 km, this window in the Iglesia department (San Juan, Andean Frontal Cordillera) resembles a 5 km tile of the Haworth Artemis III region: typical slope 3.2° vs 4.1°; p90 9.1° vs 7.9°; 71% flat vs 64%; relief 172 m vs 181 m (94/100). At 10 and 30 km it resembles cells of the 84–90°S polar grid (97/100 at both scales). It is 99% bare ground, with a mean of 6.4 °C, a minimum of −22.1 °C and 187 mm of rain (ERA5, 2025). As a hypothesis, it could be used to rehearse rover mobility on gentle plains with some slopes, at high altitude. After 11 searches in English and Spanish we found no studies that use it as an analog; the Andean analogs that do come up (Dos Lenguas, Ojos del Salado, Maricunga) are Mars analogs and lie more than 150 km away (estimated distances). Where it fails: there is an atmosphere and rain, the maximum reaches 26.9 °C and the climate similarity is only 31/100.",
  "Cuenca alta del Loa (Antofagasta, Chile, ~3.490 m), gemela de las laderas de Mons Mouton Plateau":
    "Upper Loa basin (Antofagasta, Chile, ~3,490 m), twin of the Mons Mouton Plateau slopes",
  "A 5 km, esta ventana de la cuenca alta del río Loa (Provincia de El Loa, Región de Antofagasta, Chile; 3.487 m de altitud media, a unos 67 km al norte de Calama) se parece en terreno a la tesela 12 del Mons Mouton Plateau, en el polo sur lunar: pendiente mediana 6,3° frente a 6,8°; p90 13,9° frente a 14,6°; 38 % llano frente a 28 %; relieve 352 m frente a 386 m. La similitud de terreno es 88/100 a 5 km; a 10 y 30 km se parece a celdas de la malla polar de 84–90°S (94/100 y 96/100). El suelo es 100 % desnudo, con media de 7,5 °C, mínimas de −6,8 °C y 68 mm de lluvia al año (ERA5, 2025). Como hipótesis, serviría para ensayar movilidad y navegación de rovers en pendientes moderadas como las de Mons Mouton. Tras más de diez búsquedas en inglés y español no encontramos estudios que lo usen como análogo; lo más cercano es el Salar de Ascotán (~77 km), solo con una nota de prensa, y los análogos documentados del Atacama están a más de 100 km. Dónde falla: la similitud climática es de solo 28/100, porque aquí llueve (68 mm al año) y las mínimas de −6,8 °C son un frío suave comparado con el polo lunar.":
    "At 5 km, this window in the upper Loa River basin (El Loa Province, Antofagasta Region, Chile; mean elevation 3,487 m, about 67 km north of Calama) resembles in terrain tile 12 of the Mons Mouton Plateau, at the lunar south pole: median slope 6.3° vs 6.8°; p90 13.9° vs 14.6°; 38% flat vs 28%; relief 352 m vs 386 m. The terrain similarity is 88/100 at 5 km; at 10 and 30 km it resembles cells of the 84–90°S polar grid (94/100 and 96/100). The ground is 100% bare, with a mean of 7.5 °C, minimums of −6.8 °C and 68 mm of rain a year (ERA5, 2025). As a hypothesis, it could be used to rehearse rover mobility and navigation on moderate slopes like those of Mons Mouton. After more than ten searches in English and Spanish we found no studies that use it as an analog; the closest is the Salar de Ascotán (~77 km), with only a press release, and the documented Atacama analogs are more than 100 km away. Where it fails: the climate similarity is only 28/100, because it rains here (68 mm a year) and minimums of −6.8 °C are a mild cold compared with the lunar pole.",
  "Llanura de la Tamesna (Argelia, ~490 m), gemela del cráter con hielo de Arcadia Planitia":
    "Tamesna plain (Algeria, ~490 m), twin of the ice-exposing crater in Arcadia Planitia",
  "Esta ventana de la llanura de la Tamesna (daïra de In Guezzam, sur de Argelia, a ~490 m, unos 70 km al NNE de In Guezzam) es casi plana: pendiente típica de 1,6°, p90 de 3,7°, 97 % del terreno por debajo de 5°, nada por encima de 15° y solo 18 m de relieve. Su similitud de terreno con el sitio marciano de Arcadia Planitia donde un cráter nuevo dejó hielo al descubierto es de 95/100 a 30 km y 94/100 a 10 km; a 2 km puntúa 96/100 frente a un modelo digital de terreno HiRISE de la categoría de terreno helado y polar. Es suelo desnudo al 100 %, con 29,5 °C de media, mínimas de 6,9 °C y 2 mm de lluvia al año (ERA5, 2025). Puntúa 85/100 en total y en todas las combinaciones de pesos probadas queda entre los diez primeros nuevos (peor puesto: 6.º). Por su pendiente podría servir para ensayar navegación de rovers en terreno llano. Tras 12 búsquedas en inglés, francés y árabe no encontramos estudios que la usen como análogo; los análogos saharianos publicados (cuenca de Ahnet, salares del Tanezrouft) están a cientos de km al norte. Dónde falla: hace calor (hasta 46,2 °C) y no hay hielo (0 %), justo lo que define al sitio marciano; además, el terreno de Arcadia es aún más llano (pendiente típica de 0,3° a 30 km).":
    "This window on the Tamesna plain (In Guezzam daïra, southern Algeria, at ~490 m, about 70 km NNE of In Guezzam) is almost flat: typical slope of 1.6°, p90 of 3.7°, 97% of the terrain below 5°, nothing above 15° and only 18 m of relief. Its terrain similarity with the Martian site in Arcadia Planitia where a new crater exposed ice is 95/100 at 30 km and 94/100 at 10 km; at 2 km it scores 96/100 against a HiRISE digital terrain model from the icy and polar terrain category. It is 100% bare ground, with a mean of 29.5 °C, minimums of 6.9 °C and 2 mm of rain a year (ERA5, 2025). It scores 85/100 overall and stays among the top ten new candidates in every weight combination tested (worst rank: 6th). Given its slopes, it could be used to rehearse rover navigation on flat terrain. After 12 searches in English, French and Arabic we found no studies that use it as an analog; the published Saharan analogs (Ahnet basin, Tanezrouft salt flats) are hundreds of km to the north. Where it fails: it is hot (up to 46.2 °C) and there is no ice (0%), precisely what defines the Martian site; also, the Arcadia terrain is even flatter (typical slope of 0.3° at 30 km).",
  "Colinas del Mar Rojo (Egipto, ~456 m), gemelas de capas de roca de Terra Sirenum":
    "Red Sea Hills (Egypt, ~456 m), twins of rock layers in Terra Sirenum",
  "Ventana de 2 km en las colinas del Mar Rojo (Desierto Oriental, Egipto; ~456 m de altitud) con pendientes muy parecidas a las de una imagen HiRISE de roca estratificada en un cráter erosionado de Terra Sirenum: pendiente típica 12,1° frente a 11,2°, p90 27,1° frente a 27,0°, 43 % de terreno >15° frente a 37 % y relieve de 151 m frente a 160 m (similitud 98/100). A 10 y 30 km la referencia son las llanuras con carbonatos de Nili Fossae y la similitud sigue alta (97/100 y 95/100), aunque allí el terreno es mucho más suave (pendiente típica 3,2° a 10 km). Es suelo desnudo al 100 %, con media de 26,9 °C, mínima anual de 8,2 °C y 5 mm de lluvia al año (ERA5, 2025). Tras 11 búsquedas en inglés, árabe y francés no encontramos estudios que usen este lugar como análogo; los análogos egipcios publicados que aparecieron están en el Desierto Occidental, a cientos de km. Dónde falla: hace mucho más calor que en Marte (máxima 44,9 °C), cae algo de lluvia y no hemos comprobado su geología frente a la de Nili Fossae.":
    "A 2 km window in the Red Sea Hills (Eastern Desert, Egypt; ~456 m elevation) with slopes very similar to those of a HiRISE image of layered rock in an eroded crater in Terra Sirenum: typical slope 12.1° vs 11.2°, p90 27.1° vs 27.0°, 43% of the terrain >15° vs 37% and relief of 151 m vs 160 m (similarity 98/100). At 10 and 30 km the reference is the carbonate-bearing plains of Nili Fossae and the similarity stays high (97/100 and 95/100), although the terrain there is much smoother (typical slope 3.2° at 10 km). It is 100% bare ground, with a mean of 26.9 °C, an annual minimum of 8.2 °C and 5 mm of rain a year (ERA5, 2025). After 11 searches in English, Arabic and French we found no studies that use this place as an analog; the published Egyptian analogs that came up are in the Western Desert, hundreds of km away. Where it fails: it is much hotter than Mars (maximum 44.9 °C), it gets some rain and we have not checked its geology against that of Nili Fossae.",
  "Borde norte del Changtang (Qiemo, Xinjiang, ~5.370 m), frío y parecido a Kasei Valles":
    "Northern edge of the Changtang (Qiemo, Xinjiang, ~5,370 m), cold and similar to Kasei Valles",
  "Ventana a unos 5.370 m de altitud en el condado de Qiemo (Xinjiang), en el Kunlun/Arka Tagh, borde norte del Changtang. A 2 km su relieve se parece al de una tesela HiRISE de material del extremo distal de un delta invertido (otro lugar de Marte, no Kasei): pendiente típica 5,4° frente a 4,5°; p90 15,6° frente a 14,6°; 47 % llano frente a 54 %; relieve 108 m frente a 102 m. Similitud de terreno: 97,5/100 a 2 km con esa tesela, 99,5/100 a 10 km con la tesela 3 del grupo «Kasei Valles: canales en una isla aerodinámica» y 94,6/100 a 30 km con el grupo entero. Suelo desnudo al 100 %, −10,3 °C de media, mínimas de −38,1 °C y 15,6 °C de oscilación diaria (ERA5, 2025). Como hipótesis nuestra, podría servir para ensayar movilidad de rovers y rutas en terreno suave y ondulado de valles y abanicos, con frío y altitud. Tras más de diez búsquedas en inglés y chino no hallamos estudios que lo usen como análogo; lo más cercano es la cuenca de Qaidam, a 600–800 km. Dónde falla: caen 368 mm al año, algo que Marte hoy no tiene, y el parecido es solo de forma, sin garantía de procesos de formación equivalentes.":
    "A window at about 5,370 m elevation in Qiemo County (Xinjiang), in the Kunlun/Arka Tagh, on the northern edge of the Changtang. At 2 km its relief resembles that of a HiRISE tile of material from the distal end of an inverted delta (another place on Mars, not Kasei): typical slope 5.4° vs 4.5°; p90 15.6° vs 14.6°; 47% flat vs 54%; relief 108 m vs 102 m. Terrain similarity: 97.5/100 at 2 km with that tile, 99.5/100 at 10 km with tile 3 of the group “Kasei Valles: channels on a streamlined island” and 94.6/100 at 30 km with the whole group. 100% bare ground, a mean of −10.3 °C, minimums of −38.1 °C and a daily temperature range of 15.6 °C (ERA5, 2025). As our own hypothesis, it could be used to rehearse rover mobility and routes over smooth, rolling valley and fan terrain, in the cold and at altitude. After more than ten searches in English and Chinese we found no studies that use it as an analog; the closest is the Qaidam Basin, 600–800 km away. Where it fails: it gets 368 mm of precipitation a year, something Mars does not have today, and the resemblance is only in shape, with no guarantee of equivalent formation processes.",
  "Llanura de Tim Mersoï (Níger, ~490 m), gemela de Meridiani Planum":
    "Tim Mersoï plain (Niger, ~490 m), twin of Meridiani Planum",
  "A 2 km, esta ventana de la llanura de Tim Mersoï (unos 100 km al norte de Arlit, Níger, ~490 m) es casi tan lisa como una ventana HiRISE de la región de Diacria, en Marte: pendiente típica 0,6° frente a 0,7°, p90 1,2° frente a 1,2°, 100 % llano en ambas y relieve de 13 m frente a 12 m (terreno 96/100). A mayor escala se parece a Meridiani Planum, junto al cráter Eagle de Opportunity: 98/100 a 30 km y 94/100 a 10 km. Es suelo desnudo al 100 %, con 29,9 °C de media, mínima de 7,2 °C, máxima de 46,7 °C y 18 mm de lluvia al año (ERA5, 2025). Meridiani es una llanura ecuatorial cuyas capas superiores son areniscas eólicas ricas en sulfatos (formación Burns, según la NASA). Tras unas 10 búsquedas en inglés, francés y árabe no encontramos estudios que usen este lugar como análogo; los análogos saharianos publicados (Ténéré, Ahnet, Tanezrouft) están a cientos de km. Dónde falla: la lluvia y los ~30 °C de media no son los de Marte, y no hemos comprobado que su roca se parezca a esas areniscas con sulfatos.":
    "At 2 km, this window on the Tim Mersoï plain (about 100 km north of Arlit, Niger, ~490 m) is almost as smooth as a HiRISE window in the Diacria region of Mars: typical slope 0.6° vs 0.7°, p90 1.2° vs 1.2°, 100% flat in both and relief of 13 m vs 12 m (terrain 96/100). At larger scales it resembles Meridiani Planum, next to Opportunity's Eagle crater: 98/100 at 30 km and 94/100 at 10 km. It is 100% bare ground, with a mean of 29.9 °C, a minimum of 7.2 °C, a maximum of 46.7 °C and 18 mm of rain a year (ERA5, 2025). Meridiani is an equatorial plain whose upper layers are sulfate-rich eolian sandstones (the Burns formation, according to NASA). After about 10 searches in English, French and Arabic we found no studies that use this place as an analog; the published Saharan analogs (Ténéré, Ahnet, Tanezrouft) are hundreds of km away. Where it fails: the rain and the ~30 °C mean are not those of Mars, and we have not checked that its rock resembles those sulfate-bearing sandstones.",
  // Bibliografía de los candidatos (results.json → literature.name / literature.note / known_analog;
  // vienen de pipeline/analogs/literature_v2.json). Algunas notas llegan cortadas desde los datos.
  "Majes (Pampa de Majes, junto al valle del río Siguas), provincia de Caylloma, región Arequipa, Perú":
    "Majes (Pampa de Majes, next to the Siguas River valley), Caylloma Province, Arequipa Region, Peru",
  "Provincia El Loa, Región de Antofagasta, Chile (Puna de Atacama, frontera con Salta, Argentina; entre el Salar de Arizaro y el volcán Socompa)":
    "El Loa Province, Antofagasta Region, Chile (Puna de Atacama, on the border with Salta, Argentina; between the Salar de Arizaro and the Socompa volcano)",
  "Provincia Sur Lípez, Departamento de Potosí, Bolivia (altiplano sudoeste, cerca de la frontera con Chile)":
    "Sur Lípez Province, Potosí Department, Bolivia (southwestern Altiplano, near the border with Chile)",
  "Bajsh central del condado de Golshan (antes Jaleq, cerca de Saravan), provincia de Sistán y Baluchistán, Irán, junto a la frontera con Pakistán. El Hamun-i-Mashkel, una cuenca endorreica seca, está a unos 60–80 km al noreste, en Pakistán.":
    "Central District of Golshan County (formerly Jaleq, near Saravan), Sistan and Baluchestan Province, Iran, next to the border with Pakistan. The Hamun-i-Mashkel, a dry endorheic basin, lies about 60–80 km to the northeast, in Pakistan.",
  "Cerca de Arlit, región de Agadez, Níger (llanura de Tim Mersoï, entre el macizo del Aïr y la frontera argelina; Sáhara central)":
    "Near Arlit, Agadez Region, Niger (Tim Mersoï plain, between the Aïr Mountains and the Algerian border; central Sahara)",
  "Condado de Gêrzê (改则县), prefectura de Ngari (阿里地区), Región Autónoma del Tíbet, China. Altiplano de Changtang/Qiangtang; cerca de los lagos Purga Co (~11 km), Kangma Tso/Gangma Co (~8 km) y Cêmar Co (~27 km), del pico Gangma Ri (~19 km) y de Tauxing Co (~37 km)":
    "Gêrzê County (改则县), Ngari Prefecture (阿里地区), Tibet Autonomous Region, China. Changtang/Qiangtang plateau; near the lakes Purga Co (~11 km), Kangma Tso/Gangma Co (~8 km) and Cêmar Co (~27 km), the Gangma Ri peak (~19 km) and Tauxing Co (~37 km)",
  "Condado de Qiemo (且末县), Prefectura de Bayingolin, Xinjiang, China; Kunlun/Arka Tagh en el borde norte del Changtang, frontera Xinjiang-Tíbet":
    "Qiemo County (且末县), Bayingolin Prefecture, Xinjiang, China; Kunlun/Arka Tagh on the northern edge of the Changtang, on the Xinjiang–Tibet border",
  "Cuenca de Mouydir (Sahara central), provincia de Tamanrasset, Argelia":
    "Mouydir basin (central Sahara), Tamanrasset Province, Algeria",
  "Daïra de In Guezzam, Provincia de Tamanrasset, Argelia (llanura de la Tamesna, cerca de la frontera con Níger)":
    "In Guezzam daïra, Tamanrasset Province, Algeria (Tamesna plain, near the border with Niger)",
  "Daïra de Tazrouk, wilaya de Tamanrasset, Argelia (Sahara central, flanco oriental del macizo del Hoggar/Ahaggar)":
    "Tazrouk daïra, Tamanrasset wilaya, Algeria (central Sahara, eastern flank of the Hoggar/Ahaggar massif)",
  "Dehestán Kavir, distrito de Dehuk (Deyhuk), condado de Tabas, provincia de Jorasán del Sur, Irán (zona desértica entre el Dasht-e Kavir y el extremo norte del bloque de Lut, cerca de Naybandan)":
    "Kavir Rural District, Dehuk (Deyhuk) District, Tabas County, South Khorasan Province, Iran (desert area between the Dasht-e Kavir and the northern end of the Lut block, near Naybandan)",
  "Dehestán de Ashar, distrito de Ashar, condado de Mehrestán (Zaboli), provincia de Sistán y Baluchistán, Irán (montañas del Makrán interior, cerca de la frontera con Pakistán)":
    "Ashar Rural District, Ashar District, Mehrestan (Zaboli) County, Sistan and Baluchestan Province, Iran (inner Makran mountains, near the border with Pakistan)",
  "Departamento Iglesia, provincia de San Juan, Argentina (Cordillera Frontal andina, cerca de la frontera con la Región de Atacama, Chile)":
    "Iglesia Department, San Juan Province, Argentina (Andean Frontal Cordillera, near the border with the Atacama Region, Chile)",
  "Departamento de Iglesia, San Juan, Argentina (alta cordillera, cerca del Valle del Cura)":
    "Iglesia Department, San Juan, Argentina (high cordillera, near the Valle del Cura)",
  "Distrito de Kufra (Al Kufrah), Libia; zona del Mar de Arena de Rebiana (Rabyanah), Sahara oriental":
    "Kufra District (Al Kufrah), Libya; Rebiana (Rabyanah) Sand Sea area, eastern Sahara",
  "Distrito de Murzuq (Fezzan), sureste del Sahara libio, Libia (Nominatim: Murzuq, Libia)":
    "Murzuq District (Fezzan), southeastern Libyan Sahara, Libya (Nominatim: Murzuq, Libya)",
  "Distrito de Tazrouk, provincia de Tamanrasset, Argelia (macizo del Hoggar/Ahaggar y cuenca de Amadror, Sahara central)":
    "Tazrouk District, Tamanrasset Province, Algeria (Hoggar/Ahaggar massif and Amadror basin, central Sahara)",
  "Estado del Nilo (River Nile State), Sudán. Es el desierto de Nubia, entre el meandro del Nilo y el Mar Rojo, según Nominatim (solo devolvió región y país).":
    "River Nile State, Sudan. It is the Nubian Desert, between the bend of the Nile and the Red Sea, according to Nominatim (which only returned the region and country).",
  "Gobernación de Al Quwayiyah, región de Riad, Arabia Saudita (meseta de Néyed/Najd, cerca del escarpe de Jabal Tuwaiq)":
    "Al Quwayiyah Governorate, Riyadh Region, Saudi Arabia (Najd plateau, near the Jabal Tuwaiq escarpment)",
  "Gobernación de Sinaí del Sur (جنوب سيناء), Egipto; zona interior del Sinaí occidental, al este del golfo de Suez (región de Ras Sudr / meseta de Tih; ubicación aproximada, no confirmada por el geocodificador)":
    "South Sinai Governorate (جنوب سيناء), Egypt; inland western Sinai, east of the Gulf of Suez (Ras Sudr / Tih plateau area; approximate location, not confirmed by the geocoder)",
  "Gobernación del Mar Rojo (Al-Bahr al-Ahmar), Egipto (Desierto Oriental, zona fronteriza con Sudán; cerca de Shalatin y Halaib)":
    "Red Sea Governorate (Al-Bahr al-Ahmar), Egypt (Eastern Desert, border area with Sudan; near Shalatin and Halaib)",
  "Gobernación del Mar Rojo (البحر الأحمر), Egipto: Desierto Oriental sur, colinas del Mar Rojo (escudo Árabe-Nubio)":
    "Red Sea Governorate (البحر الأحمر), Egypt: southern Eastern Desert, Red Sea Hills (Arabian-Nubian Shield)",
  "Hoggar oriental (macizo del Ahaggar, zona de Tassili n'Ahaggar / escudo tuareg), daïra de Tazrouk, wilaya de Tamanrasset, Argelia":
    "Eastern Hoggar (Ahaggar massif, Tassili n'Ahaggar area / Tuareg Shield), Tazrouk daïra, Tamanrasset wilaya, Algeria",
  "Meseta de Djado, departamento de Bilma, Níger":
    "Djado Plateau, Bilma Department, Niger",
  "Norte de Niger (región de Agadez, zona de Bilma/Djado), cerca de la frontera con Libia (Tummo/Toummo), Sahara central":
    "Northern Niger (Agadez Region, Bilma/Djado area), near the border with Libya (Tummo/Toummo), central Sahara",
  "Provincia de El Loa, Región de Antofagasta, Chile (Nominatim; unos 67 km al norte de Calama, cuenca alta del Río Loa, flanco oriental del desierto de Atacama)":
    "El Loa Province, Antofagasta Region, Chile (Nominatim; about 67 km north of Calama, upper Loa River basin, eastern flank of the Atacama Desert)",
  "Provincia de Tamanrasset (Hoggar occidental / Sahara central), Argelia (DZ-11)":
    "Tamanrasset Province (western Hoggar / central Sahara), Algeria (DZ-11)",
  "Provincia de Tamanrasset (Tamanghasset), Argelia, Sahara central, al norte del macizo del Hoggar (zona del Mouydir/Amguid, aprox.)":
    "Tamanrasset (Tamanghasset) Province, Algeria, central Sahara, north of the Hoggar massif (Mouydir/Amguid area, approx.)",
  "Provincia del Tamarugal, Región de Tarapacá, Chile (Precordillera al NE de Pica y al O del Salar de Huasco; borde oriental de la Pampa del Tamarugal)":
    "Tamarugal Province, Tarapacá Region, Chile (Precordillera NE of Pica and W of the Salar de Huasco; eastern edge of the Pampa del Tamarugal)",
  "Sévrei (Сэврэй), provincia de Ömnögovi (Gobi Sur), Mongolia":
    "Sévrei (Сэврэй), Ömnögovi (South Gobi) Province, Mongolia",
  "Tehsil Jhal Jhao, distrito de Awaran (antes Kolwa), división de Kalat, Balochistán, Pakistán. Está en el Makran central, entre las cordilleras áridas del Makran Central/Siahan y los valles de Kolwa y Mashkai.":
    "Jhal Jhao Tehsil, Awaran District (formerly Kolwa), Kalat Division, Balochistan, Pakistan. It lies in the central Makran, between the arid Central Makran/Siahan ranges and the Kolwa and Mashkai valleys.",
  "Búsqueda breve (3 consultas, en inglés y español): no aparece ningún estudio que use esta zona como análogo lunar o marciano; los trabajos del Valle del Cura son de geología y geotermia. Los análogos andinos publicados están en la Puna (Catamarca, Salta, Jujuy) y en Atacama, a más de 300 km.":
    "Brief search (3 queries, in English and Spanish): no study comes up that uses this area as a lunar or Martian analog; the work on the Valle del Cura is about geology and geothermal energy. The published Andean analogs are in the Puna (Catamarca, Salta, Jujuy) and in the Atacama, more than 300 km away.",
  "Búsqueda breve (3 consultas, en inglés y francés): no aparece ningún estudio que use la meseta de Djado como análogo planetario. Hay trabajos regionales sobre el Teneré (huellas de remolinos de polvo, 2004; dunas lineales) que no sitúan su zona de estudio en este punto.":
    "Brief search (3 queries, in English and French): no study comes up that uses the Djado Plateau as a planetary analog. There is regional work on the Ténéré (dust devil tracks, 2004; linear dunes) that does not place its study area at this point.",
  "Con 10 búsquedas en inglés, árabe y francés no encontré ningún estudio que use o proponga este punto del desierto de Nubia (Sudán) ni uno a menos de 75 km como análogo lunar, marciano o astrobiológico. Solo aparecen análogos de Marte del Sahara oriental, como los del Desierto Occidental de Egipto, Gilf Kebir y Uweinat, a cientos de km. No abrí esas fuentes, así que no las cito. No encontré ninguna referencia a Chang'e-3 para este lugar, y en la ventana domina arenisca nubia, no basalto lunar.":
    "With 10 searches in English, Arabic and French we found no study that uses or proposes this point in the Nubian Desert (Sudan), or one within 75 km, as a lunar, Martian or astrobiological analog. Only Mars analogs in the eastern Sahara come up, such as those in Egypt's Western Desert, Gilf Kebir and Uweinat, hundreds of km away. We did not open those sources, so we do not cite them. We found no reference to Chang'e-3 for this place, and the window is dominated by Nubian sandstone, not lunar basalt.",
  "El candidato cae en el distrito de Murzuq (Libia, Sahara central-oriental), entre el Idehan Murzuq y el campo volcánico de Haruj. No encontré ningún estudio que trate este punto o un lugar a menos de 75 km como análogo planetario. El único estudio de análogos cercano es de Marte, no de la Luna: Wau-an-Namus (24.92N, 17.76E, unos 127 km al SE) como análogo de megarriples/TAR marcianos (Foroutan et al. 2019, Icarus). Solo pude hacer 2 búsquedas efectivas (ambas en inglés), y no se hicieron las del idioma local ni las de Haruj, Murzuq o Qatrun. Por eso la dejo como «sin verificar» y no como «no encontrado». Tampoco hallé nada específicamente lunar (análogo del polo sur o de Chang'e-6) para esta zona. Una segunda revisión independiente no lo confirmó: la página enlazada solo trae la cita del artículo (Icarus 319, 840-851, 2019) y Wau-an-Namus queda a unos 115-127 km del candidato, fuera del radio de 75 km.":
    "The candidate falls in Murzuq District (Libya, central-eastern Sahara), between the Idehan Murzuq and the Haruj volcanic field. We found no study that treats this point, or a place within 75 km, as a planetary analog. The only nearby analog study is about Mars, not the Moon: Wau-an-Namus (24.92N, 17.76E, about 127 km to the SE) as an analog of Martian megaripples/TARs (Foroutan et al. 2019, Icarus). We could only run 2 effective searches (both in English), and the searches in the local language and those for Haruj, Murzuq or Qatrun were not done. That is why we leave it as “not verified” rather than “not found”. Nor did we find anything specifically lunar (a south pole or Chang'e-6 analog) for this area. A second independent check did not confirm it: the linked page only has the article's citation (Icarus 319, 840-851, 2019), and Wau-an-Namus is about 115-127 km from the candidate, outside the 75 km radius.",
  "El candidato está en Jhal Jhao (distrito de Awaran, Balochistán, Pakistán). Hice 7 búsquedas web en inglés y urdu y no encontré ningún estudio que use este lugar, ni otro a menos de 75 km, como análogo de la Luna, de Marte o de astrobiología. Lo más cercano son menciones divulgativas sin base científica: el Parque Nacional de Hingol y los volcanes de lodo de la costa de Makran (unos 180-200 km). También hay un simulante de regolito marciano hecho con basalto de Winder Nai (Lasbela, unos 190 km), un estudio de materiales y no de análogo de sitio. Los análogos regionales publicados están en otros lugares: Kachchh (India), y las montañas marcianas de Chabahar y los análogos de Omán, todos de Marte y a más de 75 km.":
    "The candidate is in Jhal Jhao (Awaran District, Balochistan, Pakistan). We ran 7 web searches in English and Urdu and found no study that uses this place, or another within 75 km, as a Moon, Mars or astrobiology analog. The closest are popular mentions with no scientific basis: Hingol National Park and the mud volcanoes of the Makran coast (about 180-200 km). There is also a Martian regolith simulant made from Winder Nai basalt (Lasbela, about 190 km), a materials study rather than a site analog study. The published regional analogs are elsewhere: Kachchh (India), and the Martian mountains of Chabahar and the Oman analogs, all for Mars and more than 75 km away.",
  "El candidato está en Sur Lípez (Potosí, Bolivia), a unos 30 km de Laguna Verde y a unos 38 km del Licancabur. Esa zona es un análogo de Marte conocido: el High Lakes Project de NASA/SETI (N. Cabrol, desde 2002-2003) estudia allí lagos de gran altitud como análogos de los lagos marcianos antiguos. Los estudios abiertos tratan la región (lagos Blanca y Verde, Licancabur), no la ventana exacta de 10 km. Una fuente sobre la expedición de 2005 (wingswomenofdiscovery.org) menciona el campo geotérmico Sol de Mañana (unos 30 km), pero no pude leer el PDF, así que no lo cuento como verificado. No encontré estudios de Laguna Colorada, Salar de Chalviri o Polques como análogos. El estudio EPSC2021 (Puna chilena, unos 450 km) es solo contexto y no cuenta para el criterio. Verificación independiente: confirmado (High Lakes Project: from early Mars to today's Earth (NASA Astrobiology Institute, Lyn Bartlett, 2008)).":
    "The candidate is in Sur Lípez (Potosí, Bolivia), about 30 km from Laguna Verde and about 38 km from Licancabur. That area is a known Mars analog: the NASA/SETI High Lakes Project (N. Cabrol, since 2002-2003) studies its high-altitude lakes as analogs of ancient Martian lakes. The open studies cover the region (Laguna Blanca and Laguna Verde, Licancabur), not the exact 10 km window. A source on the 2005 expedition (wingswomenofdiscovery.org) mentions the Sol de Mañana geothermal field (about 30 km), but we could not read the PDF, so we do not count it as verified. We found no studies of Laguna Colorada, Salar de Chalviri or Polques as analogs. The EPSC2021 study (Chilean Puna, about 450 km) is context only and does not count for the criterion. Independent verification: confirmed (High Lakes Project: from early Mars to today's Earth (NASA Astrobiology Institute, Lyn Bartlett, 2008)).",
  "El candidato está en la Pampa de Majes, junto al río Siguas, en Arequipa (Perú). Queda dentro de la franja con la que Valdivia-Silva y colaboradores (NASA Ames/UNAM) definen el desierto de Pampas de La Joya (16-17°S, 71,5-72,5°W, 1000-2000 m), un análogo de suelo marciano ya publicado. Su zona central de muestreo, el 'Mar de Cuarzo', está a unos 50-55 km al sur, en la misma pampa hiperárida de la Formación Moquegua. No encontré estudios sobre la Pampa de Majes en sí, que además tiene mucha agricultura de riego (Majes-Siguas); tampoco pruebas de rovers ni estudios de análogos lunares: todos los análogos encontrados son de Marte, aunque el ranking lo propone como análogo de la Luna. El enlace funciona; la segunda verificación independiente quedó pendiente.":
    "The candidate is in the Pampa de Majes, next to the Siguas River, in Arequipa (Peru). It lies within the band that Valdivia-Silva and colleagues (NASA Ames/UNAM) use to define the Pampas de La Joya desert (16-17°S, 71.5-72.5°W, 1000-2000 m), an already published analog of Martian soil. Their central sampling area, the 'Mar de Cuarzo', is about 50-55 km to the south, in the same hyperarid pampa of the Moquegua Formation. We found no studies of the Pampa de Majes itself, which also has a lot of irrigated agriculture (Majes-Siguas), nor rover tests or lunar analog studies: all the analogs found are for Mars, although the ranking proposes it as a Moon analog. The link works; the second independent check is still pending.",
  "El punto cae en Sévrei, Ömnögovi (Mongolia). Solo hay indicios: el proyecto MARS-V (ONG mongola, con la Mars Society) planea una estación análoga de Marte en el Gobi (Dundgovi y Ömnögovi), pero ninguna fuente abierta da el sitio exacto, así que no pude confirmar que esté a menos de 75 km. No hallé estudios científicos ni resúmenes de LPSC/ADS sobre este lugar, ni nada de análogo lunar. Todo lo hallado es de Marte y de prensa o divulgación. Una segunda revisión independiente no lo confirmó: las tres fuentes (Universe Magazine, 2025; comunicado de la Mars Society, 2023; columna de la Yale Review of International Studies, 2024) son prensa, un anuncio y una opinión; ninguna da un sitio ni coordenadas, y como Dundgovi y Ömnögovi abarcan cientos de km, no se puede saber si la estación quedaría a menos de 75 km de Sévrei.":
    "The point falls in Sévrei, Ömnögovi (Mongolia). There are only hints: the MARS-V project (a Mongolian NGO, with the Mars Society) plans a Mars analog station in the Gobi (Dundgovi and Ömnögovi), but no open source gives the exact site, so we could not confirm that it is within 75 km. We found no scientific studies or LPSC/ADS abstracts about this place, and nothing about a lunar analog. Everything found is about Mars and comes from the press or popular outreach. A second independent check did not confirm it: the three sources (Universe Magazine, 2025; a Mars Society release, 2023; a Yale Review of International Studies column, 2024) are press coverage, an announcement and an opinion piece; none gives a site or coordinates, and since Dundgovi and Ömnögovi span hundreds of km, there is no way to tell whether the station would be within 75 km of Sévrei.",
  "El punto cae en el distrito de Tazrouk (Tamanrasset, Argelia), al este del macizo volcánico del Hoggar (Ahaggar), en la zona de la cuenca de Amadror. Tras 11 búsquedas en inglés, francés y árabe no encontré ningún estudio que use o proponga este lugar, ni otro a menos de 75 km, como análogo lunar o marciano. Tampoco encontré pruebas de rovers ni astrobiología en la zona. Lo más cercano son estudios de OTROS sitios saharianos, todos lejos: la cuenca de Ahnet (resumen EPSC-DPS 2025, análogo de Marte, que abrí) y la sal plana de Tanezrouft (proyecto AZALEA, EANA 2024, que solo vi en los resultados de búsqueda). Ambos están a cientos de km, fuera del criterio. La NASA bautizó cuadrantes de Marte con parques argelinos (Tassili n'Ajjer, Ghoufi, Djurdjura), pero es una nomenclatura inspirada en el parecido visual, no un estudio de análogo, y no incluye el Hoggar. No pude abrir la página de Marsdaily (demasiadas redirecciones); usé Arab News.":
    "The point falls in Tazrouk District (Tamanrasset, Algeria), east of the volcanic Hoggar (Ahaggar) massif, in the Amadror basin area. After 11 searches in English, French and Arabic we found no study that uses or proposes this place, or another within 75 km, as a lunar or Martian analog. Nor did we find rover tests or astrobiology in the area. The closest are studies of OTHER Saharan sites, all far away: the Ahnet basin (EPSC-DPS 2025 abstract, Mars analog, which we opened) and the Tanezrouft salt flat (AZALEA project, EANA 2024, which we only saw in search results). Both are hundreds of km away, outside the criterion. NASA named quadrangles of Mars after Algerian parks (Tassili n'Ajjer, Ghoufi, Djurdjura), but that is naming inspired by visual resemblance, not an analog study, and it does not include the Hoggar. We could not open the Marsdaily page (too many redirects); we used Arab News.",
  "El punto cae en la Puna de Atacama (Chile, cerca del límite con Argentina), a unos 44 km del volcán Socompa. Allí, Schmidt et al. 2018 propone los suelos de tefra de las cumbres volcánicas (Socompa y Llullaillaco) como análogo de Marte, y Farías et al. 2013 estudia estromatolitos de la Laguna Socompa como análogo de la Tierra temprana, sin Marte. Ningún estudio abierto trata el salar del candidato en sí. No hay nada específico de análogo lunar, y el paisaje de cumbre volcánica no es el mismo que el del salar. Llullaillaco queda a unos 89 km, fuera del radio. Los textos que hablan de «paisaje marciano» en Arizaro o Tolar Grande son solo prensa de viajes. Verificación independiente: confirmado (Life at extreme elevations on Atacama volcanoes: the closest thing to Mars on Earth? (Schmidt et al., 2018)).":
    "The point falls in the Puna de Atacama (Chile, near the border with Argentina), about 44 km from the Socompa volcano. There, Schmidt et al. 2018 propose the tephra soils of the volcanic summits (Socompa and Llullaillaco) as a Mars analog, and Farías et al. 2013 study the stromatolites of Laguna Socompa as an early-Earth analog, without Mars. No open study deals with the candidate's salt flat itself. There is nothing specific about a lunar analog, and the volcanic summit landscape is not the same as that of the salt flat. Llullaillaco is about 89 km away, outside the radius. The texts that speak of a “Martian landscape” in Arizaro or Tolar Grande are only travel journalism. Independent verification: confirmed (Life at extreme elevations on Atacama volcanoes: the closest thing to Mars on Earth? (Schmidt et al., 2018)).",
  "El punto cae en la llanura de la Tamesna (daïra de In Guezzam, sur de Argelia, unos 70 km al NNE de In Guezzam). Tras 12 búsquedas (inglés, francés y árabe) no hay ningún estudio que use o proponga este lugar, ni otro a menos de 75 km, como análogo planetario o sitio de pruebas. Los análogos saharianos publicados están lejos: cuenca de Ahnet y salares del Tanezrouft (cientos de km al norte), pruebas de rovers en Marruecos, y rastros de dust devils en el Ténéré (Níger, lejos al este). El único texto que une la Tamesna con Marte es un relato de caza de meteoritos de 2002 (meteorite-recon.com), que abrí: usa imágenes de Marte solo como referencia geomorfológica y no es un estudio de análogo planetario. Genéricos como \"el Sahara es un análogo de Marte\" (EGU2018, IMS2016) no nombran este lugar; el PDF del EGU2018 no pude leerlo y la página de IMS2016 no cargó.":
    "The point falls on the Tamesna plain (In Guezzam daïra, southern Algeria, about 70 km NNE of In Guezzam). After 12 searches (English, French and Arabic) there is no study that uses or proposes this place, or another within 75 km, as a planetary analog or test site. The published Saharan analogs are far away: the Ahnet basin and the Tanezrouft salt flats (hundreds of km to the north), rover tests in Morocco, and dust devil tracks in the Ténéré (Niger, far to the east). The only text linking the Tamesna with Mars is an account of a 2002 meteorite hunt (meteorite-recon.com), which we opened: it uses images of Mars only as a geomorphological reference and is not a planetary analog study. Generic statements such as “the Sahara is a Mars analog” (EGU2018, IMS2016) do not name this place; we could not read the EGU2018 PDF and the IMS2016 page did not load.",
  "El punto cae en la precordillera de Tarapacá (Chile), a unos 36 km al oeste del Salar de Huasco y cerca de Pica y Mamiña. No encontré ningún estudio abierto que lo use, ni a un lugar de paisaje similar a menos de 75 km, como análogo de la Luna o de Marte. Lo más cercano son un estudio microbiológico del Salar de Huasco (36 km) que lo describe como modelo para vida en otros planetas, y un estudio de análogo marciano en la Pampa del Tamarugal (89 km). Ninguno es del mismo paisaje, y no hallé nada de análogo lunar en la zona. Hay mucha literatura de Atacama como análogo de Marte, pero se refiere a Yungay y al núcleo hiperárido más al sur.":
    "The point falls in the Tarapacá Precordillera (Chile), about 36 km west of the Salar de Huasco and near Pica and Mamiña. We found no open study that uses it, or a place with a similar landscape within 75 km, as a Moon or Mars analog. The closest are a microbiological study of the Salar de Huasco (36 km) that describes it as a model for life on other planets, and a Martian analog study in the Pampa del Tamarugal (89 km). Neither is the same landscape, and we found nothing about a lunar analog in the area. There is a large literature on the Atacama as a Mars analog, but it refers to Yungay and the hyperarid core farther south.",
  "El punto está en el norte del condado de Gêrzê (Ngari, Tíbet), en el altiplano de Changtang, junto a los lagos Purga Co y Kangma Tso. Tras 8 búsquedas en inglés y chino no encontré ningún estudio que use este lugar, ni nada a menos de 75 km, como análogo lunar o planetario. Los análogos de Marte ya conocidos en la meseta tibetana están en la cuenca de Qaidam (Dalangtan, Lenghu), a más de 600 km. Una nota de 2016 (Rodriguez, PSI) habla de lagos tibetanos de alta montaña como análogo de Marte, pero no dice cuáles, así que no puedo relacionarla con este punto. No apareció ningún estudio como análogo de la Luna.":
    "The point is in the north of Gêrzê County (Ngari, Tibet), on the Changtang plateau, next to the lakes Purga Co and Kangma Tso. After 8 searches in English and Chinese we found no study that uses this place, or anything within 75 km, as a lunar or planetary analog. The known Mars analogs on the Tibetan Plateau are in the Qaidam Basin (Dalangtan, Lenghu), more than 600 km away. A 2016 note (Rodriguez, PSI) talks about high-mountain Tibetan lakes as a Mars analog, but does not say which ones, so we cannot relate it to this point. No study came up as a Moon analog.",
  "Hice 7 búsquedas en inglés y persa y no encontré ningún estudio que use o proponga la zona de Golshan/Jaleq–Saravan, ni el Hamun-i-Mashkel cercano, como análogo de la Luna, de Marte o de astrobiología. En la misma provincia solo salieron las \"montañas marcianas\" de Chabahar, que son un sitio turístico y no de investigación y están a más de 300 km, y en otra provincia el desierto de Lut, un análogo de Marte (crestas eólicas) a más de 300 km. Ninguno de los dos cuenta para este candidato.":
    "We ran 7 searches in English and Persian and found no study that uses or proposes the Golshan/Jaleq–Saravan area, or the nearby Hamun-i-Mashkel, as a Moon, Mars or astrobiology analog. In the same province only the “Martian mountains” of Chabahar came up, which are a tourist site rather than a research site and are more than 300 km away, and in another province the Lut Desert, a Mars analog (aeolian ridges) more than 300 km away. Neither counts for this candidate.",
  "Hice 8 búsquedas en inglés y en persa y no encontré ningún estudio que use esta zona como análogo lunar, marciano o astrobiológico, ni ninguna otra a menos de 75 km (distrito de Dehuk, condado de Tabas, cerca de Naybandan). Los análogos iraníes que sí existen son de Marte, no de la Luna: las megaondulaciones o TAR y los yardangs del desierto de Lut, y el ecoturismo «marciano» del Lut. Están en el Lut central, a más de unos 150 km, y no pude abrir esos artículos, así que esa distancia es una estimación. El Geoparque de Tabas (UNESCO) incluye Nayband, pero no encontré ninguna fuente que lo trate como análogo planetario.":
    "We ran 8 searches in English and Persian and found no study that uses this area, or any other within 75 km, as a lunar, Martian or astrobiological analog (Dehuk District, Tabas County, near Naybandan). The Iranian analogs that do exist are for Mars, not the Moon: the megaripples or TARs and the yardangs of the Lut Desert, and the “Martian” ecotourism of the Lut. They are in the central Lut, more than about 150 km away, and we could not open those articles, so that distance is an estimate. The Tabas Geopark (UNESCO) includes Nayband, but we found no source that treats it as a planetary analog.",
  "Hice 9 búsquedas válidas en inglés, árabe y francés y no encontré ningún estudio, propuesta de análogo ni sitio de pruebas de rovers en este punto ni a menos de 75 km. Las referencias de análogos de Marte en el Sahara libio-egipcio (Wau-an-Namus, Gilf Kebir/Uweinat) están a unos 450 km, y solo las vi en resultados de búsqueda. Una página de NASA Earth Observatory sobre Kufra confirma que no menciona Marte, y el catálogo ESA/CAFE devolvió error 403/404, así que no pude comprobarlo. No llegué a buscar directamente en Google Scholar, ADS ni LPSC, así que la conclusión es provisional.":
    "We ran 9 valid searches in English, Arabic and French and found no study, analog proposal or rover test site at this point or within 75 km. The references to Mars analogs in the Libyan-Egyptian Sahara (Wau-an-Namus, Gilf Kebir/Uweinat) are about 450 km away, and we only saw them in search results. A NASA Earth Observatory page on Kufra confirms it does not mention Mars, and the ESA/CAFE catalog returned a 403/404 error, so we could not check it. We did not get to search Google Scholar, ADS or LPSC directly, so the conclusion is provisional.",
  "No encontré ningún estudio que proponga o use este lugar (unos 100 km al norte de Arlit, Níger) ni otro a menos de ~75 km como análogo planetario, sitio de pruebas de rovers o sitio de astrobiología. Tras 9 búsquedas en inglés, francés y árabe, solo salen estudios de otros paisajes. Uno es el de las dunas del Ténéré como análogo de Marte y Titán (otro cuerpo, unos 300 km al este de forma aproximada). Otros son el Ahnet y el Tanezrouft en Argelia, a más de 500 km. Un relato de una expedición de meteoritos en la llanura de Tim Mersoï usó imágenes de Marte para elegir superficies antiguas, pero es un texto informal y no una propuesta de análogo. No pude abrir el catálogo de análogos de Foucher et al. (2021) ni el resumen de EGU2018 (acceso denegado o PDF ilegible), así que no puedo descartar que mencionen la zona.":
    "We found no study that proposes or uses this place (about 100 km north of Arlit, Niger), or another within ~75 km, as a planetary analog, rover test site or astrobiology site. After 9 searches in English, French and Arabic, only studies of other landscapes come up. One is about the Ténéré dunes as an analog of Mars and Titan (another body; roughly 300 km to the east). Others are the Ahnet and the Tanezrouft in Algeria, more than 500 km away. An account of a meteorite expedition on the Tim Mersoï plain used images of Mars to choose ancient surfaces, but it is an informal text and not an analog proposal. We could not open the analog catalog of Foucher et al. (2021) or the EGU2018 abstract (access denied or unreadable PDF), so we cannot rule out that they mention the area.",
  "No encontré ningún estudio que use este punto del Hoggar oriental (daïra de Tazrouk, Tamanrasset), ni nada a menos de 75 km, como análogo lunar, marciano o astrobiológico, tras 8 búsquedas en inglés, francés y árabe. Lo único científico que apareció es un resumen de EPSC 2025 sobre la cuenca de Ahnet como análogo de Marte, a unos 700 km, así que no cubre el candidato. También salió la noticia de que la NASA puso a zonas de Marte el nombre del parque Tassili n'Ajjer, pero es solo un nombre por parecido visual, no un estudio. Ninguna fuente trata el sitio como análogo del polo sur lunar, que es para lo que aparece en el ranking.":
    "We found no study that uses this point in the eastern Hoggar (Tazrouk daïra, Tamanrasset), or anything within 75 km, as a lunar, Martian or astrobiological analog, after 8 searches in English, French and Arabic. The only scientific item that came up is an EPSC 2025 abstract on the Ahnet basin as a Mars analog, about 700 km away, so it does not cover the candidate. News also came up that NASA named areas of Mars after the Tassili n'Ajjer park, but that is only a name based on visual resemblance, not a study. No source treats the site as an analog of the lunar south pole, which is what it appears for in the ranking.",
  "No encontré ningún estudio que use o proponga este lugar (ni uno a menos de ~75 km) como análogo planetario, sitio de pruebas de rovers o sitio astrobiológico, tras 11 búsquedas en inglés y español y la apertura de la lista de análogos de Wikipedia, la página de Europlanet para los Andes argentinos y una nota de Diario de Cuyo. Los análogos andinos que aparecen quedan más lejos y son de Marte, no de la Luna: el resumen EPSC2026-939 (glaciares de roca de Dos Lenguas, en la cuenca alta de Agua Negra a ~30°S, unos 150 km al sur; no verifiqué sus coordenadas), el volcán Ojos del Salado, Laguna Verde y el Salar de Maricunga (más de 200 km al norte), el proyecto Solar54 en La Rioja y la Puna de Catamarca. Los dos últimos los vi solo en fragmentos de búsqueda, no abrí sus fuentes. Tampoco hay análogos lunares documentados en la zona. Las coordenadas de algunos sitios las estimé de memoria.":
    "We found no study that uses or proposes this place (or one within ~75 km) as a planetary analog, rover test site or astrobiological site, after 11 searches in English and Spanish and after opening Wikipedia's list of analogs, the Europlanet page for the Argentine Andes and an article in Diario de Cuyo. The Andean analogs that come up are farther away and are for Mars, not the Moon: the EPSC2026-939 abstract (rock glaciers of Dos Lenguas, in the upper Agua Negra basin at ~30°S, about 150 km to the south; we did not check its coordinates), the Ojos del Salado volcano, Laguna Verde and the Salar de Maricunga (more than 200 km to the north), the Solar54 project in La Rioja and the Puna de Catamarca. We only saw the last two in search snippets and did not open their sources. There are no documented lunar analogs in the area either. We estimated the coordinates of some sites from memory.",
  "No encontré ningún estudio que use o proponga este lugar (o uno a menos de 75 km) como análogo lunar, marciano o astrobiológico, tras 7 búsquedas en inglés, francés y árabe. Lo más cercano son análogos marcianos argelinos lejanos: la cuenca de Ahnet (resumen EPSC 2025, abierto, unos 230 km estimados) y los salares de Tanezrouft (proyecto AZALEA, a cientos de km, no abierto). El cráter de impacto de Amguid (unos 100 km al norte) tiene estudios de mineralogía de impacto pero ninguno lo plantea como análogo planetario. No llegué a buscar directamente en LPSC ni ADS, así que es una ausencia de evidencia, no una prueba definitiva.":
    "We found no study that uses or proposes this place (or one within 75 km) as a lunar, Martian or astrobiological analog, after 7 searches in English, French and Arabic. The closest are distant Algerian Martian analogs: the Ahnet basin (EPSC 2025 abstract, opened, an estimated 230 km away) and the Tanezrouft salt flats (AZALEA project, hundreds of km away, not opened). The Amguid impact crater (about 100 km to the north) has studies of impact mineralogy, but none presents it as a planetary analog. We did not get to search LPSC or ADS directly, so this is an absence of evidence, not definitive proof.",
  "No encontré ningún estudio verificado que use o proponga este punto (ni un paisaje equivalente a menos de 75 km) como análogo planetario, sitio de pruebas de rovers o sitio astrobiológico, tras 11 búsquedas en inglés y chino. Lo único cercano en la literatura de análogos del norte del Tíbet es la cuenca de Qaidam (p. ej. Anglés y Li 2017 en JGR Planets; Xiao et al. 2017 en Earth-Science Reviews), pero está a unos 600-800 km, así que no cuenta como estudio de este lugar. La Wikipedia de análogos de hábitat marciano solo cita Qaidam (37,27N, 94,45E) para esta región. No abrí ninguno de esos trabajos de Qaidam.":
    "We found no verified study that uses or proposes this point (or an equivalent landscape within 75 km) as a planetary analog, rover test site or astrobiological site, after 11 searches in English and Chinese. The only nearby item in the analog literature for northern Tibet is the Qaidam Basin (e.g. Anglés and Li 2017 in JGR Planets; Xiao et al. 2017 in Earth-Science Reviews), but it is about 600-800 km away, so it does not count as a study of this place. Wikipedia's page on Martian habitat analogs only cites Qaidam (37.27N, 94.45E) for this region. We did not open any of those Qaidam papers.",
  "No hallé ningún estudio que use o proponga este punto (ni uno a menos de 75 km) como análogo de la Luna o de Marte, tras 11 búsquedas en inglés y español y la apertura de varias fuentes. Lo más cercano es el Salar de Ascotán, a unos 77 km, con solo una nota de prensa que lo vincula con la astrobiología. Los análogos del Atacama bien documentados (Yungay, María Elena Sur, Salar Grande, Llamara, Pajonales) quedan a más de 100 km. El Tatio (~100 km) aparece como análogo solo en Wikipedia, que no abrí. No encontré nada que lo vincule con la Luna. El candidato parece poco estudiado como análogo planetario.":
    "We found no study that uses or proposes this point (or one within 75 km) as a Moon or Mars analog, after 11 searches in English and Spanish and after opening several sources. The closest is the Salar de Ascotán, about 77 km away, with only a press release linking it to astrobiology. The well-documented Atacama analogs (Yungay, María Elena Sur, Salar Grande, Llamara, Pajonales) are more than 100 km away. El Tatio (~100 km) appears as an analog only on Wikipedia, which we did not open. We found nothing linking it to the Moon. The candidate seems little studied as a planetary analog.",
  "No he podido completar la revisión. Solo hice 2 de las 6 búsquedas web, en al menos 2 idiomas, que pide nuestro método (las dos en inglés), así que no puedo concluir que no haya estudios. En lo que sí pude ver no hay ningún estudio que use este punto, ni uno a menos de 75 km, como análogo planetario. Las búsquedas no devolvieron nada específico del Sinaí, y las páginas de Wikipedia sobre sitios análogos que abrí no mencionan Egipto ni el Sinaí (de la de Marte solo pude leer unas dos terceras partes). Hay un dato regional pero no de este sitio. El Foro Espacial Austriaco (OeWF) anunció el 28/02/2022 que Egipto entra en su lista de candidatos para una futura misión análoga de Marte, sin nombrar ningún lugar concreto (abrí la página). No lo registro como estudio, porque no trata de este lugar. Tampoco hice la búsqueda en árabe, ni ADS, LPSC ni el catálogo Europlanet. Para cerrar el caso hay que hacer esas búsquedas. Tampoco hay estudios de análogos de otro cuerpo para este sitio.":
    "We could not complete the review. We only ran 2 of the 6 web searches, in at least 2 languages, that our method calls for (both in English), so we cannot conclude that there are no studies. In what we could see, there is no study that uses this point, or one within 75 km, as a planetary analog. The searches returned nothing specific to Sinai, and the Wikipedia pages on analog sites that we opened do not mention Egypt or Sinai (We could only read about two thirds of the Mars one). There is a regional fact, but not about this site. The Austrian Space Forum (OeWF) announced on 28 Feb 2022 that Egypt was joining its list of candidates for a future Mars analog mission, without naming any specific place (we opened the page). We do not record it as a study, because it is not about this place. Nor did we run the search in Arabic, or ADS, LPSC or the Europlanet catalog. To close the case, those searches still need to be done. There are no analog studies of another body for this site either.",
  "Nominatim sitúa el punto en la provincia de Tamanrasset (Argelia); por la estratigrafía (Wendt et al.: Reggane, Azel Matti, Ahnet, Foum Belrem, Mouydir de O a E) el punto cae en la cuenca de Mouydir, a unos 25 km del cráter de impacto de Amguid (26.09N, 4.40E), que en Wikipedia y en el artículo de Geosciences 2020 no se menciona como análogo planetario. Hay indicios: la cuenca adyacente de Ahnet sí se propone como análogo de Marte (EPSC 2025, abierto), pero no pude confirmar que sus áreas de estudio estén a menos de ~75 km del candidato (el resumen no da coordenadas ni menciona Mouydir); no encontré ningún estudio de Mouydir como tal ni búsquedas en árabe. Los estudios de análogos encontrados son de Marte, no de la Luna. Una segunda revisión independiente no lo confirmó: los dos resúmenes de congreso (EPSC-DPS 2025) son reales y proponen sitios del Sahara argelino como análogos de Marte, pero ninguno sitúa su zona de estudio en Mouydir ni a menos de ~75 km del candidato.":
    "Nominatim places the point in Tamanrasset Province (Algeria); by the stratigraphy (Wendt et al.: Reggane, Azel Matti, Ahnet, Foum Belrem, Mouydir from W to E) the point falls in the Mouydir basin, about 25 km from the Amguid impact crater (26.09N, 4.40E), which neither Wikipedia nor the 2020 Geosciences article mentions as a planetary analog. There are hints: the adjacent Ahnet basin is proposed as a Mars analog (EPSC 2025, opened), but we could not confirm that its study areas are within ~75 km of the candidate (the abstract gives no coordinates and does not mention Mouydir); we found no study of the Mouydir as such and ran no searches in Arabic. The analog studies found are for Mars, not the Moon. A second independent check did not confirm it: the two conference abstracts (EPSC-DPS 2025) are real and propose sites in the Algerian Sahara as Mars analogs, but neither places its study area in the Mouydir or within ~75 km of the candidate.",
  "Revisión bibliográfica pendiente: todavía no buscamos estudios sobre este candidato.":
    "Literature review pending: we have not yet searched for studies on this candidate.",
  "Solo se completaron 2 de las 6 búsquedas mínimas, ambas en inglés y ninguna en árabe. Por eso no puedo concluir que no haya estudios. Lo que se vio no es concluyente: no apareció ningún estudio que use este lugar, ni otro a menos de 75 km, como análogo planetario. La geocodificación inversa ubica el punto en Al Quwayiyah (región de Riad), en la meseta del Najd. El escarpe de Jabal Tuwaiq solo salió como análogo de yacimientos petrolíferos (Aramco y Bureau of Economic Geology, Universidad de Texas), no planetario. La revisión de 2026 sobre ambientes extremos árabes en Extremophiles (resumen abierto en astrobiology.com) no nombra ningún sitio del Najd; no se pudo abrir el texto completo de Springer por una redirección de autenticación. El único análogo saudí citado es el cráter Al-Wahbah (KAUST, comparado con Enceladus), en la zona de Taif, a unos 500 km o más, y por eso no se incluye. Para cerrar la verificación faltan al menos 4 búsquedas, entre ellas una en árabe. No hay indicios concretos de que este lugar se estudie como análogo.":
    "Only 2 of the minimum 6 searches were completed, both in English and none in Arabic. That is why we cannot conclude that there are no studies. What was seen is not conclusive: no study came up that uses this place, or another within 75 km, as a planetary analog. Reverse geocoding places the point in Al Quwayiyah (Riyadh Region), on the Najd plateau. The Jabal Tuwaiq escarpment only came up as an analog for oil reservoirs (Aramco and the Bureau of Economic Geology, University of Texas), not as a planetary one. The 2026 review of extreme Arabian environments in Extremophiles (abstract open on astrobiology.com) does not name any site in the Najd; the full Springer text could not be opened because of an authentication redirect. The only Saudi analog cited is the Al-Wahbah crater (KAUST, compared with Enceladus), in the Taif area, about 500 km or more away, so it is not included. To close the verification at least 4 more searches are needed, one of them in Arabic. There are no concrete signs that this place is studied as an analog.",
  "Tras 10 búsquedas en inglés, francés y árabe no encontré ningún estudio verificado que use como análogo planetario (Luna, Marte u otro) este punto ni un lugar a menos de ~75 km, en el flanco occidental del Hoggar. Lo más cercano son estudios regionales de Marte en el Sahara argelino: la cuenca de Ahnet (EPSC-DPS 2025) y las sabkhas del Tanezrouft (proyecto AZALEA), ambos sin coordenadas y probablemente a más de 100 km. No hallé estudios de análogo lunar en la zona, y las menciones al Hoggar como paisaje parecido a Marte son solo de viajes o divulgación.":
    "After 10 searches in English, French and Arabic we found no verified study that uses this point on the western flank of the Hoggar, or a place within ~75 km, as a planetary analog (Moon, Mars or other). The closest are regional Mars studies in the Algerian Sahara: the Ahnet basin (EPSC-DPS 2025) and the Tanezrouft sabkhas (AZALEA project), both without coordinates and probably more than 100 km away. We found no lunar analog studies in the area, and the mentions of the Hoggar as a Mars-like landscape come only from travel writing or popular outreach.",
  "Tras 11 búsquedas (inglés, árabe y francés) no encontré ningún estudio ni propuesta que use este lugar, ni nada a menos de 75 km, como análogo planetario o sitio de pruebas. Lo que sí aparece como análogo de Marte en Egipto está en el Desierto Occidental (Gilf Kebir, Uweinat, unos 1000 km al oeste): El-Baz et al. 1979 y NASA CR-3611, ambos de formas eólicas, y canales invertidos en un artículo de Icarus de 2018. Además, el Foro Espacial Austriaco (ÖWF) y la agencia espacial egipcia (EgSA) hablaron en 2022 de una posible misión análoga en Egipto, sin precisar el lugar. Solo vi resúmenes de búsqueda, no abrí esas fuentes, y las de Halaib, Shalatin o las ofiolitas del Desierto Oriental como análogo de Nili Fossae no existen en lo que encontré; la coincidencia con Nili Fossae (olivino, carbonatos, ofiolitas) es plausible geológicamente pero sin respaldo bibliográfico directo. Nominatim solo da la gobernación, así que no pude confirmar los accidentes del terreno del punto exacto.":
    "After 11 searches (English, Arabic and French) we found no study or proposal that uses this place, or anything within 75 km, as a planetary analog or test site. What does come up as a Mars analog in Egypt is in the Western Desert (Gilf Kebir, Uweinat, about 1000 km to the west): El-Baz et al. 1979 and NASA CR-3611, both on aeolian landforms, and inverted channels in a 2018 Icarus article. In addition, the Austrian Space Forum (ÖWF) and the Egyptian Space Agency (EgSA) talked in 2022 about a possible analog mission in Egypt, without specifying the location. We only saw search summaries and did not open those sources, and nothing we found treats Halaib, Shalatin or the Eastern Desert ophiolites as an analog of Nili Fossae; the match with Nili Fossae (olivine, carbonates, ophiolites) is geologically plausible but has no direct support in the literature. Nominatim only gives the governorate, so we could not confirm the landforms at the exact point.",
  "Tras 11 búsquedas (inglés, árabe y francés) no encontré ningún estudio que use o proponga este lugar, ni otro a menos de ~75 km, como análogo planetario, banco de pruebas de rovers o sitio de astrobiología. Los análogos de Marte en Egipto que aparecen están en el Desierto Occidental (dunas, canales invertidos, depresión de Bahariya), a cientos de km y no abiertos por mí. La OeWF estudió Egipto para una misión análoga, sin indicar emplazamiento, y finalmente no fue sede. El Desierto Oriental sí es zona de prueba de NASA EMIT (cartografía hiperespectral del escudo Árabe-Nubio, página abierta), pero sin vínculo planetario. Hay ofiolitas serpentinizadas y carbonatadas en el Desierto Oriental sur, con litología similar a Nili Fossae. Esa relación es inferencia mía y ningún estudio encontrado la plantea.":
    "After 11 searches (English, Arabic and French) we found no study that uses or proposes this place, or another within ~75 km, as a planetary analog, rover test bed or astrobiology site. The Mars analogs in Egypt that come up are in the Western Desert (dunes, inverted channels, the Bahariya depression), hundreds of km away, and we did not open them. The OeWF considered Egypt for an analog mission, without specifying a location, and in the end Egypt did not host it. The Eastern Desert is a test area for NASA EMIT (hyperspectral mapping of the Arabian-Nubian Shield, page opened), but with no planetary link. There are serpentinized and carbonated ophiolites in the southern Eastern Desert, with a lithology similar to Nili Fossae. That connection is our own inference, and no study we found proposes it.",
  "Tras 16 búsquedas en inglés, francés y árabe no encontré ningún estudio abierto que use o proponga este punto, ni nada a menos de 75 km, como análogo planetario, sitio de pruebas de rovers o de astrobiología. Lo más cercano es un póster de 2008 sobre huellas de remolinos de polvo (análogo de Marte, no de la Luna) en la frontera Libia-Níger, a unos 115 km. Hay trabajos sobre el Ténéré, el Tibesti y Wau-an-Namus como análogos de Marte, pero están mucho más lejos o no pude confirmar su ubicación. No encontré nada que lo relacione con la Luna ni con Apolo 12.":
    "After 16 searches in English, French and Arabic we found no open study that uses or proposes this point, or anything within 75 km, as a planetary analog, rover test site or astrobiology site. The closest is a 2008 poster on dust devil tracks (a Mars analog, not a Moon one) on the Libya–Niger border, about 115 km away. There is work on the Ténéré, the Tibesti and Wau-an-Namus as Mars analogs, but they are much farther away or we could not confirm their location. We found nothing linking it to the Moon or to Apollo 12.",
  "Tras 9 búsquedas en inglés y persa no aparece ningún estudio que proponga como análogo planetario la zona de Ashar/Mehrestán (Makrán interior, Sistán y Baluchistán), ni tampoco ningún otro lugar a menos de unos 75 km. Lo más cercano son las «montañas marcianas» de Chabahar, a más de 150 km y solo con fuentes turísticas, el volcán de lodo de Pirgel junto a Khash (unos 160 km) y las megaondulaciones del desierto de Lut. Lut es un análogo de Marte (no de la Luna) y está mucho más lejos, así que ninguno de ellos cumple el criterio.":
    "After 9 searches in English and Persian no study comes up that proposes the Ashar/Mehrestan area (inner Makran, Sistan and Baluchestan) as a planetary analog, nor any other place within about 75 km. The closest are the “Martian mountains” of Chabahar, more than 150 km away and with only tourist sources, the Pirgel mud volcano near Khash (about 160 km) and the megaripples of the Lut Desert. The Lut is a Mars analog (not a Moon one) and is much farther away, so none of them meets the criterion.",
  "Tras unas 13 búsquedas en inglés, francés y árabe no encontré ningún estudio que use o proponga este punto (Tazrouk, Tamanrasset, este del Hoggar) ni nada a menos de 75 km como análogo lunar/marciano, sitio de pruebas de rovers o de astrobiología. Solo aparecen análogos saharianos lejanos: la cuenca de Ahnet (EPSC-DPS 2025, unos 600 km, para Marte; abierto) y los sitios de Marruecos (Ibn Battuta). El resumen LPI-1738 (2013) nombra el Hoggar solo de pasada como centro volcánico del Sahara, sin estudiarlo. Las menciones al Tassili n'Ajjer (a unos 450 km) vienen de notas de prensa sobre nombres de rasgos marcianos y no las abrí. La ausencia de resultados no prueba que no exista algún estudio local no indexado.":
    "After about 13 searches in English, French and Arabic we found no study that uses or proposes this point (Tazrouk, Tamanrasset, east of the Hoggar), or anything within 75 km, as a lunar/Martian analog, rover test site or astrobiology site. Only distant Saharan analogs come up: the Ahnet basin (EPSC-DPS 2025, about 600 km, for Mars; opened) and the sites in Morocco (Ibn Battuta). The LPI-1738 abstract (2013) names the Hoggar only in passing as a volcanic center of the Sahara, without studying it. The mentions of Tassili n'Ajjer (about 450 km away) come from press notes about the names of Martian features, and we did not open them. The absence of results does not prove that no unindexed local study exists.",
  // Topónimos del catálogo con el nombre árabe pegado: en inglés se quita (se mostraba desordenado junto al latín).
  "Halfa - حلفا, Sudan": "Halfa, Sudan",
  "Malha - مالحة, Sudan": "Malha, Sudan",
  // Traducciones añadidas por el equipo el 15/11 (commit 5ea7f7e). Si una frase también está en
  // i18n.datos.en.ts, manda la de ese archivo (Object.assign de abajo).
  // Notas de fuente y nombres de las referencias (results.json → references[] y references_fine[]).
  // Las de teselas y ventanas se traducen con las reglas de dataEnPatterns, que reusan estas.
  "Gazetteer of Planetary Nomenclature (IAU/USGS): Shackleton, D = 20.92 km, -89.67, 129.78 (planetográfica, +Este; cotejado el 14/11/2026). Mismo id que la referencia de la v1.":
    "Gazetteer of Planetary Nomenclature (IAU/USGS): Shackleton, D = 20.92 km, -89.67, 129.78 (planetographic, +East; checked on 14 Nov 2026). Same id as the v1 reference.",
  "Gazetteer of Planetary Nomenclature, Tooting (Feature 6059), leído del shapefile oficial MARS_nomenclature_center_pts (asc-planetarynames-data); el metadato dice latitud planetocéntrica y longitud positiva al este: center_lat 23.2070, center_lon 207.7613E → -152.2387; diámetro 27.86 km, por lo que el cráter cabe casi entero en la ventana de 30 km. HiRISE ESP_062934_2040 ('Pitted Material from Tooting Crater', 23.498, 207.567E) lo describe como uno de los cráteres más jóvenes >20 km.":
    "Gazetteer of Planetary Nomenclature, Tooting (Feature 6059), read from the official shapefile MARS_nomenclature_center_pts (asc-planetarynames-data); the metadata says planetocentric latitude and positive-east longitude: center_lat 23.2070, center_lon 207.7613E → -152.2387; diameter 27.86 km, so the crater fits almost entirely in the 30 km window. HiRISE ESP_062934_2040 ('Pitted Material from Tooting Crater', 23.498, 207.567E) describes it as one of the youngest craters >20 km.",
  "Gazetteer, Korolev (Feature 3091), leído del shapefile oficial (planetocéntrica, este positivo): center_lat 72.7677, center_lon 164.584E (ya en -180..180); diámetro 81.37 km. El centro cae sobre el montículo de hielo que rellena el cráter. Cotejo HiRISE: 'Edge of Korolev Crater Ice Mound' (ESP_019248_2530) 72.912, 166.186E; 'Western Rim Region of Korolev Crater' (PSP_007961_2530) 72.899, 162.006E.":
    "Gazetteer, Korolev (Feature 3091), read from the official shapefile (planetocentric, positive east): center_lat 72.7677, center_lon 164.584E (already in -180..180); diameter 81.37 km. The center falls on the ice mound that fills the crater. HiRISE cross-check: 'Edge of Korolev Crater Ice Mound' (ESP_019248_2530) 72.912, 166.186E; 'Western Rim Region of Korolev Crater' (PSP_007961_2530) 72.899, 162.006E.",
  "Gläser et al., tabla 1: -89.7849, 203.97 E; iluminación media 81.0 %. Mazarico et al. (2011): -89.78, 204.27 E.":
    "Gläser et al., table 1: -89.7849, 203.97 E; mean illumination 81.0 %. Mazarico et al. (2011): -89.78, 204.27 E.",
  "Golombek et al. (2020), Earth and Space Science, 'Location and Setting of the Mars InSight Lander, Instruments, and Landing Site'. Leí el resumen vía la API de Europe PMC (PMC7583488): 'The lander is located at 4.502384°N, 135.623447°E', en un sistema 'positive east, planetocentric'. Sin conversión.":
    "Golombek et al. (2020), Earth and Space Science, 'Location and Setting of the Mars InSight Lander, Instruments, and Landing Site'. We read the abstract through the Europe PMC API (PMC7583488): 'The lander is located at 4.502384°N, 135.623447°E', in a 'positive east, planetocentric' system. No conversion.",
  "LROC 'IM-2 Athena Seen Obliquely' (10-mar-2025): 84.7906° S, 29.1957° E (cotejado el 14/11/2026). Quedó de lado dentro de un cráter de ~20 m cerca del centro de Mons Mouton. El sitio previsto era -84.78, 29.13 (LROC 'IM-2 Landing Region', https://lroc.im-ldi.com/images/1401).":
    "LROC 'IM-2 Athena Seen Obliquely' (10 Mar 2025): 84.7906° S, 29.1957° E (checked on 14 Nov 2026). It ended up on its side inside a ~20 m crater near the center of Mons Mouton. The planned site was -84.78, 29.13 (LROC 'IM-2 Landing Region', https://lroc.im-ldi.com/images/1401).",
  "La página ODE (Nodo de Geociencias del PDS) da 'Viking Lander 1: 22.269° N, 312.049° E'. No dice si la latitud es planetocéntrica (ODE trabaja normalmente en planetocéntrica con longitud este). La longitud se pasó de 0-360 a -180..180: 312.049-360 = -47.951.":
    "The ODE page (PDS Geosciences Node) gives 'Viking Lander 1: 22.269° N, 312.049° E'. It does not say whether the latitude is planetocentric (ODE normally works in planetocentric with east longitude). The longitude was converted from 0-360 to -180..180: 312.049-360 = -47.951.",
  "Latitud -88.2 de la tabla NASA GSFC TFAWS 2025 (área 399.8 km²). Longitud -66.7 = centro del mosaico LROC 'de Gerlache Rim' NAC_ROI_DEGERRIMLO1_P885S2933 (centro -88.5, 293.3 E; límites lat -89.02 a -87.79, lon -83.18 a -41.31; cotejado el 14/11/2026), que puede abarcar Rim 1 y Rim 2: longitud INCIERTA y límites del mosaico, no de la región. Cráter de Gerlache (IAU, Feature/1439): -88.48, -88.34. También región en 2022.":
    "Latitude -88.2 from the NASA GSFC TFAWS 2025 table (area 399.8 km²). Longitude -66.7 = center of the LROC mosaic 'de Gerlache Rim' NAC_ROI_DEGERRIMLO1_P885S2933 (center -88.5, 293.3 E; bounds lat -89.02 to -87.79, lon -83.18 to -41.31; checked on 14 Nov 2026), which may cover both Rim 1 and Rim 2: the longitude is UNCERTAIN and the bounds are the mosaic's, not the region's. De Gerlache crater (IAU, Feature/1439): -88.48, -88.34. Also a region in 2022.",
  "Liu, Li, Zhang et al. (2022), Nature Astronomy, 'Geomorphic contexts and science focus of the Zhurong landing site on Mars': 'the Zhurong rover landed at 109.925° E, 25.066° N at an elevation of −4,099.4 m'. El artículo no dice si la latitud es planetocéntrica, aunque así lo indica el uso de la longitud este. Sin conversión.":
    "Liu, Li, Zhang et al. (2022), Nature Astronomy, 'Geomorphic contexts and science focus of the Zhurong landing site on Mars': 'the Zhurong rover landed at 109.925° E, 25.066° N at an elevation of −4,099.4 m'. The article does not say whether the latitude is planetocentric, although the use of east longitude suggests it is. No conversion.",
  "Lunar Pit Locations de LROC (LUNAR_PIT_LOCATIONS.CSV, PDS LROLRC_2001/EXTRAS; Atlas de fosos de LROC), leído el 14/11/2026: Mare Ingenii Pit, -35.9494, 166.0559.":
    "LROC Lunar Pit Locations (LUNAR_PIT_LOCATIONS.CSV, PDS LROLRC_2001/EXTRAS; LROC pit atlas), read on 14 Nov 2026: Mare Ingenii Pit, -35.9494, 166.0559.",
  "Lunar Pit Locations de LROC (LUNAR_PIT_LOCATIONS.CSV, PDS LROLRC_2001/EXTRAS; Atlas de fosos de LROC), leído el 14/11/2026: Mare Tranquillitatis Pit, 8.3355, 33.222; 105 m de profundidad interior.":
    "LROC Lunar Pit Locations (LUNAR_PIT_LOCATIONS.CSV, PDS LROLRC_2001/EXTRAS; LROC pit atlas), read on 14 Nov 2026: Mare Tranquillitatis Pit, 8.3355, 33.222; 105 m interior depth.",
  "Lunar Pit Locations de LROC (LUNAR_PIT_LOCATIONS.CSV, PDS LROLRC_2001/EXTRAS; Atlas de fosos de LROC), leído el 14/11/2026: Marius Hills Pit, 14.0917, -56.7701 (303.2299 E); 40 m de profundidad.":
    "LROC Lunar Pit Locations (LUNAR_PIT_LOCATIONS.CSV, PDS LROLRC_2001/EXTRAS; LROC pit atlas), read on 14 Nov 2026: Marius Hills Pit, 14.0917, -56.7701 (303.2299 E); 40 m deep.",
  "Mismo mosaico LROC compartido con Mons Mouton (NAC_ROI_MTMOUTONLO1_P854S0353, centro -85.4, 35.3; lon 27.29 a 43.23). La longitud propia NO está verificada. GSFC TFAWS 2025: latitud -85.4, área 398.7 km². Cráter Nobile (IAU, Feature/4321): -85.28, 53.27. También región en 2022.":
    "Same LROC mosaic shared with Mons Mouton (NAC_ROI_MTMOUTONLO1_P854S0353, center -85.4, 35.3; lon 27.29 to 43.23). Its own longitude is NOT verified. GSFC TFAWS 2025: latitude -85.4, area 398.7 km². Nobile crater (IAU, Feature/4321): -85.28, 53.27. Also a region in 2022.",
  "Mosaico LROC NAC_ROI_AMUNDRIMLO1_P842S0693: centro -84.2, 69.3; límites lat -84.65 a -83.80, lon 65.10 a 73.51 (cotejado el 14/11/2026). Cráter Amundsen (IAU): -84.44, 83.07.":
    "LROC mosaic NAC_ROI_AMUNDRIMLO1_P842S0693: center -84.2, 69.3; bounds lat -84.65 to -83.80, lon 65.10 to 73.51 (checked on 14 Nov 2026). Amundsen crater (IAU): -84.44, 83.07.",
  "Mosaico LROC NAC_ROI_CABEUSPKLO1_P836S2912 ('Peak Near Cabeus B', candidata de Artemis III): centro -83.6, 291.2 E (= -68.8); límites lat -84.06 a -83.21, lon -72.47 a -64.80 (página cotejada el 14/11/2026). GSFC TFAWS 2025 (NTRS 20250007692): latitud del centro -83.6, área 397.3 km² (extent_km = raíz del área). Cráter Cabeus B (IAU, Feature/8058): -82.26, -54.58.":
    "LROC mosaic NAC_ROI_CABEUSPKLO1_P836S2912 ('Peak Near Cabeus B', Artemis III candidate): center -83.6, 291.2 E (= -68.8); bounds lat -84.06 to -83.21, lon -72.47 to -64.80 (page checked on 14 Nov 2026). GSFC TFAWS 2025 (NTRS 20250007692): center latitude -83.6, area 397.3 km² (extent_km = square root of the area). Cabeus B crater (IAU, Feature/8058): -82.26, -54.58.",
  "Mosaico LROC NAC_ROI_DEGERKCHLO1_P858S24363: centro -85.8, 243.6 E (= -116.4); límites lat -86.27 a -85.39, lon -122.59 a -110.48 (cotejado el 14/11/2026).":
    "LROC mosaic NAC_ROI_DEGERKCHLO1_P858S24363: center -85.8, 243.6 E (= -116.4); bounds lat -86.27 to -85.39, lon -122.59 to -110.48 (checked on 14 Nov 2026).",
  "Mosaico LROC NAC_ROI_FAUSTINILO1_P878S0900: centro -87.8, 90.0; límites lat -88.19 a -87.54, lon 79.51 a 100.49 (cotejado el 14/11/2026). 15x15 km según la nota de NASA de 2022. Rejilla USGS en DOI 10.5066/P13FD9ZD (no leída).":
    "LROC mosaic NAC_ROI_FAUSTINILO1_P878S0900: center -87.8, 90.0; bounds lat -88.19 to -87.54, lon 79.51 to 100.49 (checked on 14 Nov 2026). 15x15 km according to NASA's 2022 note. USGS grid at DOI 10.5066/P13FD9ZD (not read).",
  "Mosaico LROC NAC_ROI_HAWORTH_LO1_P867S3363: centro -86.7, 336.3 E (= -23.7); límites lat -87.39 a -86.11, lon -34.98 a -12.36 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -86.7, área 886.6 km². Cráter Haworth (IAU, Feature/14502): -87.45, -5.17. También región en 2022.":
    "LROC mosaic NAC_ROI_HAWORTH_LO1_P867S3363: center -86.7, 336.3 E (= -23.7); bounds lat -87.39 to -86.11, lon -34.98 to -12.36 (checked on 14 Nov 2026). GSFC TFAWS 2025: latitude -86.7, area 886.6 km². Haworth crater (IAU, Feature/14502): -87.45, -5.17. Also a region in 2022.",
  "Mosaico LROC NAC_ROI_MALAPERTLO1_P860S0003: centro -86.0, 0.3; límites lat -86.33 a -85.63, lon -5.66 a 5.15 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -86.0, área 439.9 km². Mons Malapert (IAU, Feature/16338): -85.98, -1.67. También región en 2022.":
    "LROC mosaic NAC_ROI_MALAPERTLO1_P860S0003: center -86.0, 0.3; bounds lat -86.33 to -85.63, lon -5.66 to 5.15 (checked on 14 Nov 2026). GSFC TFAWS 2025: latitude -86.0, area 439.9 km². Mons Malapert (IAU, Feature/16338): -85.98, -1.67. Also a region in 2022.",
  "Mosaico LROC NAC_ROI_MOUTNPLTLO1_P843S0306: centro -84.3, 30.6; límites lat -85.76 a -82.85, lon 15.49 a 46.61 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -84.2, área 4428.4 km², mucho mayor que las demás regiones. Mons Mouton (IAU, Feature/16070): -84.60, 31.00.":
    "LROC mosaic NAC_ROI_MOUTNPLTLO1_P843S0306: center -84.3, 30.6; bounds lat -85.76 to -82.85, lon 15.49 to 46.61 (checked on 14 Nov 2026). GSFC TFAWS 2025: latitude -84.2, area 4428.4 km², much larger than the other regions. Mons Mouton (IAU, Feature/16070): -84.60, 31.00.",
  "Mosaico LROC NAC_ROI_NOBILE02LO1_P839S0587: centro -83.9, 58.7; límites lat -84.40 a -83.50, lon 54.46 a 63.02 (cotejado el 14/11/2026). GSFC TFAWS 2025: latitud -83.9, área 397.8 km². Peña-Asensio et al. (Acta Astronautica; arXiv 2406.19863) sitúan su punto óptimo en -84.20156, 60.69989. También región en 2022.":
    "LROC mosaic NAC_ROI_NOBILE02LO1_P839S0587: center -83.9, 58.7; bounds lat -84.40 to -83.50, lon 54.46 to 63.02 (checked on 14 Nov 2026). GSFC TFAWS 2025: latitude -83.9, area 397.8 km². Peña-Asensio et al. (Acta Astronautica; arXiv 2406.19863) place their optimal point at -84.20156, 60.69989. Also a region in 2022.",
  "Mosaico LROC NAC_ROI_SHKLTNPKLO1_P888S1247 (y el #2, SHKLTNPKLO2, con el mismo centro y límites): centro -88.8, 124.7; límites lat -89.17 a -88.44, lon 107.53 a 141.84 (cotejado el 14/11/2026).":
    "LROC mosaic NAC_ROI_SHKLTNPKLO1_P888S1247 (and #2, SHKLTNPKLO2, with the same center and bounds): center -88.8, 124.7; bounds lat -89.17 to -88.44, lon 107.53 to 141.84 (checked on 14 Nov 2026).",
  "Mosaico LROC compartido 'Nobile Rim 1 and Mons Mouton (Leibnitz Beta Plateau)' NAC_ROI_MTMOUTONLO1_P854S0353: centro -85.4, 35.3; límites lat -86.07 a -84.82, lon 27.29 a 43.23 (cotejado el 14/11/2026). Lat y lon son las del mosaico compartido: la longitud propia de la región NO está verificada. GSFC TFAWS 2025: latitud -85.4, área 255.2 km². Región 'Leibnitz Beta Plateau' en 2022 (Mons Mouton aprobado por la IAU el 13-may-2022).":
    "Shared LROC mosaic 'Nobile Rim 1 and Mons Mouton (Leibnitz Beta Plateau)' NAC_ROI_MTMOUTONLO1_P854S0353: center -85.4, 35.3; bounds lat -86.07 to -84.82, lon 27.29 to 43.23 (checked on 14 Nov 2026). Lat and lon are those of the shared mosaic: the region's own longitude is NOT verified. GSFC TFAWS 2025: latitude -85.4, area 255.2 km². Region 'Leibnitz Beta Plateau' in 2022 (Mons Mouton approved by the IAU on 13 May 2022).",
  "No es el centro de la región (no verificado): es el punto C1 de máxima iluminación media de la cresta Shackleton–de Gerlache según Gläser et al. ('Illumination conditions at the lunar poles: Implications for future exploration', Planetary and Space Science), tabla 1: -89.4505, 222.84 E (= -137.16). No hay mosaico LROC de la región. Rejilla USGS en DOI 10.5066/P13FD9ZD (no leída). Mismo punto que el sitio connecting_ridge_c1.":
    "Not the center of the region (not verified): it is point C1, the one with the highest mean illumination on the Shackleton–de Gerlache ridge according to Gläser et al. ('Illumination conditions at the lunar poles: Implications for future exploration', Planetary and Space Science), table 1: -89.4505, 222.84 E (= -137.16). There is no LROC mosaic of the region. USGS grid at DOI 10.5066/P13FD9ZD (not read). Same point as the site connecting_ridge_c1.",
  "No hay coordenadas publicadas de esta región. Se usa el punto C2 de Connecting Ridge de Gläser et al. (tabla 1: -89.3157, 245.94 E = -114.06), pero NO consta que corresponda a 'Connecting Ridge Extension'. Polígono en la release USGS DOI 10.5066/P13FD9ZD (no leída). Mismo punto que el sitio connecting_ridge_c2.":
    "There are no published coordinates for this region. Point C2 of Connecting Ridge from Gläser et al. is used (table 1: -89.3157, 245.94 E = -114.06), but there is NO record that it corresponds to 'Connecting Ridge Extension'. Polygon in the USGS release DOI 10.5066/P13FD9ZD (not read). Same point as the site connecting_ridge_c2.",
  "ODE da dos soluciones. Uso la triangulación cartográfica: '14.5692° S, 175.4729° E'. La solución Doppler es 14.571892° S, 175.47848° E. Sin conversión de longitud.":
    "ODE gives two solutions. We use the cartographic triangulation: '14.5692° S, 175.4729° E'. The Doppler solution is 14.571892° S, 175.47848° E. No longitude conversion.",
  "ODE, triangulación cartográfica: '1.9462° S, 354.4734° E'. La solución Doppler es 1.9483° S, 354.47417° E. Longitud convertida: 354.4734-360 = -5.5266.":
    "ODE, cartographic triangulation: '1.9462° S, 354.4734° E'. The Doppler solution is 1.9483° S, 354.47417° E. Converted longitude: 354.4734-360 = -5.5266.",
  "ODE: 'Pathfinder: 19.095° N, 326.747° E'. Longitud convertida: 326.747-360 = -33.253.":
    "ODE: 'Pathfinder: 19.095° N, 326.747° E'. Converted longitude: 326.747-360 = -33.253.",
  "ODE: 'Phoenix: 68.22° N, 234.25° E'. Longitud convertida: 234.25-360 = -125.75. Solo dos decimales en la fuente.":
    "ODE: 'Phoenix: 68.22° N, 234.25° E'. Converted longitude: 234.25-360 = -125.75. Only two decimals in the source.",
  "ODE: 'Viking Lander 2: 47.668° N, 134.280° E'. No hizo falta convertir. La página no dice el sistema de latitud.":
    "ODE: 'Viking Lander 2: 47.668° N, 134.280° E'. No conversion was needed. The page does not state the latitude system.",
  "Posición = centro del cráter Slater (Gazetteer IAU, planetográfica +Este: -88.08, 111.29; D = 25.12 km; cotejado el 14/11/2026). La tabla GSFC TFAWS 2025 da para la región latitud -87.1 y área 399.3 km²: la región está a ~30 km del centro del cráter hacia el ecuador y su longitud no está verificada. No hay mosaico LROC de la región (solo el de la PSR de Slater, NAC_ROI_PSRSLATRLOA, centro -87.5, 121.4, que no es la región).":
    "Position = center of Slater crater (IAU Gazetteer, planetographic +East: -88.08, 111.29; D = 25.12 km; checked on 14 Nov 2026). The GSFC TFAWS 2025 table gives the region a latitude of -87.1 and an area of 399.3 km²: the region lies ~30 km from the crater center toward the equator, and its longitude is not verified. There is no LROC mosaic of the region (only the one of the Slater PSR, NAC_ROI_PSRSLATRLOA, center -87.5, 121.4, which is not the region).",
  "Primer punto (sol 3, site 2, drive 0) del GeoJSON oficial de recorrido de NASA/JPL: lon 137.441633, lat -4.589467. Ya está en longitud este -180..180. Concuerda con ODE ('MSL Gale (Curiosity): 4.59° S, 137.44° E'). El archivo no indica el datum de latitud, pero la cartografía de MSL es planetocéntrica.":
    "First point (sol 3, site 2, drive 0) of the official NASA/JPL traverse GeoJSON: lon 137.441633, lat -4.589467. Already in east longitude -180..180. It agrees with ODE ('MSL Gale (Curiosity): 4.59° S, 137.44° E'). The file does not state the latitude datum, but MSL cartography is planetocentric.",
  "Primer punto del GeoJSON oficial de recorrido de NASA/JPL (sol 13, site 3, drive 0, dist_total_m 0, 'Site increment, no motion'): lon 77.45088572, lat 18.44462715. Es la posición antes del primer movimiento, que figura en sol 14. Ya está en longitud este. No encontré un documento de NASA que dé '18.4447N 77.4508E' de forma explícita; esa cifra solo aparece en Wikipedia.":
    "First point of the official NASA/JPL traverse GeoJSON (sol 13, site 3, drive 0, total distance 0 m, 'Site increment, no motion'): lon 77.45088572, lat 18.44462715. It is the position before the first drive, which appears at sol 14. Already in east longitude. We did not find a NASA document that gives '18.4447N 77.4508E' explicitly; that figure only appears on Wikipedia.",
  "Página HiRISE 'A Closer Look at Holden Crater' (PSP_003077_1530): Latitude (centered) -26.960°, Longitude (East) 325.457° → -34.543. El texto dice que los depósitos afloran mejor en el sector suroeste, bajo abanicos aluviales. Centro del Gazetteer (-26.04, 325.981E, 153 km) no usado.":
    "HiRISE page 'A Closer Look at Holden Crater' (PSP_003077_1530): Latitude (centered) -26.960°, Longitude (East) 325.457° → -34.543. The text says the deposits are best exposed in the southwest sector, beneath alluvial fans. Gazetteer center (-26.04, 325.981E, 153 km) not used.",
  "Página HiRISE 'Candidate Cavern Entrance Northeast of Arsia Mons' (PSP_003647_1745): Latitude (centered) -5.532°, Longitude (East) 241.396° → -118.604. Texto: punto muy oscuro en una llanura de lava polvorienta al noreste de Arsia Mons, sin borde elevado ni eyecta. Nota: la interpretación como caverna es discutida (otras fuentes lo consideran un pozo cilíndrico). El centro del Gazetteer de Arsia Mons (-8.257, 239.908E) caería en la caldera.":
    "HiRISE page 'Candidate Cavern Entrance Northeast of Arsia Mons' (PSP_003647_1745): Latitude (centered) -5.532°, Longitude (East) 241.396° → -118.604. Text: a very dark spot on a dusty lava plain northeast of Arsia Mons, with no raised rim or ejecta. Note: its interpretation as a cavern is disputed (other sources consider it a cylindrical pit). The Gazetteer center of Arsia Mons (-8.257, 239.908E) would fall in the caldera.",
  "Página HiRISE 'Channels on a Streamlined Island of Kasei Vallis' (ESP_075855_2100): Latitude (centered) 29.866°, Longitude (East) 307.916° → -52.084. El texto dice que son canales pequeños en el fondo de Kasei Valles, en el borde de sotavento de una isla aerodinámica. Gazetteer (centro 25.136, 297.122E, 1580 km de longitud) no usado por ser enorme.":
    "HiRISE page 'Channels on a Streamlined Island of Kasei Vallis' (ESP_075855_2100): Latitude (centered) 29.866°, Longitude (East) 307.916° → -52.084. The text says these are small channels on the floor of Kasei Valles, on the lee edge of a streamlined island. Gazetteer (center 25.136, 297.122E, 1580 km long) not used because it is huge.",
  "Página HiRISE 'Continual Dune and Ripple Migration in Nili Patera' (ESP_028575_1890): Latitude (centered) 8.722°, Longitude (East) 67.345° (ya en -180..180). A ~0.3° del centro del Gazetteer de Nili Patera (8.969, 67.167E, 67.5 km).":
    "HiRISE page 'Continual Dune and Ripple Migration in Nili Patera' (ESP_028575_1890): Latitude (centered) 8.722°, Longitude (East) 67.345° (already in -180..180). About 0.3° from the Gazetteer center of Nili Patera (8.969, 67.167E, 67.5 km).",
  "Página HiRISE 'Delta Structure in Eberswalde Crater' (PSP_001336_1560): Latitude (centered) -23.835°, Longitude (East) 326.381° → -33.619. Eberswalde fue candidato de MSL, pero nunca hubo aterrizaje. Centro del Gazetteer: -23.975, 326.703E (62 km).":
    "HiRISE page 'Delta Structure in Eberswalde Crater' (PSP_001336_1560): Latitude (centered) -23.835°, Longitude (East) 326.381° → -33.619. Eberswalde was an MSL candidate, but nothing ever landed there. Gazetteer center: -23.975, 326.703E (62 km).",
  "Página HiRISE 'Exposed Faults in Coprates Chasma Wall' (PSP_005069_1670): Latitude (centered) -12.836°, Longitude (East) 299.915° → 299.915 - 360 = -60.085. El texto dice que muestra parte del borde norte de Coprates Chasma con fallas y capas en las laderas. Centro del Gazetteer (-13.365, 299.262E) no usado porque el accidente mide 958 km y el centro caería en el fondo.":
    "HiRISE page 'Exposed Faults in Coprates Chasma Wall' (PSP_005069_1670): Latitude (centered) -12.836°, Longitude (East) 299.915° → 299.915 - 360 = -60.085. The text says it shows part of the northern edge of Coprates Chasma, with faults and layers on the slopes. Gazetteer center (-13.365, 299.262E) not used because the feature is 958 km long and the center would fall on the floor.",
  "Página HiRISE 'Fans of Lava Flows on the Flanks of Olympus Mons' (PSP_002909_2000): Latitude (centered) 19.701°, Longitude (East) 226.059° → -133.941. Está a ~1° al norte del centro del Gazetteer (18.653, 226.198E), es decir, sobre el flanco norte fuera de la caldera, como pide el tipo 'flanco'.":
    "HiRISE page 'Fans of Lava Flows on the Flanks of Olympus Mons' (PSP_002909_2000): Latitude (centered) 19.701°, Longitude (East) 226.059° → -133.941. It is ~1° north of the Gazetteer center (18.653, 226.198E), that is, on the northern flank outside the caldera, as the 'flank' type requires.",
  "Página HiRISE 'Gullies and... Gullies? in Terra Sirenum' (PSP_001697_1390): Latitude (centered) -40.807°, Longitude (East) 200.209° → -159.791. El texto dice que es un cráter sin nombre dentro del cráter Newton. Está dentro de los límites de Newton en el Gazetteer (lat -43.03 a -37.97, lon 198.64–205.30E). Alternativa: sitio RSL de Newton ESP_040491_1375 (-42.287, 202.200E).":
    "HiRISE page 'Gullies and... Gullies? in Terra Sirenum' (PSP_001697_1390): Latitude (centered) -40.807°, Longitude (East) 200.209° → -159.791. The text says it is an unnamed crater inside Newton crater. It lies within the bounds of Newton in the Gazetteer (lat -43.03 to -37.97, lon 198.64–205.30E). Alternative: the Newton RSL site ESP_040491_1375 (-42.287, 202.200E).",
  "Página HiRISE 'Gullies on the Northwest Rim of Hale Crater' (ESP_014074_1445): Latitude (centered) -35.093°, Longitude (East) 322.414° → -37.586. El centro del Gazetteer de Hale (-35.688, 323.638E, 137 km) caería en el fondo/pico central; por eso se usa el borde con barrancos.":
    "HiRISE page 'Gullies on the Northwest Rim of Hale Crater' (ESP_014074_1445): Latitude (centered) -35.093°, Longitude (East) 322.414° → -37.586. The Gazetteer center of Hale (-35.688, 323.638E, 137 km) would fall on the floor or the central peak, so the gullied rim is used instead.",
  "Página HiRISE 'Lobate Debris Apron in Deuteronilus Mensae' (ESP_016959_2240): Latitude (centered) 43.621°, Longitude (East) 28.618° (ya en -180..180). Dentro de los límites de Deuteronilus Mensae en el Gazetteer (39.57–49.86N, 13.68–35.37E).":
    "HiRISE page 'Lobate Debris Apron in Deuteronilus Mensae' (ESP_016959_2240): Latitude (centered) 43.621°, Longitude (East) 28.618° (already in -180..180). Within the bounds of Deuteronilus Mensae in the Gazetteer (39.57–49.86N, 13.68–35.37E).",
  "Página HiRISE 'Mars Mysteries: Unveiling the Icy Craters' (ESP_025840_2240): Latitude (centered) 43.884°, Longitude (East) 204.346° → -155.654. El texto dice 'a 13-meter diameter crater in Arcadia Planitia where ice was exposed'. Está dentro de los límites de Arcadia Planitia en el Gazetteer (33.88–64.20N, 165.78–210.39E).":
    "HiRISE page 'Mars Mysteries: Unveiling the Icy Craters' (ESP_025840_2240): Latitude (centered) 43.884°, Longitude (East) 204.346° → -155.654. The text says 'a 13-meter diameter crater in Arcadia Planitia where ice was exposed'. It lies within the bounds of Arcadia Planitia in the Gazetteer (33.88–64.20N, 165.78–210.39E).",
  "Página HiRISE 'Mawrth Vallis Phyllosilicates and Crater (MSL)' (PSP_009616_2035): Latitude (centered) 23.345°, Longitude (East) 342.615° → -17.385. El texto dice que la imagen está justo al este de la tercera elipse candidata de MSL y que la zona contiene minerales de arcilla. Centro del Gazetteer: 22.430, 343.027E.":
    "HiRISE page 'Mawrth Vallis Phyllosilicates and Crater (MSL)' (PSP_009616_2035): Latitude (centered) 23.345°, Longitude (East) 342.615° → -17.385. The text says the image is just east of the third MSL candidate ellipse and that the area contains clay minerals. Gazetteer center: 22.430, 343.027E.",
  "Página HiRISE 'North Polar Layered Deposits in Head Scarp of Chasma Boreale' (PSP_001334_2645): Latitude (centered) 84.410°, Longitude (East) 343.495° → -16.505. Alternativa: 'Steepest Scarp in the North Polar Layered Deposits' (PSP_001550_2640) 83.821, 235.286E.":
    "HiRISE page 'North Polar Layered Deposits in Head Scarp of Chasma Boreale' (PSP_001334_2645): Latitude (centered) 84.410°, Longitude (East) 343.495° → -16.505. Alternative: 'Steepest Scarp in the North Polar Layered Deposits' (PSP_001550_2640) 83.821, 235.286E.",
  "Página HiRISE 'Outcrops of Layers in the South Polar Layered Deposits' (PSP_004664_0955): Latitude (centered) -84.219°, Longitude (East) 229.148° → -130.852. Centro del Gazetteer de Planum Australe: -83.35, 157.70E (1430 km), no usado.":
    "HiRISE page 'Outcrops of Layers in the South Polar Layered Deposits' (PSP_004664_0955): Latitude (centered) -84.219°, Longitude (East) 229.148° → -130.852. Gazetteer center of Planum Australe: -83.35, 157.70E (1430 km), not used.",
  "Página HiRISE 'Proposed Site for Future Exploration in Nili Fossae Carbonate Plains' (ESP_032728_2020): Latitude (centered) 21.731°, Longitude (East) 79.062° (ya en -180..180). La página no tiene texto descriptivo; el contexto de los carbonatos viene del comunicado de NASA PIA19817, que cita esta observación (solo lo vi en resultados de búsqueda). Centro del Gazetteer de Nili Fossae: 22.018, 76.695E.":
    "HiRISE page 'Proposed Site for Future Exploration in Nili Fossae Carbonate Plains' (ESP_032728_2020): Latitude (centered) 21.731°, Longitude (East) 79.062° (already in -180..180). The page has no descriptive text; the carbonate context comes from NASA release PIA19817, which cites this observation (we only saw it in search results). Gazetteer center of Nili Fossae: 22.018, 76.695E.",
  "Página HiRISE 'Recent Gully Activity on Mars' (ESP_020661_1440): Latitude (centered) -35.729°, Longitude (East) 129.386° (ya en -180..180). Coincide con el centro del Gazetteer (Feature 14593: -35.7179, 129.3998E, diámetro 7.03 km), así que la ventana de 30 km abarca todo el cráter.":
    "HiRISE page 'Recent Gully Activity on Mars' (ESP_020661_1440): Latitude (centered) -35.729°, Longitude (East) 129.386° (already in -180..180). It matches the Gazetteer center (Feature 14593: -35.7179, 129.3998E, diameter 7.03 km), so the 30 km window covers the whole crater.",
  "Página HiRISE 'Scallop and Polygonal Features in Utopia Planitia' (PSP_002070_2250): Latitude (centered) 44.730°, Longitude (East) 88.485° (ya en -180..180). El texto dice que en Utopia el terreno festoneado está entre 45 y 50°N. Alternativa: ESP_025620_2275 (47.067, 93.754E).":
    "HiRISE page 'Scallop and Polygonal Features in Utopia Planitia' (PSP_002070_2250): Latitude (centered) 44.730°, Longitude (East) 88.485° (already in -180..180). The text says that in Utopia the scalloped terrain lies between 45 and 50°N. Alternative: ESP_025620_2275 (47.067, 93.754E).",
  "Página HiRISE 'Sedimentary Layers in West Candor Chasma' (ESP_026378_1730): Latitude (centered) -6.733°, Longitude (East) 284.485°. Conversión oeste/este: 284.485 - 360 = -75.515. HiRISE ya da latitud planetocéntrica (comprobado: Gasa en HiRISE -35.729 coincide con el centro del Gazetteer -35.718; en planetográfica diferiría ~0.3°). Se elige este punto y no el centro del Gazetteer (-6.533, 289.221E, Candor Chasma mide 810 km) porque la ventana de 30 km debe caer sobre los depósitos estratificados.":
    "HiRISE page 'Sedimentary Layers in West Candor Chasma' (ESP_026378_1730): Latitude (centered) -6.733°, Longitude (East) 284.485°. West/east conversion: 284.485 - 360 = -75.515. HiRISE already gives planetocentric latitude (checked: Gasa in HiRISE, -35.729, matches the Gazetteer center, -35.718; in planetographic it would differ by ~0.3°). This point is chosen instead of the Gazetteer center (-6.533, 289.221E; Candor Chasma is 810 km long) because the 30 km window must fall on the layered deposits.",
  "Página HiRISE 'Small Eruptive Vents South of Pavonis Mons' (ESP_056959_1745, HiPOD 10 dic 2020): Latitude (centered) -5.493°, Longitude (East) 245.642° → -114.358. La página leída solo trae el título y metadatos (la descripción de respiraderos junto a escudos bajos proviene del resultado de búsqueda del HiPOD). Alternativa cercana verificada: 'En Echelon Fissure Vents South of Pavonis Mons' (ESP_035768_1730) -6.721°, 245.994°E.":
    "HiRISE page 'Small Eruptive Vents South of Pavonis Mons' (ESP_056959_1745, HiPOD 10 Dec 2020): Latitude (centered) -5.493°, Longitude (East) 245.642° → -114.358. The page we read only has the title and metadata (the description of vents next to low shields comes from the HiPOD search result). Nearby verified alternative: 'En Echelon Fissure Vents South of Pavonis Mons' (ESP_035768_1730) -6.721°, 245.994°E.",
  "Página HiRISE 'Uplifted Blocks of Light-Toned Layered Deposits' (ESP_054753_1825): Latitude (centered) 2.262°, Longitude (East) 340.079° → -19.921. Centro del Gazetteer de Aram Chaos: 2.523, 337.608E (-22.392); se usa el punto HiRISE porque cae sobre los bloques estratificados.":
    "HiRISE page 'Uplifted Blocks of Light-Toned Layered Deposits' (ESP_054753_1825): Latitude (centered) 2.262°, Longitude (East) 340.079° → -19.921. Gazetteer center of Aram Chaos: 2.523, 337.608E (-22.392); the HiRISE point is used because it falls on the layered blocks.",
  "Página HiRISE 'Wind Carved Rock' (ESP_046504_1785): Latitude (centered) -1.488°, Longitude (East) 196.359° → -163.641. El texto dice que son yardangs en Medusae Fossae. Dentro de los límites del Gazetteer de Medusae Fossae (-6.04 a -1.39, 195.04–199.31E).":
    "HiRISE page 'Wind Carved Rock' (ESP_046504_1785): Latitude (centered) -1.488°, Longitude (East) 196.359° → -163.641. The text says these are yardangs in Medusae Fossae. Within the Gazetteer bounds of Medusae Fossae (-6.04 to -1.39, 195.04–199.31E).",
  "Resumen #1002 del taller EZ 2015 (Barker, James, Chamitoff, Clifford): 'a Landing Site (LS) located in Arcadia Planetia, along the Phlegra Dorsa, at 39°N 172°E'. La fuente no indica el sistema de latitud. Valores redondeados a grados enteros.":
    "Abstract #1002 from the 2015 EZ workshop (Barker, James, Chamitoff, Clifford): 'a Landing Site (LS) located in Arcadia Planetia, along the Phlegra Dorsa, at 39°N 172°E'. The source does not state the latitude system. Values rounded to whole degrees.",
  "Resumen #1009: 'The plateau above the Mawrth Vallis outflow channel near 340.8°E, 24.3°N'. Longitud convertida: 340.8-360 = -19.2. Aviso: el texto da la ubicación aproximada de la meseta y no la llama explícitamente 'centro de la EZ'.":
    "Abstract #1009: 'The plateau above the Mawrth Vallis outflow channel near 340.8°E, 24.3°N'. Converted longitude: 340.8-360 = -19.2. Caveat: the text gives the approximate location of the plateau and does not explicitly call it the 'center of the EZ'.",
  "Resumen #1011 (Viola, McEwen, Dundas): 'Erebus Montes: This proposed site is centered near 192.1°E, 39.0°N'. Longitud convertida: 192.1-360 = -167.9. El mismo resumen propone una segunda EZ, Acheron Fossae, en 220.6°E, 39.8°N (-139.4). La fuente no indica el sistema de latitud.":
    "Abstract #1011 (Viola, McEwen, Dundas): 'Erebus Montes: This proposed site is centered near 192.1°E, 39.0°N'. Converted longitude: 192.1-360 = -167.9. The same abstract proposes a second EZ, Acheron Fossae, at 220.6°E, 39.8°N (-139.4). The source does not state the latitude system.",
  "Resumen #1012: 'centered at 20°05' N, 126°38' E'. Paso de grados y minutos a decimal: 20+5/60 = 20.0833 y 126+38/60 = 126.6333. La fuente no indica el sistema de latitud.":
    "Abstract #1012: 'centered at 20°05' N, 126°38' E'. Degrees and minutes to decimal: 20+5/60 = 20.0833 and 126+38/60 = 126.6333. The source does not state the latitude system.",
  "Resumen #1033 (Head et al.): 'The Dichotomy Boundary Deuteronilus Mensae (DBDM) Exploration Zone (EZ) (39.11° N, 23.199° E)'. Sin conversión. Otra EZ en la misma región es la #1044 de Plaut, con un mapa de 20–24°E y 40–42°N. La fuente no indica el sistema de latitud.":
    "Abstract #1033 (Head et al.): 'The Dichotomy Boundary Deuteronilus Mensae (DBDM) Exploration Zone (EZ) (39.11° N, 23.199° E)'. No conversion. Another EZ in the same region is Plaut's #1044, with a map of 20–24°E and 40–42°N. The source does not state the latitude system.",
  "Resumen #1034: 'The center of the Exploration Zone is 17.747° N 77.037° E'. Sin conversión. El centro de la EZ está a unos 0,7° al suroeste del lugar de aterrizaje de Perseverance.":
    "Abstract #1034: 'The center of the Exploration Zone is 17.747° N 77.037° E'. No conversion. The center of the EZ is about 0.7° southwest of the Perseverance landing site.",
  "Resumen #1036: 'centered atop an inferred tilted fault block ... in the western aspect of Coprates Chasma, 293.367°E -11.684°N'. Longitud convertida: 293.367-360 = -66.633. No sirve como sustituto de Ius Chasma: en el taller de 2015 no encontré ninguna EZ propia de Ius Chasma. Otra EZ de cañón es la de Melas Chasma oriental (#1007), cuyo texto extraído no daba coordenadas numéricas.":
    "Abstract #1036: 'centered atop an inferred tilted fault block ... in the western aspect of Coprates Chasma, 293.367°E -11.684°N'. Converted longitude: 293.367-360 = -66.633. It does not work as a substitute for Ius Chasma: in the 2015 workshop we found no EZ in Ius Chasma itself. Another canyon EZ is the eastern Melas Chasma one (#1007), whose extracted text gave no numeric coordinates.",
  "Resumen #1037: 'Located at 39.05° S, 101.91° E, the Hellas Rim EZ'. Sin conversión. Hay una EZ vecina de Rice et al. (#1038), 'centered near 40°S; 104°E'.":
    "Abstract #1037: 'Located at 39.05° S, 101.91° E, the Hellas Rim EZ'. No conversion. There is a neighboring EZ by Rice et al. (#1038), 'centered near 40°S; 104°E'.",
  "Resumen #1041: 'located in the northwest region of Terra Sirenum (29° S, 166° W)'. La fuente usa longitud oeste: 166°W = -166° este. Son las coordenadas del cráter (110 km de diámetro), redondeadas a grados enteros. El resumen sitúa la EZ/LS sobre el fondo del cráter, pero no da su centro exacto. La fuente no indica si la longitud oeste es planetográfica.":
    "Abstract #1041: 'located in the northwest region of Terra Sirenum (29° S, 166° W)'. The source uses west longitude: 166°W = -166° east. These are the coordinates of the crater (110 km in diameter), rounded to whole degrees. The abstract places the EZ/LS on the crater floor but does not give its exact center. The source does not say whether the west longitude is planetographic.",
  "Resumen #1053: 'The proposed EZ (48.062E, 42.187N) is in the Protonilus Mensae region'. Sin conversión. La fuente no indica el sistema de latitud.":
    "Abstract #1053: 'The proposed EZ (48.062E, 42.187N) is in the Protonilus Mensae region'. No conversion. The source does not state the latitude system.",
  "SLDEM2015 (59 m). Solo gemelos: no entra en el ranking ni en la validación del polo sur":
    "SLDEM2015 (59 m). Twins only: not part of the ranking or of the south pole validation",
  "Solo existe el mosaico LROC genérico 'de Gerlache Rim' NAC_ROI_DEGERRIMLO1_P885S2933 (centro -88.5, 293.3 E = -66.7; límites lat -89.02 a -87.79, lon -83.18 a -41.31; cotejado el 14/11/2026), que puede cubrir Rim 1 y Rim 2. No hay centro verificado para Rim 1. Polígono en la release USGS DOI 10.5066/P13FD9ZD (no leída).":
    "Only the generic LROC mosaic 'de Gerlache Rim' NAC_ROI_DEGERRIMLO1_P885S2933 exists (center -88.5, 293.3 E = -66.7; bounds lat -89.02 to -87.79, lon -83.18 to -41.31; checked on 14 Nov 2026), which may cover both Rim 1 and Rim 2. There is no verified center for Rim 1. Polygon in the USGS release DOI 10.5066/P13FD9ZD (not read).",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'dteec_002175_2210_001410_2210_a01', categoría 'Impact terrain'): 100×100 celdas a 20 m (public/terrain/dteec_002175_2210_001410_2210_a01.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/PSP_002175_2210_PSP_001410_2210/DTEEC_002175_2210_001410_2210_A01.tif.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'dteec_002175_2210_001410_2210_a01', category 'Impact terrain'): 100×100 cells at 20 m (public/terrain/dteec_002175_2210_001410_2210_a01.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/PSP_002175_2210_PSP_001410_2210/DTEEC_002175_2210_001410_2210_A01.tif.",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'dteec_008669_1705_009025_1705_a01', categoría 'Valleys & fans'): 100×100 celdas a 20 m (public/terrain/dteec_008669_1705_009025_1705_a01.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/PSP_008669_1705_PSP_009025_1705/DTEEC_008669_1705_009025_1705_A01.tif.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'dteec_008669_1705_009025_1705_a01', category 'Valleys & fans'): 100×100 cells at 20 m (public/terrain/dteec_008669_1705_009025_1705_a01.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/PSP_008669_1705_PSP_009025_1705/DTEEC_008669_1705_009025_1705_A01.tif.",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'dteec_020873_1640_020161_1640_a01', categoría 'Ridges & layered terrain'): 100×100 celdas a 20 m (public/terrain/dteec_020873_1640_020161_1640_a01.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_020873_1640_ESP_020161_1640/DTEEC_020873_1640_020161_1640_A01.tif.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'dteec_020873_1640_020161_1640_a01', category 'Ridges & layered terrain'): 100×100 cells at 20 m (public/terrain/dteec_020873_1640_020161_1640_a01.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_020873_1640_ESP_020161_1640/DTEEC_020873_1640_020161_1640_A01.tif.",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'dteec_022482_1830_022337_1830_a01', categoría 'Ridges & layered terrain'): 100×100 celdas a 20 m (public/terrain/dteec_022482_1830_022337_1830_a01.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_022482_1830_ESP_022337_1830/DTEEC_022482_1830_022337_1830_A01.tif.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'dteec_022482_1830_022337_1830_a01', category 'Ridges & layered terrain'): 100×100 cells at 20 m (public/terrain/dteec_022482_1830_022337_1830_a01.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_022482_1830_ESP_022337_1830/DTEEC_022482_1830_022337_1830_A01.tif.",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'dteec_041282_1520_047150_1520_a01', categoría 'Ridges & layered terrain'): 100×100 celdas a 20 m (public/terrain/dteec_041282_1520_047150_1520_a01.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_041282_1520_ESP_047150_1520/DTEEC_041282_1520_047150_1520_A01.tif.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'dteec_041282_1520_047150_1520_a01', category 'Ridges & layered terrain'): 100×100 cells at 20 m (public/terrain/dteec_041282_1520_047150_1520_a01.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_041282_1520_ESP_047150_1520/DTEEC_041282_1520_047150_1520_A01.tif.",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'dteed_054086_2330_054007_2330_a01', categoría 'Ridges & layered terrain'): 100×100 celdas a 20 m (public/terrain/dteed_054086_2330_054007_2330_a01.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_054086_2330_ESP_054007_2330/DTEED_054086_2330_054007_2330_A01.tif.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'dteed_054086_2330_054007_2330_a01', category 'Ridges & layered terrain'): 100×100 cells at 20 m (public/terrain/dteed_054086_2330_054007_2330_a01.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_054086_2330_ESP_054007_2330/DTEED_054086_2330_054007_2330_A01.tif.",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'dteed_072690_1925_064631_1925_a01', categoría 'Valleys & fans'): 100×100 celdas a 20 m (public/terrain/dteed_072690_1925_064631_1925_a01.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_072690_1925_ESP_064631_1925/DTEED_072690_1925_064631_1925_A01.tif.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'dteed_072690_1925_064631_1925_a01', category 'Valleys & fans'): 100×100 cells at 20 m (public/terrain/dteed_072690_1925_064631_1925_a01.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS; DTM: https://astrogeo-ard.s3-us-west-2.amazonaws.com/mars/mro/hirise/controlled/dtm/ESP_072690_1925_ESP_064631_1925/DTEED_072690_1925_064631_1925_A01.tif.",
  "Parche HiRISE del visor 3D (src/data/catalog.json, id 'jezero', categoría 'Valleys & fans'): 100×100 celdas a 20 m (public/terrain/jezero.f32), remuestreado a 30 m por media de áreas. Fuente del parche: HiRISE · NASA/JPL/USGS.":
    "HiRISE patch from the 3D viewer (src/data/catalog.json, id 'jezero', category 'Valleys & fans'): 100×100 cells at 20 m (public/terrain/jezero.f32), resampled to 30 m by area averaging. Patch source: HiRISE · NASA/JPL/USGS.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: A11_LM, módulo lunar Eagle, 0.67416, 23.47314.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: A11_LM, lunar module Eagle, 0.67416, 23.47314.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: A12_LM, módulo lunar Intrepid, -3.0128, -23.4219.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: A12_LM, lunar module Intrepid, -3.0128, -23.4219.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: A14_LM, módulo lunar Antares, -3.64589, -17.47194.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: A14_LM, lunar module Antares, -3.64589, -17.47194.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: A15_LM, módulo lunar Falcon, 26.13239, 3.6333.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: A15_LM, lunar module Falcon, 26.13239, 3.6333.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: A16_LM, módulo lunar Orion, -8.9734, 15.5011.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: A16_LM, lunar module Orion, -8.9734, 15.5011.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: A17_LM, módulo lunar Challenger, 20.1911, 30.7723.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: A17_LM, lunar module Challenger, 20.1911, 30.7723.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: ChangE3, módulo de aterrizaje, 44.1214, -19.5117.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: ChangE3, lander, 44.1214, -19.5117.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: ChangE4, módulo de aterrizaje, -45.4562, 177.5886.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: ChangE4, lander, -45.4562, 177.5886.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: ChangE5, módulo de aterrizaje, 43.0576, -51.9161.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: ChangE5, lander, 43.0576, -51.9161.",
  "Shapefile 'Anthropogenic Objects' de LROC (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; mantiene las coordenadas de Wagner et al. 2017, Icarus 283), leído el 14/11/2026: ChangE6, módulo de aterrizaje, -41.6383, -153.9857.":
    "LROC 'Anthropogenic Objects' shapefile (ANTHROPOGENIC_OBJECTS_180.ZIP, PDS LROLRC_2001/EXTRAS; keeps the coordinates of Wagner et al. 2017, Icarus 283), read on 14 Nov 2026: ChangE6, lander, -41.6383, -153.9857.",
  "Apollo 15 (Hadley–Apeninos)":
    "Apollo 15 (Hadley–Apennines)",
  "Apollo 16 (tierras altas de Descartes)":
    "Apollo 16 (Descartes Highlands)",
  "Chang'e 4 (cráter Von Kármán, cara oculta)":
    "Chang'e 4 (Von Kármán crater, far side)",
  "Chang'e 6 (cuenca Apollo, cara oculta)":
    "Chang'e 6 (Apollo basin, far side)",
  "Foso de Mare Ingenii (posible tubo de lava, cara oculta)":
    "Mare Ingenii pit (possible lava tube, far side)",
  "Foso de Mare Tranquillitatis (posible tubo de lava)":
    "Mare Tranquillitatis pit (possible lava tube)",
  "Foso de Marius Hills (posible tubo de lava)":
    "Marius Hills pit (possible lava tube)",
  "posición no verificada (centro_crater_iau_lon_no_verificada)":
    "position not verified (IAU crater center; longitude not verified)",
  "posición no verificada (lat_gsfc_lon_mosaico_compartido_no_verificada)":
    "position not verified (GSFC latitude, longitude from a shared mosaic; not verified)",
  "posición no verificada (no_verificada_centro_mosaico_compartido)":
    "position not verified (not verified; center of a shared mosaic)",
  "posición no verificada (no_verificada_punto_c2_glaser)":
    "position not verified (not verified; Gläser point C2)",
  "posición no verificada (punto_c1_glaser_no_es_centro)":
    "position not verified (Gläser point C1, not the center)",
  // Nombres en español del catálogo de parches (catalog.json) en el visor de globos.
  "Departamento Antofagasta de la Sierra, Argentina":
    "Antofagasta de la Sierra Department, Argentina",
  "Provincia de Chañaral, Chile":
    "Chañaral Province, Chile",
  "Provincia de Tocopilla, Chile":
    "Tocopilla Province, Chile",
};

Object.assign(dataEn, DATOS_EN);

/** Textos de los datos con una parte variable (escala de la rugosidad…) que solo cambian en inglés. */
const dataEnPatterns: [RegExp, string][] = [
  [/^Rugosidad a ~(.+) \(m\)$/, "Roughness at ~$1 (m)"],
  [/^Malla polar (\d+) km \((.+)\)$/, "Polar grid $1 km ($2)"],
];

/** «71.9°N 31.1°W» → «71,9° N 31,1° O»: coordenadas de los datos con el formato español de la app. */
const coordEs = (text: string) =>
  text.replace(/(\d)\.(\d)/g, "$1,$2").replace(/°\s*([NSEW])/g, (_, h: string) => `° ${h === "W" ? "O" : h}`);

/** Textos de los datos en inglés con parte variable que se muestran en español. */
const dataEsPatterns: [RegExp, string | ((match: string, ...groups: string[]) => string)][] = [
  [/^Antarctica · (.+)$/, (_, rest) => `Antártida · ${coordEs(rest)}`],
  [/^Greenland · (.+)$/, (_, rest) => `Groenlandia · ${coordEs(rest)}`],
  // Teselas de las referencias HiRISE de results.json («Western Jezero · tesela 3»).
  [/^(.+)( · tesela \d+(?: de \d+ km)?)$/, (_, name, rest) => `${tr(name)}${rest}`],
];

const en = () => current === "en";
/** Nombre legible de un id interno (región, sitio o tesela) citado dentro de una nota de los datos. */
function idName(id: string): string {
  const name = NOMBRES_ID[id];
  if (name) return tr(name);
  const tile = /^(.+)_t(\d+)km_(\d+)$/.exec(id);
  if (tile && NOMBRES_ID[tile[1]]) return tr(`${NOMBRES_ID[tile[1]]} · tesela ${Number(tile[3])} de ${tile[2]} km`);
  return id.replace(/_/g, " ");
}
/** Texto de un código de calidad de coordenadas (los mismos que lm.cq.* de la ficha). */
const cqText = (code: string) => messages[current][`lm.cq.${code}`] ?? messages.es[`lm.cq.${code}`] ?? code.replace(/_/g, " ");
/** El mismo texto como aclaración de «posición no verificada», sin repetir esas palabras si el código ya las trae. */
const cqDetail = (code: string) => {
  const text = cqText(code);
  const rest = text.replace(/^(?:not verified|no verificada)\s*/, "");
  return rest === text ? `: ${text}` : ` ${rest}`;
};
/** Fecha dd/mm/aaaa de los datos, escrita según el idioma. */
const dateText = (d: string, m: string, y: string) => en()
  ? new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  : `${d}/${m}/${y}`;
const catText = (cat: string) => messages[current][`cat.${cat}`] ?? cat;
const ID_TOKEN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

/**
 * Notas de los datos con parte variable. Cada regla escribe el texto en el idioma actual: en inglés lo traduce
 * y en los dos idiomas cambia los ids internos (regiones, códigos de calidad, nombres de módulos del pipeline)
 * por frases legibles. Las cifras salen siempre de la propia nota.
 */
const dataRules: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(.+) · tesela (\d+)(?: de (\d+) km)?$/, (m) => !en() ? m[0]
    : `${tr(m[1])} · tile ${m[2]}${m[3] ? ` of ${m[3]} km` : ""}`],
  [/^Grupo de (\d+) referencias L0 \(ver reference_points\)\.$/, (m) => en()
    ? `Group of ${m[1]} references.` : `Grupo de ${m[1]} referencias.`],
  // usable_note: por qué una referencia no puntúa.
  [/^posición no verificada \(([a-z0-9_]+)\)(?:; misma posición que ([a-z0-9_]+))?(; duplicada: no se puntúa \(cuenta la primera\))?$/, (m) => en()
    ? `position not verified${cqDetail(m[1])}${m[2] ? `; same position as ${idName(m[2])}` : ""}${m[3] ? "; duplicate: not scored (the first one counts)" : ""}`
    : `posición no verificada${cqDetail(m[1])}${m[2] ? `; misma posición que ${idName(m[2])}` : ""}${m[3] ? "; duplicada: no puntúa (cuenta la primera)" : ""}`],
  [/^SLDEM2015 \((.+)\)\. Solo gemelos: no entra en el ranking ni en la validación del polo sur$/, (m) => en()
    ? `SLDEM2015 (${m[1]}). Twins only: not included in the ranking or in the south pole validation` : m[0]],
  [/^solo MOLA según hrsc_check a (\d+) km \((R400 = [\d.]+, eq1m = [\d.]+)\): (\d+) m o peor, más grueso que el píxel de (\d+) m; no se puntúa en L0 ni se tesela en L1$/, (m) => en()
    ? `MOLA only, according to the HRSC coverage check within ${m[1]} km (${m[2]}): ${m[3]} m or coarser, coarser than the ${m[4]} m pixel; not scored at the coarsest scale and not split into tiles at the next one`
    : `solo MOLA, según la comprobación de cobertura HRSC a ${m[1]} km (${m[2]}): ${m[3]} m o peor, más grueso que el píxel de ${m[4]} m; no puntúa en la escala más gruesa ni se divide en teselas en la siguiente`],
  [/^cobertura HRSC dudosa según hrsc_check a (\d+) km \((R400 = [\d.]+, eq1m = [\d.]+)\)$/, (m) => en()
    ? `doubtful HRSC coverage, according to the coverage check within ${m[1]} km (${m[2]})`
    : `cobertura HRSC dudosa, según la comprobación de cobertura a ${m[1]} km (${m[2]})`],
  [/^cobertura HRSC dudosa en la tesela \((R400 = [\d.]+, eq1m = [\d.]+); sitio: (hrsc|dudoso|mola)\)$/, (m) => {
    const site = { hrsc: ["con HRSC", "with HRSC"], dudoso: ["dudoso", "doubtful"], mola: ["solo MOLA", "MOLA only"] }[m[2] as "hrsc" | "dudoso" | "mola"];
    return en() ? `doubtful HRSC coverage in the tile (${m[1]}; the site as a whole: ${site[1]})`
      : `cobertura HRSC dudosa en la tesela (${m[1]}; el sitio en conjunto: ${site[0]})`;
  }],
  // source_note: de dónde sale la posición de cada referencia.
  [/^teselas de (\d+) km dentro de los límites de ([a-z0-9_]+) \(tesela (\d+), ([-+][\d.]+) km E, ([-+][\d.]+) km N del centro de la región\)\. Hereda la fuente de la región [a-z0-9_]+: ([^]+)$/, (m) => en()
    ? `Tile ${m[3]} of the ${m[1]} km tiles within the bounds of ${idName(m[2])} (${m[4]} km E, ${m[5]} km N of the region center). It inherits the source of the region: ${tr(m[6])}`
    : `Tesela ${m[3]} de las de ${m[1]} km dentro de los límites de ${idName(m[2])} (${m[4]} km E, ${m[5]} km N del centro de la región). Hereda la fuente de la región: ${tr(m[6])}`],
  [/^centro de ([a-z0-9_]+) \(región sin límites publicados\) \(tesela (\d+), ([-+][\d.]+) km E, ([-+][\d.]+) km N del centro de la región\)\. Hereda la fuente de la región [a-z0-9_]+: ([^]+)$/, (m) => en()
    ? `Center of ${idName(m[1])}, a region with no published bounds (tile ${m[2]}, ${m[3]} km E, ${m[4]} km N of the region center). It inherits the source of the region: ${tr(m[5])}`
    : `Centro de ${idName(m[1])}, región sin límites publicados (tesela ${m[2]}, ${m[3]} km E, ${m[4]} km N del centro de la región). Hereda la fuente de la región: ${tr(m[5])}`],
  [/^ventana (\d+) de (\d+)×(\d+) \(paso (\d+) km\) alrededor de ([a-z0-9_]+) \(([-+][\d.]+) km E, ([-+][\d.]+) km N del sitio\)\. Hereda la fuente del sitio [a-z0-9_]+: ([^]+)$/, (m) => en()
    ? `Window ${m[1]} of a ${m[2]}×${m[3]} grid (${m[4]} km step) around ${idName(m[5])} (${m[6]} km E, ${m[7]} km N of the site). It inherits the source of the site: ${tr(m[8])}`
    : `Ventana ${m[1]} de una malla de ${m[2]}×${m[3]} (paso ${m[4]} km) alrededor de ${idName(m[5])} (${m[6]} km E, ${m[7]} km N del sitio). Hereda la fuente del sitio: ${tr(m[8])}`],
  [/^malla regular generada \(azimutal polar, paso (\d+) km, (\d+)–(\d+)°S\): malla regular generada en la azimutal polar sur \(reference_sites\.moon_polar_grid\); no es un sitio publicado\. Regiones que contienen el punto: (.+)\.$/, (m) => {
    const none = m[4] === "ninguna";
    const list = none ? "" : m[4].split(", ").map(idName).join("; ");
    return en()
      ? `Regular grid generated by the method in the south polar azimuthal projection (${m[1]} km step, ${m[2]}–${m[3]}°S); it is not a published site. Regions that contain the point: ${none ? "none" : list}.`
      : `Malla regular generada por el método en la proyección azimutal polar sur (paso ${m[1]} km, ${m[2]}–${m[3]}°S); no es un sitio publicado. Regiones que contienen el punto: ${none ? "ninguna" : list}.`;
  }],
  [/^Parche HiRISE del visor 3D \(src\/data\/catalog\.json, id '[^']+', categoría '([^']+)'\): (\d+×\d+) celdas a (\d+) m \([^)]+\), remuestreado a (\d+) m por media de áreas\. Fuente del parche: (.+?)(?:; DTM: (\S+?))?\.$/, (m) => en()
    ? `HiRISE patch from the 3D comparison (category “${catText(m[1])}”): ${m[2]} cells at ${m[3]} m, resampled to ${m[4]} m by area averaging. Patch source: ${m[5]}${m[6] ? `; DTM: ${m[6]}` : ""}.`
    : `Parche HiRISE de la comparación en 3D (categoría «${catText(m[1])}»): ${m[2]} celdas a ${m[3]} m, remuestreado a ${m[4]} m por media de áreas. Fuente del parche: ${m[5]}${m[6] ? `; DTM: ${m[6]}` : ""}.`],
  [/^Shapefile 'Anthropogenic Objects' de LROC \((.+?); mantiene las coordenadas de (.+?)\), leído el (\d+)\/(\d+)\/(\d+): (\w+), (?:módulo lunar (\w+)|módulo de aterrizaje), (.+)\.$/, (m) => en()
    ? `LROC 'Anthropogenic Objects' shapefile (${m[1]}; it keeps the coordinates of ${m[2]}), read on ${dateText(m[3], m[4], m[5])}: ${m[6]}, ${m[7] ? `lunar module ${m[7]}` : "lander"}, ${m[8]}.`
    : m[0]],
  [/^Lunar Pit Locations de LROC \((.+?); Atlas de fosos de LROC\), leído el (\d+)\/(\d+)\/(\d+): ([^;]+?)(?:; (\d+) m de profundidad( interior)?)?\.$/, (m) => en()
    ? `LROC Lunar Pit Locations (${m[1]}; LROC pit atlas), read on ${dateText(m[2], m[3], m[4])}: ${m[5]}${m[6] ? `; ${m[6]} m ${m[7] ? "inner depth" : "deep"}` : ""}.`
    : m[0]],

];

/** Nombres del catálogo de parches traducidos por el equipo (commit 5ea7f7e): respaldo de DATOS_ES. */
const dataEs: Record<string, string> = {
  // Lugares de los pares de src/data/nasa-analogs.json (Análogos de NASA).
  "Amazonis Planitia ice crater": "Cráter con hielo de Amazonis Planitia",
  "Askja, Iceland": "Askja, Islandia",
  "Cabeus, LCROSS impact site": "Cabeus, lugar del impacto de LCROSS",
  "Central Elysium Planitia lava vent": "Fisura de lava del centro de Elysium Planitia",
  "Chicxulub, Mexico": "Chicxulub, México",
  "Descartes Highlands, Apollo 16": "Tierras altas de Descartes, Apolo 16",
  "Haughton Crater, Devon Island": "Cráter Haughton, isla Devon",
  "Holuhraun, Iceland": "Holuhraun, Islandia",
  "Home Plate, Gusev Crater": "Home Plate, cráter Gusev",
  "Indian Tunnel, Idaho": "Indian Tunnel, Idaho",
  "Jezero Crater": "Cráter Jezero",
  "Lake Salda, Türkiye": "Lago Salda, Turquía",
  "Mare Tranquillitatis Pit": "Sima del Mare Tranquillitatis",
  "Northeastern Spitsbergen, Svalbard": "Noreste de Spitsbergen, Svalbard",
  "Phoenix landing site": "Lugar de aterrizaje de Phoenix",
  "Schrödinger Basin": "Cuenca Schrödinger",
  "Shackleton Crater": "Cráter Shackleton",
  "Stillwater Complex, Montana": "Complejo Stillwater, Montana",
  "Sunset Crater, Arizona": "Cráter Sunset, Arizona",
  "2km crater on south polar layered deposits":
    "Cráter de 2 km sobre los depósitos estratificados del polo sur",
  "Alcoves on south polar layered deposit scarp":
    "Nichos en un escarpe de los depósitos estratificados del polo sur",
  "Alluvial fan in Arabia Terra":
    "Abanico aluvial en Arabia Terra",
  "Alluvial fan in far western Tyrrhena Terra":
    "Abanico aluvial en el extremo oeste de Tyrrhena Terra",
  "Alluvial fan surface with inverted channels":
    "Superficie de abanico aluvial con canales invertidos",
  "Alluvial fans in unnamed crater":
    "Abanicos aluviales en un cráter sin nombre",
  "Barchan dunes in Dulovo Crater region":
    "Dunas barjanes en la región del cráter Dulovo",
  "Basal exposure of south polar layered deposits":
    "Afloramiento basal de los depósitos estratificados del polo sur",
  "Bullseye Crater of Medusae Fossae formation over platy-ridged lava":
    "Cráter en diana de la formación Medusae Fossae sobre lava en placas con crestas",
  "Central structure and layered bedrock in 25-kilometer diameter crater":
    "Estructura central y roca estratificada en un cráter de 25 km de diámetro",
  "Central structure and layering of a large impact crater":
    "Estructura central y capas de un gran cráter de impacto",
  "Central structure of a large impact crater":
    "Estructura central de un gran cráter de impacto",
  "Central uplift of an impact crater":
    "Levantamiento central de un cráter de impacto",
  "Cerberus region intra-crater dune field":
    "Campo de dunas dentro de un cráter en la región de Cerberus",
  "Change detection in barchan dune source":
    "Detección de cambios en la zona de origen de dunas barjanes",
  "Changes in intracrater dunes":
    "Cambios en dunas dentro de un cráter",
  "Channelized lava flow though a constriction with well-preserved highstands":
    "Colada de lava canalizada por un estrechamiento, con marcas de nivel alto bien conservadas",
  "Circular feature and cone cluster in platy lavas in Cerberus Palus":
    "Forma circular y grupo de conos en lavas en placas de Cerberus Palus",
  "Classic barchan dunes":
    "Dunas barjanes clásicas",
  "Colorful layered bedrock in eroded crater in Terra Sirenum":
    "Roca estratificada multicolor en un cráter erosionado de Terra Sirenum",
  "Columnar jointing exposed in an impact crater in Marte Vallis":
    "Disyunción columnar expuesta en un cráter de impacto de Marte Vallis",
  "Columnar jointing in wall of impact crater":
    "Disyunción columnar en la pared de un cráter de impacto",
  "Crater ejecta lower than plains":
    "Eyecta de cráter más baja que la llanura",
  "Crater on south polar layered deposits":
    "Cráter sobre los depósitos estratificados del polo sur",
  "Dark dune field topography in Bunge Crater":
    "Topografía de un campo de dunas oscuras en el cráter Bunge",
  "Deformation of north polar layered deposit strata":
    "Deformación de los estratos de los depósitos estratificados del polo norte",
  "Distal extent of inverted delta material":
    "Extremo distal de material deltaico invertido",
  "Dune forms in Viking 1 image 436S03":
    "Formas de dunas de la imagen 436S03 del Viking 1",
  "Dune interaction with topography in Ganges Chasma":
    "Interacción de las dunas con el relieve en Ganges Chasma",
  "Dune monitoring in crater":
    "Seguimiento de dunas en un cráter",
  "Dunes on slope in CTX B01_009975_1728_XI_07S094W":
    "Dunas en pendiente en CTX B01_009975_1728_XI_07S094W",
  "Echus Chasma layered deposits":
    "Depósitos estratificados de Echus Chasma",
  "Exposure of polar layered deposits on ridges and troughs":
    "Afloramiento de depósitos estratificados polares en crestas y depresiones",
  "Exposure of polar layered deposits with unconformities":
    "Afloramiento de depósitos estratificados polares con discordancias",
  "Exposure of south polar layered deposits":
    "Afloramiento de los depósitos estratificados del polo sur",
  "Exposures of layered bedrock northwest of Hellas region":
    "Afloramientos de roca estratificada al noroeste de la región de Hellas",
  "Fan at intersection of valley and crater wall in Xanthe Terra":
    "Abanico donde un valle llega a la pared de un cráter en Xanthe Terra",
  "Fan/deltaic landform in west Eberswalde Crater":
    "Abanico o delta en el oeste del cráter Eberswalde",
  "Faults in south polar layered deposits Promethei Lingula region":
    "Fallas en los depósitos estratificados del polo sur, región de Promethei Lingula",
  "Fresh 1-km impact crater in Arcadia Planitia":
    "Cráter de impacto reciente de 1 km en Arcadia Planitia",
  "Fresh crater":
    "Cráter reciente",
  "Fresh crater with lots of gullies":
    "Cráter reciente con muchos barrancos",
  "Fresh double-layered crater with possible ponded materials":
    "Cráter reciente de doble capa con posibles materiales encharcados",
  "Fresh impact crater":
    "Cráter de impacto reciente",
  "Fresh impact crater with gullies and bedrock":
    "Cráter de impacto reciente con barrancos y roca madre",
  "Fresh shallow valley":
    "Valle poco profundo reciente",
  "High-lava mark in Kasei Valles":
    "Marca del nivel más alto de la lava en Kasei Valles",
  "Impact crater with active slope processes":
    "Cráter de impacto con procesos activos en las laderas",
  "Impact crater with central pit on floor of larger crater":
    "Cráter de impacto con foso central en el fondo de un cráter mayor",
  "Intact layered rocks uplifted in unnamed crater off of Solis Dorsa":
    "Rocas estratificadas intactas levantadas en un cráter sin nombre junto a Solis Dorsa",
  "Interesting periglacial assemblage in Utopia Planitia":
    "Conjunto periglaciar interesante en Utopia Planitia",
  "Intracrater climbing dunes south of Aonia Terra":
    "Dunas trepadoras dentro de un cráter al sur de Aonia Terra",
  "Intracrater dune changes":
    "Dunas cambiantes dentro de un cráter",
  "Intracrater dunes":
    "Dunas dentro de un cráter",
  "Intracrater sand dunes and patch changes":
    "Dunas de arena dentro de un cráter y cambios en manchas",
  "Islands and pendant bar like form in lava channel":
    "Islas y formas de barra colgante en un canal de lava",
  "Large dated impact crater":
    "Gran cráter de impacto datado",
  "Lava channel and cataract in south-central Elysium Planitia":
    "Canal de lava y catarata en el centro-sur de Elysium Planitia",
  "Lava falls in northern Kasei Valles":
    "Cascadas de lava en el norte de Kasei Valles",
  "Lava filling a large crater in Elysium Planitia":
    "Lava que rellena un gran cráter en Elysium Planitia",
  "Lava flow spilling into crater in southwestern Daedalia Planum":
    "Colada de lava que se vierte en un cráter en el suroeste de Daedalia Planum",
  "Lava spilling into crater":
    "Lava que se vierte en un cráter",
  "Lava vent with channels":
    "Boca de lava con canales",
  "Layered bedrock in central uplift":
    "Roca estratificada en un levantamiento central",
  "Layered deposits in crater in Arabia Terra":
    "Depósitos estratificados en un cráter de Arabia Terra",
  "Layered deposits in impact crater in Utopia Planitia":
    "Depósitos estratificados en un cráter de impacto de Utopia Planitia",
  "Layered materials on northeast Hellas Planitia rim":
    "Materiales estratificados en el borde noreste de Hellas Planitia",
  "Layered mesa in Coprates Chasm":
    "Meseta estratificada en Coprates Chasma",
  "Layered yardangs":
    "Yardangs estratificados",
  "Libya Montes layered deposits and possible MSL rover landing site":
    "Depósitos estratificados de Libya Montes y posible sitio de aterrizaje del rover MSL",
  "Light-toned layered deposits within valleys southwest of Ladon Valles":
    "Depósitos estratificados claros en valles al suroeste de Ladon Valles",
  "Light-toned layered material along Ius Chasma plateau":
    "Material estratificado claro a lo largo de la meseta de Ius Chasma",
  "Lineated valley fill in Deuteronilus Mensae":
    "Relleno de valle lineado en Deuteronilus Mensae",
  "Lobate debris apron with ridge-like structures in Tempe Terra":
    "Delantal de derrubios lobulado con estructuras en cresta en Tempe Terra",
  "Lobate form at intersection of short valley and crater wall":
    "Forma lobulada donde un valle corto llega a la pared de un cráter",
  "Mass movement on wall of crater in Lyot Crater ejecta blanket":
    "Movimiento en masa en la pared de un cráter dentro del manto de eyecta del cráter Lyot",
  "McLaughlin Crater dunes":
    "Dunas del cráter McLaughlin",
  "Noachis Terra sand dune topography":
    "Topografía de dunas de arena en Noachis Terra",
  "North polar layered deposits 160-meter diameter crater monitoring":
    "Seguimiento de un cráter de 160 m de diámetro en los depósitos estratificados del polo norte",
  "North polar linear dune source changes":
    "Cambios en la zona de origen de dunas lineales del polo norte",
  "Northeast Melas Chasma dune fields and wall rock":
    "Campos de dunas y roca de la pared en el noreste de Melas Chasma",
  "Northern Hellas Planitia layered bedrock":
    "Roca estratificada en el norte de Hellas Planitia",
  "Northern plains ridge":
    "Cresta de las llanuras del norte",
  "Pasted-on material on crater ejecta":
    "Material adherido sobre eyecta de cráter",
  "Possible future landing site near eastern valley of Jezero Crater":
    "Posible sitio de aterrizaje futuro cerca del valle oriental del cráter Jezero",
  "Possible glacier on mesa wall in Protonilus Mensae":
    "Posible glaciar en la pared de una meseta de Protonilus Mensae",
  "Possible volcanic vent east of Olympus Mons":
    "Posible boca volcánica al este de Olympus Mons",
  "Potential lava flow in Xanthe Terra":
    "Posible colada de lava en Xanthe Terra",
  "Relatively dust free lavas from Arsia Mons":
    "Lavas de Arsia Mons con relativamente poco polvo",
  "Reticulate bedform and recent impact crater":
    "Forma de lecho reticulada y cráter de impacto reciente",
  "Reull Vallis and valley cut through crater":
    "Reull Vallis y un valle que corta un cráter",
  "Ridges in Diacria region":
    "Crestas en la región de Diacria",
  "Sinuos ridges in eastern Peta Crater":
    "Crestas sinuosas en el este del cráter Peta",
  "Sinuous channel in Tharsis region":
    "Canal sinuoso en la región de Tharsis",
  "Sinuous ridges with scroll-bar deposits":
    "Crestas sinuosas con depósitos de barra de meandro",
  "Sinuous troughs and ridges near Sirenum Fossae":
    "Depresiones y crestas sinuosas cerca de Sirenum Fossae",
  "Sinus Meridiani dune changes":
    "Cambios en las dunas de Sinus Meridiani",
  "Small crater filled by deltaic deposits":
    "Cráter pequeño relleno de depósitos deltaicos",
  "Small lobe of glacial cover on fresh impact crater":
    "Pequeño lóbulo de cubierta glaciar sobre un cráter de impacto reciente",
  "Small ridge near Licus Vallis":
    "Cresta pequeña cerca de Licus Vallis",
  "South polar layered deposits":
    "Depósitos estratificados del polo sur",
  "South polar layered deposits exposed in Chasma Australe wall":
    "Depósitos estratificados del polo sur expuestos en la pared de Chasma Australe",
  "South polar layered deposits exposed in Promethei Lingula":
    "Depósitos estratificados del polo sur expuestos en Promethei Lingula",
  "South polar layered deposits exposed in Ultimum Chasma":
    "Depósitos estratificados del polo sur expuestos en Ultimum Chasma",
  "Steepest north polar scarp":
    "El escarpe más empinado del polo norte",
  "Sulfates and valley system in Melas Chasma basin":
    "Sulfatos y red de valles en la cuenca de Melas Chasma",
  "Tomini Crater western ejecta":
    "Eyecta occidental del cráter Tomini",
  "Tributary glacier-like feature with parallel lineations on valley wall":
    "Forma tipo glaciar tributario con lineaciones paralelas en la pared de un valle",
  "Uplift of layered materials from the intersection of two craters":
    "Levantamiento de materiales estratificados donde se cruzan dos cráteres",
  "Valley-inverted channel transition in Arabia Terra":
    "Transición de valle a canal invertido en Arabia Terra",
  "Well-preserved 4-km impact crater":
    "Cráter de impacto de 4 km bien conservado",
  "Well-preserved impact crater with steep slopes":
    "Cráter de impacto bien conservado con laderas empinadas",
  "Western Jezero":
    "Jezero occidental",
  "Wrinkle ridges in west Meridiani Planum":
    "Crestas arrugadas en el oeste de Meridiani Planum",
  "Al Wusta Governorate, Oman":
    "Gobernación de Al Wusta, Omán",
  "Algodones Dunes":
    "Dunas de Algodones",
  "Amboy Crater":
    "Cráter Amboy",
  "Asyut, Egypt":
    "Asiut, Egipto",
  "Boshruyeh County, Iran":
    "Condado de Boshruyeh, Irán",
  "Canyonlands rim":
    "Borde de Canyonlands",
  "Carrizozo lava flow":
    "Colada de lava de Carrizozo",
  "Death Valley Canyon fan":
    "Abanico de Death Valley Canyon",
  "District of Al-Jufra, Libya":
    "Distrito de Al Jufra, Libia",
  "Dumont Dunes":
    "Dunas Dumont",
  "Eastern Province, Saudi Arabia":
    "Provincia Oriental, Arabia Saudita",
  "Emery County, United States":
    "Condado de Emery, Estados Unidos",
  "Ennedi-Ouest, Chad":
    "Ennedi Oeste, Chad",
  "Eureka Dunes":
    "Dunas Eureka",
  "Furnace Creek fan":
    "Abanico de Furnace Creek",
  "Green River near Mineral Bottom":
    "Río Green cerca de Mineral Bottom",
  "Hadramaut Governorate, Yemen":
    "Gobernación de Hadramaut, Yemen",
  "Halfa - حلفا, Sudan":
    "Halfa - حلفا, Sudán",
  "Hanaupah Canyon fan":
    "Abanico de Hanaupah Canyon",
  "Ica, Peru":
    "Ica, Perú",
  "Illizi District, Algeria":
    "Distrito de Illizi, Argelia",
  "Iranshahr County, Iran":
    "Condado de Iranshahr, Irán",
  "Kanaio lava field":
    "Campo de lava de Kanaio",
  "Kelso Dunes":
    "Dunas Kelso",
  "Kennicott Glacier":
    "Glaciar Kennicott",
  "Keriya County, China":
    "Condado de Keriya, China",
  "Khaki Safed, Afghanistan":
    "Khaki Safed, Afganistán",
  "Kufra, Libya":
    "Kufra, Libia",
  "Kīlauea East Rift":
    "Rift este del Kīlauea",
  "Leh district, India":
    "Distrito de Leh, India",
  "Malha - مالحة, Sudan":
    "Malha - مالحة, Sudán",
  "Matruh, Egypt":
    "Matruh, Egipto",
  "Mendenhall Glacier":
    "Glaciar Mendenhall",
  "Mesquite Flat dunes":
    "Dunas de Mesquite Flat",
  "Meteor Crater":
    "Cráter Meteor",
  "Murzuq, Libya":
    "Murzuq, Libia",
  "New Valley, Egypt":
    "Nuevo Valle, Egipto",
  "Painted Desert":
    "Desierto Pintado",
  "Panjgur District, Pakistan":
    "Distrito de Panjgur, Pakistán",
  "Pisgah lava field":
    "Campo de lava de Pisgah",
  "Red Sea State, Sudan":
    "Estado del Mar Rojo, Sudán",
  "Red Sea, Egypt":
    "Mar Rojo, Egipto",
  "Ruoqiang County, China":
    "Condado de Ruoqiang, China",
  "Ruth Glacier":
    "Glaciar Ruth",
  "SP Crater lava field":
    "Campo de lava del cráter SP",
  "San Juan River Goosenecks":
    "Meandros del río San Juan (Goosenecks)",
  "Shuanghu County, China":
    "Condado de Shuanghu, China",
  "South Fork Badlands":
    "Badlands de South Fork",
  "Suhaj, Egypt":
    "Suhaj, Egipto",
  "Sunset Crater":
    "Cráter Sunset",
  "Tabelbala, Algeria":
    "Tabelbala, Argelia",
  "Tazrouk District, Algeria":
    "Distrito de Tazrouk, Argelia",
  "Tinduf Disctrict, Algeria":
    "Distrito de Tinduf, Argelia",
  "Trail Canyon fan":
    "Abanico de Trail Canyon",
  "Ubehebe Crater":
    "Cráter Ubehebe",
  "White Sands dune field":
    "Campo de dunas de White Sands",
  "Xizang, China":
    "Xizang (Tíbet), China",
  "d'In Ghar District, Algeria":
    "Distrito de In Ghar, Argelia",
};

function initialLang(): Lang {
  return document.documentElement.lang === "en" ? "en" : "es";
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

export const getLang = () => current;
export const locale = () => (current === "en" ? "en-US" : "es");

export function t(key: string, params?: Params): string {
  const text = messages[current][key] ?? messages.es[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? "")) : text;
}

/**
 * Traduce un texto que viene de los datos. En inglés, los textos en español (dataEn); en español,
 * los nombres en inglés del catálogo de parches (dataEs). Si no lo conoce, lo devuelve igual.
 */
export function tr(text: string): string;
export function tr(text: string | null | undefined): string | null | undefined;
export function tr(text: string | null | undefined) {
  if (text == null) return text;
  if (current === "en") {
    const exact = dataEn[text];
    if (exact != null) return exact;
  } else {
    // Algunos textos de los datos llegan en inglés (títulos HiRISE, lugares de la Tierra): se muestran en español.
    const exact = DATOS_ES[text] ?? dataEs[text];
    if (exact != null) return exact;
    for (const [re, out] of dataEsPatterns) {
      if (re.test(text)) return typeof out === "string" ? text.replace(re, out) : text.replace(re, out);
    }
  }
  for (const [re, write] of dataRules) {
    const m = re.exec(text);
    if (m) return write(m);
  }
  // En español solo queda cambiar por su nombre los ids internos que alguna nota cite.
  if (current === "es") return text.includes("_") ? text.replace(ID_TOKEN, (id) => (NOMBRES_ID[id] ? idName(id) : id)) : text;
  for (const [re, out] of dataEnPatterns) if (re.test(text)) return text.replace(re, out);
  return text;
}

/** true si la clave existe en el idioma actual o en español (para textos opcionales por código). */
export function hasMsg(key: string) {
  return key in messages[current] || key in messages.es;
}

/** Número con la coma o el punto decimal del idioma, sin separador de miles. */
export function decimal(value: number, digits = 2) {
  const text = value.toFixed(digits);
  return current === "es" ? text.replace(".", ",") : text;
}

/**
 * Aplica los textos fijos del HTML:
 *   data-i18n="clave"            → textContent
 *   data-i18n-html="clave"       → innerHTML (textos con <strong>, <b>…)
 *   data-i18n-attr="attr:clave;…" → atributos (aria-label, title, alt…)
 */
export function applyStatic(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml!);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-attr]")) {
    for (const pair of el.dataset.i18nAttr!.split(";")) {
      const [attr, key] = pair.split(":").map((part) => part.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
}

export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(LANG_KEY, next); } catch { /* almacenamiento bloqueado: solo dura esta visita */ }
  applyStatic();
  for (const listener of listeners) listener();
}

/** Se llama cada vez que cambia el idioma, para volver a pintar el contenido generado por código. */
export function onLangChange(listener: () => void) {
  listeners.add(listener);
}
