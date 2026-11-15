# Pruebas de extremo a extremo (TerraTwin)

Recorren el guion de la demo ante el jurado y los contratos C1–C6 entre ramas con Playwright
(`playwright-core`, con el Chrome instalado en el sistema: no se descarga ningún navegador) y el runner
integrado de Node (`node --test`, Node 22 o superior).

## Cómo ejecutarlas

Con la app ya servida (servidor de desarrollo o `vite preview`), un comando:

```powershell
$env:BASE_URL = "http://localhost:5183"; npm run test:e2e
```

Sin `BASE_URL` se usa `http://localhost:5183`. Contra un build:

```powershell
npm run build
npx vite preview --port 4173 --strictPort    # en otra terminal
$env:BASE_URL = "http://localhost:4173"; npm run test:e2e
```

Un solo archivo: `node --test --test-reporter=spec tests/e2e/01-guion-demo.test.mjs`.

Variables opcionales: `E2E_PASO_MS` (tiempo máximo por paso, 60000 por defecto), `E2E_TOPE_IDIOMA_MS`
(tiempo máximo del recorrido de idioma por página, 300000), `E2E_GPU=hw` (WebGL por GPU en vez de SwiftShader),
`E2E_VER=1` (con ventana), `E2E_CANAL` (canal de Chrome, `chrome` por defecto).

La ejecución completa tarda unos 20 minutos con la máquina cargada (la prueba de idioma es la más larga).
La prueba de idioma deja el informe completo (cadenas ofensoras y todo el texto recogido) en
`tests/e2e/informes/idioma-<idioma>-<página>.txt` (ignorado por git).

## Qué comprueba cada archivo

Las pruebas usan solo texto visible, roles ARIA, etiquetas HTML y los atributos de contrato `data-intro` y
`data-aviso="sin-red"`: ningún id ni clase CSS de la app (la única clase es `.leaflet-container`, de Leaflet,
para no confundir las teselas del mapa con las imágenes de la ficha).

| Archivo | Comprueba |
|---|---|
| `01-guion-demo.test.mjs` | (a, b) Guion de la demo en inglés y en español (C2). Mapa: `luna-marte.html` → «Shackleton crater (center according to the IAU)» → «1 · 29.50° S · 69.51° W» → la ficha muestra una puntuación y sus dos imágenes de relieve cargadas (`naturalWidth > 0`). Globos, desde `globos.html` y desde `/` (redirige): «Find analogs» → «Compare terrain ↓» → el lienzo de la comparación 3D existe y tiene dibujo (varios colores, ninguno domina). En español: «Cráter Shackleton (centro según la IAU)», «1 · 29,50° S · 69,51° O», «Buscar análogos», «Comparar terreno ↓». |
| `02-idioma.test.mjs` | (c) Pureza de idioma (C6). En inglés recorre las dos páginas (pestañas Luna/Marte, plegables, todas las opciones de los selectores, sitios lunares —Apollo, Chang'e, fosos—, sitios de Marte, filas del ranking, conmutadores y fichas), recoge todo el texto visible y los atributos `aria-label`, `title`, `alt`, `placeholder`, y falla si alguna cadena parece española. En español hace lo inverso (inglés en textos de interfaz; las referencias bibliográficas del pie no cuentan). Informa de cada cadena con su página y el estado en que apareció. Los detectores están en `e2e/idioma.mjs`. |
| `03-marca.test.mjs` | (d) Marca (C1): «TerraTwin» en la cabecera y en el título del documento, en las dos páginas y los dos idiomas; ninguna imagen cuya ruta o texto alternativo contenga «nasa»; no aparecen «Google Mars», «Earth Analogs» ni «Análogos terrestres» (tampoco en el HTML de `/`). |
| `04-carga.test.mjs` | (e) Cada página en los dos idiomas a 1920x1080 y 375x812: sin errores de consola, sin excepciones, sin peticiones locales fallidas (404…), sin desborde horizontal (`scrollWidth ≤ innerWidth`) y con el elemento `[data-intro]` (C5) entero y visible sin desplazarse, en el idioma de la página. Los mosaicos externos que no cargan (red de la sala) se anotan pero no hacen fallar. |
| `05-sin-red.test.mjs` | (f) Sin red externa (C3): se aborta todo lo que no sea localhost. Las dos páginas siguen mostrando su contenido (el guion del mapa y los globos con dibujo), cargan imágenes locales de `/imagery/` y muestran un aviso visible `[data-aviso="sin-red"]` con `role="status"` y texto en inglés. |
| `06-cifras.test.mjs` | (g) Las cifras de la ficha del gemelo 1 de Shackleton salen de `src/data/results.json`: la prueba lee el JSON, localiza el grupo por su nombre, y compara con lo que se ve, con el redondeo de la app: coordenadas del guion (2 decimales) y de la ficha (3), puntuación de la fila y del grupo, altitud media, barras (total, terreno, superficie, clima) y la columna del gemelo en la tabla de rasgos. Nada escrito a mano. |

## Resultado en la app base (15/11, antes de fusionar las ramas de la noche)

109 pruebas y subpruebas: 60 pasan y 49 fallan (20 min). Pasan el guion del mapa en los dos idiomas, «Compare
terrain ↓» con dibujo en el lienzo 3D, las cifras de la ficha, la ausencia de excepciones, de 404 locales y de
desborde. Fallan, por defectos reales de la app: no existe el botón «Find analogs» / «Buscar análogos» (hoy «Show it
on the globes»); la marca (cabecera «Earth Analogs» / «Análogos terrestres», títulos sin «TerraTwin», imagen
`brand/nasa-logo.svg`); `favicon.ico` da 404 (error de consola en la primera página); no hay `[data-intro]` ni aviso
`[data-aviso="sin-red"]`; ids internos visibles en inglés (`moon_polar_grid`, `connecting_ridge_c1`, `nobile_rim_1`,
un parche `dteec_…`, `dist_total_m`), y títulos HiRISE y topónimos en inglés con la app en español.

## Detectores de idioma (`e2e/idioma.mjs`)

- **Español en inglés**: signos ¿ ¡; palabras de contenido inequívocamente españolas («cráter», «foso», «cuenca»,
  «posible», «tierras altas»…); dos o más palabras funcionales españolas («de», «la», «que», «con»…); tildes y eñes
  en palabras en minúscula; ids internos con guiones bajos («centro_mosaico_lroc_compartido_lon_no_verificada»).
  No cuentan: los topónimos con mayúsculas unidos por «de/del/la» («Puna de Atacama», «Valle del Cura»), las tildes
  de nombres propios con mayúscula («Río Tinto», «Chañaral») si la cadena no tiene otra señal, el nombre «Español»
  del selector de idioma, y una lista corta de nombres que en inglés también llevan diacrítico («Kármán», «Rümker»,
  «Gêrzê», «Tarapacá», «Potosí», «Gläser», «Mersoï», «daïra»). Calibrado con las 3039 líneas inglesas que recogió la
  auditoría: las 74 que marca son español real.
- **Inglés en español**: palabras de interfaz inglesas («show», «score», «terrain», «crater», «new»…) o dos o más
  palabras funcionales inglesas, salvo nombres oficiales que se dejan en inglés (regiones candidatas de Artemis III
  como «Peak near Cabeus B» o «Connecting Ridge», y «Meteor Crater»).
