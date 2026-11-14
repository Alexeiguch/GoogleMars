// Página «Globos 3D»: Luna | Tierra | Marte en un solo canvas (un contexto WebGL), con viewports y scissor
// como src/globes.ts. Se dibuja solo cuando algo cambia (sin bucle continuo).
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "./style.css";
import "./globos.css";
import { bindUiText, type UiText } from "./prefs";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadGlobeTexture } from "./globeTexture";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import {
  categoryLabel, cellSize, loadTerrain, marsClimate, metricDefinitions, patchWidth, rankEarthSites, weights,
  type Match, type Site,
} from "./data";
import { createViewer, gridSlopes, slopeBands, type Mode as TerrainMode, type ViewerSite } from "./viewer";
import { getLang, locale, onLangChange, t, tr } from "./i18n";
import {
  BEST_MIN_SCORE, BODIES, DATA, bodyName, buildEarthPoints, coord, fmt, globeReferences, isHeadlineRef, marsPatches,
  refById, topSite, twinKeyOf, twinsOf,
  windowName, type Body, type EarthPoint, type EarthRole, type EarthSite, type GlobeId, type Reference,
} from "./globosData";
import { TileLayer, direction, type TileLayerOptions } from "./tiles";

// ---------------------------------------------------------------------------------------------
// Franja de introducción: textos propios de esta página (no están en i18n.ts) y cifras de los datos ya cargados.

const UI_TEXT: UiText = {
  es: {
    "intro.lede": "La Luna, la Tierra y Marte, dibujados del mismo tamaño. Los puntos de la Tierra son los lugares que más se parecen a los sitios de referencia de la Luna y de Marte: elige uno para ver su ficha y sus gemelos. Los sitios de Marte con relieve HiRISE se comparan además en 3D con sus análogos de la Tierra, al mismo tamaño y escala.",
    "more.for": "Para {site}, un sitio de Marte con relieve HiRISE de {w} × {w} km. Elige un análogo para compararlo en 3D.",
    "pick.hirise": "Marte · relieve HiRISE · {cat}",
    "lg.hirise": "Toca un parche HiRISE de Marte para ver sus análogos y comparar el terreno en 3D.",
    "detail.compare": "Comparar el terreno en 3D",
    "step.pick": "Elige un sitio de la Luna o de Marte",
    "pick.label": "Sitio que se compara con la Tierra",
    "pick.show": "Verlo en los globos",
    "pick.note": "Sitios de referencia de la Luna y de Marte (ventanas de 30 km) y parches de Marte con relieve HiRISE (2 km). También puedes tocarlos en los globos.",
    "pick.refs": "{body} · sitios de referencia (30 km)",
    "more.forRef": "Para {site} ({body}), una ventana de {w} km: sus {n} gemelos de la Tierra, comparados con la misma ventana y la misma escala.",
    "flat.scale": "Relieve sombreado en 2D · {w} × {w} km · el relieve 3D de este sitio aún no está exportado",
    "moon.noAir": "sin atmósfera",
    "group.terrainGrid": "Terreno · medido en esta cuadrícula (celdas de {c} m; el mapa Luna y Marte mide a 400 m)",
    "group.climateRef": "Clima · Tierra: ERA5/Meteomatics (Marte: valores típicos)",
    "jump": "Comparar terreno en 3D",
    "intro.figMoon": "sitios de referencia en la Luna",
    "intro.figMars": "sitios de referencia en Marte",
    "intro.figPatches": "puntos de la Tierra comparados",
  },
  en: {
    "intro.lede": "The Moon, Earth and Mars, drawn at the same size. The points on Earth are the places that best match the Moon and Mars reference sites: pick one to see its details and its twins. Mars sites with HiRISE relief are also compared in 3D with their Earth analogs, at the same size and scale.",
    "more.for": "For {site}, a Mars site with {w} × {w} km of HiRISE relief. Pick an analog to compare it in 3D.",
    "pick.hirise": "Mars · HiRISE relief · {cat}",
    "lg.hirise": "Tap a HiRISE patch on Mars to see its analogs and compare the terrain in 3D.",
    "detail.compare": "Compare the terrain in 3D",
    "step.pick": "Choose a Moon or Mars site",
    "pick.label": "Site compared with Earth",
    "pick.show": "Show it on the globes",
    "pick.note": "Moon and Mars reference sites (30 km windows) and Mars patches with HiRISE relief (2 km). You can also tap them on the globes.",
    "pick.refs": "{body} · reference sites (30 km)",
    "more.forRef": "For {site} ({body}), a {w} km window: its {n} Earth twins, compared with the same window and the same scale.",
    "flat.scale": "2D shaded relief · {w} × {w} km · the 3D relief for this site has not been exported yet",
    "moon.noAir": "no atmosphere",
    "group.terrainGrid": "Terrain · measured on this grid ({c} m cells; the Moon and Mars map measures at 400 m)",
    "group.climateRef": "Climate · Earth: ERA5/Meteomatics (Mars: typical values)",
    "jump": "Compare terrain in 3D",
    "intro.figMoon": "Moon reference sites",
    "intro.figMars": "Mars reference sites",
    "intro.figPatches": "Earth points compared",
  },
};
bindUiText(UI_TEXT);
const ui = (key: string, params: Record<string, string | number> = {}) =>
  UI_TEXT[getLang()][key].replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));
/**
 * Aviso de la ficha de una referencia sin puntuar (results.json: usable=false). En Marte la causa es siempre la misma
 * (solo hay MOLA de 463 m) y se explica en llano; en la Luna se añade usable_note tal cual.
 */
const UNSCORED = {
  es: { title: "No puntúa.", mars: "Aquí solo hay relieve MOLA de 463 m, demasiado grueso para compararlo a 400 m: este sitio no tiene gemelos en la Tierra." },
  en: { title: "Not scored.", mars: "Only 463 m MOLA relief is available here, too coarse to compare at 400 m, so this site has no Earth twins." },
} as const;
const earthPoints = buildEarthPoints();
function renderIntroFigures() {
  const count = (body: Body) => globeReferences.filter((r) => r.body === body).length;
  document.querySelector("#fig-moon")!.textContent = String(count("moon"));
  document.querySelector("#fig-mars")!.textContent = String(count("mars"));
  document.querySelector("#fig-patches")!.textContent = earthPoints.length.toLocaleString(locale());
}
renderIntroFigures();
onLangChange(renderIntroFigures);

// ---------------------------------------------------------------------------------------------
// Constantes

/** Textura de la Luna (public/imagery/moon.webp). Si es null, la Luna se dibuja como esfera gris lisa. */
const MOON_TEXTURE: string | null = "moon.webp";
const TEXTURES: Record<GlobeId, string | null> = { moon: MOON_TEXTURE, earth: "earth.webp", mars: "mars.webp" };
const BASE_COLOR: Record<GlobeId, number> = { moon: 0x8d8c8a, earth: 0x315b79, mars: 0xb76845 };
const HOME_DISTANCE = 3.7;
/**
 * Altura mínima de la cámara, en radios del cuerpo, según el detalle de sus mosaicos:
 * Tierra ~2,5 km (Esri World Imagery), Luna ~17 km (LRO WAC, 100 m), Marte ~4 km (CTX, ~5 m).
 */
const MIN_ALTITUDE: Record<GlobeId, number> = { earth: 0.0004, moon: 0.01, mars: 0.0012 };
/**
 * Zona que se compara: un cuadrado de 30 × 30 km centrado en el punto y con el norte arriba (WINDOW_KM en
 * pipeline/analogs/terrain.py, igual en la Tierra, la Luna y Marte). Los parches HiRISE y sus candidatos del
 * visor 3D miden 2 × 2 km (pipeline/analogs/patches.py).
 */
const WINDOW_KM = 30;
const PATCH_KM = 2;
/** Al elegir un punto, el cuadrado ocupa esta fracción del lado menor de la vista (con 30 km, unos 77 km de altura). */
const FRAME_FILL = 0.6;
/** El lado menor de la vista abarca siempre 36° (render() abre el campo vertical en paneles estrechos). */
const VIEW_TAN = Math.tan(THREE.MathUtils.degToRad(18));
const RADIUS_KM: Record<GlobeId, number> = { earth: 6371, moon: 1737.4, mars: 3389.5 };
/**
 * Brillo de la Luna: el mosaico LRO WAC (media 0,31) es mucho más oscuro que la imagen global (0,75).
 * Se suben los mosaicos y se bajan la imagen global y la capa polar para que se encuentren en ~0,49.
 */
const MOON_TILE_GAIN = 1.6;
const MOON_BASE_GAIN = 0.66;
/** CTX es gris: se tiñe con el color medio de Marte (media RGB de Viking / media de CTX). */
const MARS_CTX_TINT: [number, number, number] = [0.934, 0.74, 0.727];
/** Relieve del polo sur (pipeline/analogs/moon_pole.py): imagen azimutal equidistante hasta 90° - POLE_EDGE_DEG. */
const POLE_TEXTURE = "moon_south_pole.webp";
const POLE_EDGE_DEG = 12;   // igual que EDGE_DEG en moon_pole.py
const POLE_FADE_DEG = 2;    // fundido con la imagen global entre 78°S y 80°S
/** El relieve es gris neutro; la imagen global es algo cálida (media RGB / luminancia entre 78°S y 80°S). */
const POLE_TINT = [1.028, 0.994, 0.966] as const;
const MAX_DISTANCE = 8;
const PICK_RADIUS = 14; // px de pantalla
// Pegado a la superficie: de cerca, un punto más alto se desplaza al mirar en oblicuo (1.003 eran 19 km en la Tierra).
const MARKER_RADIUS = 1.0002;

// Los puntos van encima de las imágenes de los planetas: colores fijos, iguales en los dos temas.
const COLOR: Record<Body, string> = { moon: "#c9d1e0", mars: "#d69a70" };
// Las barras del panel de detalle siguen el tema.
const BAR_COLOR: Record<Body, string> = { moon: "var(--moon)", mars: "var(--accent)" };
const PATCH_COLOR = "#efe6da";
const HEAT_RAMP: Record<Body, [string, string]> = { moon: ["#46506a", "#eef3ff"], mars: ["#6e3a1f", "#ffc79a"] };

enum Shape { Disc = 0, Diamond = 1, Ring = 2, Star = 3, Soft = 4 }
const SIZE = { ref: 17, featured: 18, site: 10, validation: 12, catalog: 6, patch: 7, heat: 4 } as const;

// ---------------------------------------------------------------------------------------------
// Utilidades

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const pct = (v: number) => Math.round(v * 100);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

/** sRGB sin conversión: el shader escribe el color tal cual. */
function rgb(color: string): [number, number, number] {
  const n = Number.parseInt(color.replace("#", ""), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
// direction(lat, lon) viene de src/tiles.ts: la misma convención para puntos, mosaicos y capa polar.

// ---------------------------------------------------------------------------------------------
// Modelo de puntos

type Kind = "ref" | "patch" | "earth" | "heat";
type Item = {
  id: string;
  globe: GlobeId;
  kind: Kind;
  lat: number;
  lon: number;
  vec: THREE.Vector3;
  /** Nombre tal como viene en los datos (en español); null si no tiene. Se muestra con label(). */
  raw: string | null;
  named: boolean;
  shape: Shape;
  size: number;
  color: [number, number, number];
  priority: number;
  visible: boolean;
  ref?: Reference;
  patch?: Site;
  earth?: EarthPoint;
  heat?: { body: Body; score: number };
  layer?: Layer;
  index?: number;
};
type Layer = {
  points: THREE.Points;
  items: Item[];
  size: THREE.BufferAttribute;
  hl: THREE.BufferAttribute;
};

const items: Item[] = [];
const itemById = new Map<string, Item>();
const earthByKey = new Map<string, Item>();
const refItem = new Map<string, Item>();

function add(item: Omit<Item, "vec" | "visible">) {
  const full: Item = { ...item, vec: direction(item.lat, item.lon).multiplyScalar(MARKER_RADIUS), visible: true };
  items.push(full);
  itemById.set(full.id, full);
  return full;
}

for (const ref of globeReferences) {
  const item = add({
    id: `ref:${ref.id}`, globe: ref.body, kind: "ref", lat: ref.lat, lon: ref.lon, raw: ref.name, named: true,
    shape: Shape.Diamond, size: SIZE.ref, color: rgb(COLOR[ref.body]), priority: 5, ref,
  });
  refItem.set(ref.id, item);
}
for (const patch of marsPatches) {
  add({
    id: `patch:${patch.id}`, globe: "mars", kind: "patch", lat: patch.latitude, lon: patch.longitude,
    raw: patch.name, named: true, shape: Shape.Disc, size: SIZE.patch, color: rgb(PATCH_COLOR), priority: 1, patch,
  });
}
for (const point of earthPoints) {
  const has = (kind: EarthRole["kind"]) => point.roles.some((r) => r.kind === kind);
  const [shape, size, priority] = has("featured") ? [Shape.Star, SIZE.featured, 4]
    : point.best ? [Shape.Disc, SIZE.site, 3]
    : has("validation") ? [Shape.Ring, SIZE.validation, 2]
    : [Shape.Disc, SIZE.catalog, 1];
  const item = add({
    id: `earth:${point.key}`, globe: "earth", kind: "earth", lat: point.lat, lon: point.lon,
    raw: point.name, named: point.name !== null,
    shape, size, color: rgb(COLOR[point.color]), priority, earth: point,
  });
  earthByKey.set(point.key, item);
}
const heatItems: Record<Body, Item[]> = { moon: [], mars: [] };
for (const body of BODIES) {
  const heat = DATA.bodies[body].heat;
  const scores = heat.map(([, , s]) => s);
  const [lo, hi] = [Math.min(...scores), Math.max(...scores)];
  const [low, high] = HEAT_RAMP[body].map(rgb);
  heat.forEach(([lat, lon, score], index) => {
    const t = hi > lo ? (score - lo) / (hi - lo) : 1;
    heatItems[body].push(add({
      id: `heat:${body}:${index}`, globe: "earth", kind: "heat", lat, lon, raw: null, named: false,
      shape: Shape.Soft, size: SIZE.heat, priority: 0,
      color: [0, 1, 2].map((i) => low[i] + (high[i] - low[i]) * t) as Item["color"],
      heat: { body, score },
    }));
  });
}
/** Nombre visible en el idioma actual; si el punto no tiene nombre, «Ventana de 30 km · lat, lon». */
const label = (item: Item) => (item.raw ? tr(item.raw) : windowName(item.lat, item.lon));
const earthKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

// ---------------------------------------------------------------------------------------------
// Estado

type Mode = "best" | "all";
type TwinRole = Extract<EarthRole, { kind: "twin" }>;
let mode: Mode = "best";
let refFilter: string | null = null;
let selected: Item | null = null;
let selectedEarthTwin: TwinRole | undefined;
let highlighted = new Set<Item>();

function twinRoleOf(point: EarthPoint, ref: Reference) {
  if (ref.usable === false) return undefined;
  const key = twinKeyOf(ref);
  return point.roles.find((role): role is TwinRole => role.kind === "twin" && role.body === ref.body && role.ref === key);
}

function isVisible(item: Item) {
  switch (item.kind) {
    case "ref": return highlighted.has(item) || (refFilter ? item.ref!.id === refFilter : mode === "all" || isHeadlineRef(item.ref!));
    // Los parches HiRISE (lo que antes era el visor 3D de Marte) se ven en los dos modos: tocarlos abre la comparación.
    case "patch": return highlighted.has(item) || !refFilter;
    case "heat": return mode === "all" && !refFilter;
    case "earth": {
      const point = item.earth!;
      if (highlighted.has(item)) return true;
      if (refFilter) {
        const ref = refById.get(refFilter)!;
        // Los gemelos de la referencia siguen visibles aunque no lleguen al puntaje de «Mejores».
        if (twinRoleOf(point, ref)) return true;
        return (mode === "all" || point.best) && point.data[ref.body]?.best_ref === refFilter;
      }
      return mode === "all" || point.best;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Escena

const canvas = $<HTMLCanvasElement>("#gl-canvas");
const stage = $<HTMLElement>("#gl-stage");
const tip = $<HTMLElement>("#gl-tip");
const errorBox = $<HTMLElement>("#gl-error");

const pixelRatio = Math.min(devicePixelRatio, 2);
let renderer: THREE.WebGLRenderer | null = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(pixelRatio);
} catch {
  errorBox.hidden = false;
}

const pointUniforms = { pr: { value: pixelRatio } };

const vertexShader = /* glsl */ `
  attribute float size;
  attribute float shape;
  attribute float hl;
  attribute vec3 tint;
  uniform float pr;
  varying vec3 vColor;
  varying float vShape;
  varying float vHl;
  varying float vPx;
  void main() {
    vColor = tint; vShape = shape; vHl = hl;
    // Cara oculta: el punto mira hacia fuera de la cámara (mismo criterio que el picking en JS).
    bool facing = dot(position, cameraPosition - position) > 0.0;
    if (!facing || size <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
    vPx = (size + hl * 6.0) * pr;
    gl_PointSize = vPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  uniform float pr;
  varying vec3 vColor;
  varying float vShape;
  varying float vHl;
  varying float vPx;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r;
    if (vShape > 0.5 && vShape < 1.5) r = abs(c.x) + abs(c.y);
    else if (vShape > 2.5 && vShape < 3.5) { float s = sqrt(abs(c.x)) + sqrt(abs(c.y)); r = s * s; }
    else r = length(c);
    if (r > 0.5) discard;
    float edge = (0.5 - r) * vPx;           // distancia al borde en píxeles del dispositivo
    vec3 dark = vec3(0.067, 0.067, 0.078);
    if (vShape > 3.5) { gl_FragColor = vec4(vColor, 0.9); return; }  // celda de calor
    float outline = 1.4 * pr;
    if (vHl > 0.5) {
      if (edge < 2.2 * pr) { gl_FragColor = vec4(1.0); return; }
      if (edge < 3.4 * pr) { gl_FragColor = vec4(dark, 1.0); return; }
    } else if (edge < outline) { gl_FragColor = vec4(dark, 1.0); return; }
    if (vShape > 1.5 && vShape < 2.5) {     // anillo: hueco por dentro
      float inner = edge - (vHl > 0.5 ? 3.4 : 1.4) * pr;
      if (inner > 2.6 * pr + 0.5) { if (inner < 3.8 * pr + 0.5) { gl_FragColor = vec4(dark, 1.0); return; } discard; }
    }
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

function makeLayer(list: Item[]): Layer {
  list.sort((a, b) => a.priority - b.priority);
  const n = list.length;
  const position = new Float32Array(n * 3);
  const tint = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const shape = new Float32Array(n);
  const hl = new Float32Array(n);
  list.forEach((item, i) => {
    position.set([item.vec.x, item.vec.y, item.vec.z], i * 3);
    tint.set(item.color, i * 3);
    size[i] = item.size;
    shape[i] = item.shape;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("tint", new THREE.BufferAttribute(tint, 3));
  const sizeAttr = new THREE.BufferAttribute(size, 1);
  const hlAttr = new THREE.BufferAttribute(hl, 1);
  geometry.setAttribute("size", sizeAttr);
  geometry.setAttribute("shape", new THREE.BufferAttribute(shape, 1));
  geometry.setAttribute("hl", hlAttr);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.1);
  const material = new THREE.ShaderMaterial({
    uniforms: pointUniforms, vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const layer: Layer = { points, items: list, size: sizeAttr, hl: hlAttr };
  list.forEach((item, i) => { item.layer = layer; item.index = i; });
  return layer;
}

type Globe = {
  id: GlobeId;
  panel: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  light: THREE.DirectionalLight;
  controls: OrbitControls;
  layers: Layer[];
  items: Item[];
  home: THREE.Vector3;
  animation: number;
  rect: { x: number; y: number; w: number; h: number };
  tiles: TileLayer;
};

// ---------------------------------------------------------------------------------------------
// Mosaicos de alta resolución (src/tiles.ts). Todos permiten CORS; sin conexión se ve la imagen global.

const TREK = "https://trek.nasa.gov/tiles";
const TILE_SOURCES: Record<GlobeId, Omit<TileLayerOptions, "onLoad">> = {
  earth: {
    scheme: "mercator",
    sources: [{
      minLevel: 0, maxLevel: 18, tileSize: 256,
      url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    }],
  },
  moon: {
    scheme: "geographic",
    sources: [{
      minLevel: 0, maxLevel: 8, tileSize: 256, tint: [MOON_TILE_GAIN, MOON_TILE_GAIN, MOON_TILE_GAIN],
      url: (z, x, y) => `${TREK}/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`,
    }],
  },
  mars: {
    scheme: "geographic",
    sources: [
      {
        // Viking en color hasta ~650 m por píxel…
        minLevel: 0, maxLevel: 5, tileSize: 256,
        url: (z, x, y) => `${TREK}/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/${z}/${y}/${x}.jpg`,
      },
      {
        // …y de cerca CTX (~5 m), con huecos transparentes donde no hay órbitas: ahí se ve Viking.
        minLevel: 6, maxLevel: 12, tileSize: 512, tint: MARS_CTX_TINT, transparent: true,
        url: (z, x, y) => `https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/${z}/${y}/${x}`,
      },
    ],
  },
};

const lightOffset = new THREE.Vector3(-2, 2, 1);
const globes = {} as Record<GlobeId, Globe>;

/**
 * Casquete del polo sur lunar con el relieve LOLA, algo por encima de la esfera.
 * Cada vértice se coloca con direction(lat, lon) y su UV sale de la misma geometría que moon_pole.py:
 * rho = 90 + lat (grados al polo), x = rho·sin(lon), y = rho·cos(lon).
 * El alfa por vértice funde el borde con la imagen global.
 */
function southPoleCap(onLoad: () => void) {
  const rings = 48;
  const segments = 192;
  const position: number[] = [];
  const uv: number[] = [];
  const color: number[] = [];
  const index: number[] = [];
  // Tinte y brillo medidos en valores sRGB; los colores de vértice van en espacio lineal.
  const tint = new THREE.Color().setRGB(...(POLE_TINT.map((c) => c * MOON_BASE_GAIN) as [number, number, number]), THREE.SRGBColorSpace);
  for (let i = 0; i <= rings; i++) {
    const rho = (POLE_EDGE_DEG * i) / rings;
    const alpha = THREE.MathUtils.clamp((POLE_EDGE_DEG - rho) / POLE_FADE_DEG, 0, 1);
    for (let j = 0; j <= segments; j++) {
      const lon = -180 + (360 * j) / segments;
      const v = direction(-90 + rho, lon).multiplyScalar(1.0008);
      position.push(v.x, v.y, v.z);
      const lo = THREE.MathUtils.degToRad(lon);
      uv.push(0.5 + (rho * Math.sin(lo)) / (2 * POLE_EDGE_DEG), 0.5 + (rho * Math.cos(lo)) / (2 * POLE_EDGE_DEG));
      color.push(tint.r, tint.g, tint.b, alpha);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * (segments + 1) + j;
      const b = a + segments + 1;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 4));
  geometry.setIndex(index);
  // Normales radiales, como la esfera de debajo (no dependen del orden de los triángulos).
  const normal = position.map((p) => p / 1.0008);
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  const material = new THREE.MeshStandardMaterial({
    roughness: 1, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.visible = false;                // hasta que llegue la imagen
  loadGlobeTexture(`${import.meta.env.BASE_URL}imagery/${POLE_TEXTURE}`, (map) => {
    map.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    material.map = map;
    material.needsUpdate = true;
    mesh.visible = true;
    onLoad();
  });
  return mesh;
}

function homeDirection(id: GlobeId) {
  if (id === "moon") return direction(-89, 0);                          // polo sur lunar
  if (id === "mars") {
    const site = refById.get("jezero") ?? globeReferences.find((ref) => ref.body === "mars");
    return site ? direction(site.lat, site.lon) : direction(0, 0);
  }
  const top = topSite();
  return top ? direction(top.lat, top.lon) : direction(0, 0);
}

for (const id of ["moon", "earth", "mars"] as GlobeId[]) {
  const panel = stage.querySelector<HTMLElement>(`.gl-panel[data-globe="${id}"]`)!;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20);
  const material = new THREE.MeshStandardMaterial({ color: BASE_COLOR[id], roughness: 1 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), material);
  sphere.renderOrder = -1000;          // debajo de los mosaicos (que se dibujan sin prueba de profundidad)
  scene.add(sphere);
  const light = new THREE.DirectionalLight(0xfff3e7, 1.35);
  scene.add(light, new THREE.AmbientLight(0xffffff, 1.05));
  const texture = TEXTURES[id];
  if (texture && renderer) {
    loadGlobeTexture(`${import.meta.env.BASE_URL}imagery/${texture}`, (map) => {
      map.anisotropy = Math.min(8, renderer!.capabilities.getMaxAnisotropy());
      const gain = id === "moon" ? MOON_BASE_GAIN : 1;   // en valores sRGB, como se midió
      material.color.setRGB(gain, gain, gain, THREE.SRGBColorSpace);
      material.map = map;
      material.needsUpdate = true;
      requestRender();
    });
  }
  const tiles = new TileLayer({ ...TILE_SOURCES[id], onLoad: () => requestRender() });
  if (renderer) tiles.setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  scene.add(tiles.group);
  if (id === "moon" && renderer) scene.add(southPoleCap(() => requestRender()));
  const own = items.filter((item) => item.globe === id);
  const layers: Layer[] = [];
  if (id === "earth") {
    for (const body of BODIES) layers.push(makeLayer(heatItems[body]));
    layers.push(makeLayer(own.filter((i) => i.kind !== "heat")));
  } else {
    layers.push(makeLayer(own));
  }
  layers.forEach((layer, order) => { layer.points.renderOrder = order + 1; scene.add(layer.points); });

  const home = homeDirection(id).multiplyScalar(HOME_DISTANCE);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, panel);
  controls.enablePan = false;
  // El zoom de OrbitControls avanza en proporción a la distancia al centro: cerca del suelo se pasaría de largo.
  // Lo sustituye zoomBy (más abajo), que avanza en proporción a la altura.
  controls.enableZoom = false;
  controls.minDistance = 1 + MIN_ALTITUDE[id];
  controls.maxDistance = MAX_DISTANCE;
  controls.rotateSpeed = 0.55;
  controls.update();
  controls.addEventListener("change", () => {
    // El giro es proporcional a la altura: arrastrar el panel entero mueve más o menos lo que se ve.
    const altitude = camera.position.length() - 1;
    controls.rotateSpeed = 0.55 * THREE.MathUtils.clamp(altitude / (HOME_DISTANCE - 1), 1e-5, 1.6);
    hideTip();
    requestRender();
  });
  globes[id] = { id, panel, scene, camera, light, controls, layers, items: own, home, animation: 0, rect: { x: 0, y: 0, w: 0, h: 0 }, tiles };
}

// ---------------------------------------------------------------------------------------------
// Zoom por altura: rueda y pellizco

function zoomBy(globe: Globe, factor: number) {
  cancelAnimationFrame(globe.animation);
  const { camera, controls } = globe;
  const altitude = THREE.MathUtils.clamp((camera.position.length() - 1) * factor, MIN_ALTITUDE[globe.id], MAX_DISTANCE - 1);
  camera.position.setLength(1 + altitude);
  controls.update();
  requestRender();
}

for (const globe of Object.values(globes)) {
  const { panel } = globe;
  panel.addEventListener("wheel", (event) => {
    event.preventDefault();
    const step = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
    zoomBy(globe, Math.exp(THREE.MathUtils.clamp(step, -200, 200) * 0.0016));
  }, { passive: false });
  const touches = new Map<number, { x: number; y: number }>();
  let spread = 0;
  const gap = () => { const [a, b] = [...touches.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  panel.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) spread = gap();
  });
  panel.addEventListener("pointermove", (event) => {
    if (!touches.has(event.pointerId)) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size !== 2) return;
    const next = gap();
    if (spread > 0 && next > 0) zoomBy(globe, spread / next);
    spread = next;
  });
  const lift = (event: PointerEvent) => { touches.delete(event.pointerId); spread = touches.size === 2 ? gap() : 0; };
  panel.addEventListener("pointerup", lift);
  panel.addEventListener("pointercancel", lift);
}

// ---------------------------------------------------------------------------------------------
// Dibujo bajo demanda

let frame = 0;
let contextLost = false;
function requestRender() {
  if (!frame && renderer && !contextLost) frame = requestAnimationFrame(render);
}

const size = new THREE.Vector2();
function render() {
  frame = 0;
  if (!renderer || contextLost) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return;
  renderer.getSize(size);
  if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
  const box = canvas.getBoundingClientRect();
  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);
  for (const globe of Object.values(globes)) {
    const r = globe.panel.getBoundingClientRect();
    const rect = { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
    globe.rect = rect;
    if (rect.w < 2 || rect.h < 2) continue;
    const { camera } = globe;
    camera.aspect = rect.w / rect.h;
    // En paneles estrechos se abre el campo de visión para que el globo quepa entero.
    camera.fov = camera.aspect < 1
      ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) / camera.aspect))
      : 36;
    // Plano cercano según la altura: de cerca la superficie queda a pocos km de la cámara.
    const distance = camera.position.length();
    camera.near = Math.max((distance - 1) * 0.2, 1e-6);
    camera.far = distance + 1.5;
    camera.updateProjectionMatrix();
    // La luz acompaña a la cámara con el mismo ángulo a cualquier altura (si no, de cerca el suelo queda en sombra).
    globe.light.position.copy(camera.position).setLength(HOME_DISTANCE).add(lightOffset);
    globe.tiles.update(camera, rect.h * pixelRatio);
    // Cuadrado de la zona comparada: grosor en píxeles del panel; oculto si queda en la cara de atrás.
    const frame = frameLines[globe.id];
    if (frame.group.visible) {
      for (const line of frame.group.children as Line2[]) (line.material as LineMaterial).resolution.set(rect.w, rect.h);
      frame.group.children.forEach((line) => { line.visible = frame.center.dot(camera.position.clone().sub(frame.center)) > 0; });
    }
    const y = height - rect.y - rect.h;
    renderer.setViewport(rect.x, y, rect.w, rect.h);
    renderer.setScissor(rect.x, y, rect.w, rect.h);
    renderer.render(globe.scene, camera);
  }
}

// ---------------------------------------------------------------------------------------------
// Visibilidad, resaltado y recuento

function refreshPoints() {
  let count = 0;
  for (const item of items) {
    item.visible = isVisible(item);
    if (item.visible) count++;
    const { layer, index } = item;
    if (!layer || index === undefined || item.kind === "heat") continue;
    layer.size.setX(index, item.visible ? item.size : 0);
    layer.hl.setX(index, highlighted.has(item) ? 1 : 0);
  }
  for (const globe of Object.values(globes)) {
    for (const layer of globe.layers) {
      if (layer.items[0]?.kind === "heat") {
        layer.points.visible = layer.items[0].visible;
      } else {
        layer.size.needsUpdate = true;
        layer.hl.needsUpdate = true;
      }
    }
  }
  $("#gl-count").textContent = t("gl.count", { n: count.toLocaleString(locale()) });
  fillGoto();
  requestRender();
}

// ---------------------------------------------------------------------------------------------
// Cámara

function flyTo(globe: Globe, target: THREE.Vector3, distance?: number) {
  cancelAnimationFrame(globe.animation);
  const { camera, controls } = globe;
  const from = camera.position.clone().normalize();
  const to = target.clone().normalize();
  const fromDistance = camera.position.length();
  const toDistance = distance ?? fromDistance;
  const rotation = new THREE.Quaternion().setFromUnitVectors(from, to);
  const step = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  // Salto largo cerca del suelo: el vuelo sube a media ruta y vuelve a bajar, para no perder el contexto.
  const angle = from.angleTo(to);
  const peak = 1 + Math.min(angle, Math.PI) * 0.7;
  const lift = Math.max(0, peak - (fromDistance + toDistance) / 2);
  const duration = reducedMotion.matches ? 0 : 800 + 700 * Math.min(angle / Math.PI, 1);
  const start = performance.now();
  const apply = (t: number) => {
    const e = t * t * (3 - 2 * t);
    step.identity().slerp(rotation, e);
    dir.copy(from).applyQuaternion(step);
    const distance = THREE.MathUtils.lerp(fromDistance, toDistance, e) + lift * Math.sin(Math.PI * e);
    camera.position.copy(dir).multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    controls.update();
    requestRender();
  };
  if (duration === 0) { apply(1); return; }
  const tick = (now: number) => {
    const t = Math.min((now - start) / duration, 1);
    apply(t);
    if (t < 1) globe.animation = requestAnimationFrame(tick);
  };
  globe.animation = requestAnimationFrame(tick);
}

for (const globe of Object.values(globes)) {
  const reset = globe.panel.querySelector<HTMLButtonElement>(".gl-reset")!;
  // Sin esto, OrbitControls captura el puntero en el panel y el clic nunca llega al botón.
  reset.addEventListener("pointerdown", (event) => event.stopPropagation());
  reset.addEventListener("click", () => flyTo(globe, globe.home, HOME_DISTANCE));
  // Cualquier gesto del usuario cancela un vuelo en curso.
  globe.controls.addEventListener("start", () => cancelAnimationFrame(globe.animation));
}

// ---------------------------------------------------------------------------------------------
// Picking: el punto visible más cercano en pantalla a menos de 14 px de su borde

const projected = new THREE.Vector3();
function pick(globe: Globe, x: number, y: number): Item | null {
  const { camera } = globe;
  const { w, h } = globe.rect;
  let best: Item | null = null;
  let bestScore = Infinity;
  for (const item of globe.items) {
    if (!item.visible) continue;
    // Cara oculta: ni se ve ni se puede tocar.
    if (item.vec.dot(projected.copy(camera.position).sub(item.vec)) <= 0) continue;
    projected.copy(item.vec).project(camera);
    const sx = (projected.x + 1) / 2 * w;
    const sy = (1 - projected.y) / 2 * h;
    const radius = (item.size + (highlighted.has(item) ? 6 : 0)) / 2;
    const d = Math.hypot(sx - x, sy - y);
    if (d > PICK_RADIUS + radius) continue;
    // Distancia al borde del punto; a igualdad, gana el punto más importante (las celdas de calor, las últimas).
    const score = Math.max(0, d - radius) * 10 - item.priority + d * 0.01;
    if (score < bestScore) { bestScore = score; best = item; }
  }
  return best;
}

function localPoint(globe: Globe, event: PointerEvent) {
  const r = globe.panel.getBoundingClientRect();
  return { x: event.clientX - r.left, y: event.clientY - r.top };
}

function hideTip() { tip.hidden = true; }

for (const globe of Object.values(globes)) {
  const { panel } = globe;
  const pointers = new Map<number, { x: number; y: number; t: number }>();
  let multi = false;
  panel.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, t: performance.now() });
    if (pointers.size > 1) multi = true;
  });
  const end = (event: PointerEvent) => {
    const start = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    const wasMulti = multi;
    if (pointers.size === 0) multi = false;
    if (!start || wasMulti || event.type !== "pointerup") return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (moved > 6 || performance.now() - start.t > 700) return;
    const { x, y } = localPoint(globe, event);
    const item = pick(globe, x, y);
    if (item) select(item);
  };
  panel.addEventListener("pointerup", end);
  panel.addEventListener("pointercancel", end);
  panel.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || event.buttons) return;
    if ((event.target as HTMLElement).closest("button")) { hideTip(); return; }
    const { x, y } = localPoint(globe, event);
    const item = pick(globe, x, y);
    panel.classList.toggle("is-over-point", !!item);
    if (!item) { hideTip(); return; }
    tip.textContent = label(item);
    tip.hidden = false;
    const s = stage.getBoundingClientRect();
    const left = event.clientX - s.left + 14;
    tip.style.left = `${Math.min(left, s.width - tip.offsetWidth - 6)}px`;
    tip.style.top = `${event.clientY - s.top + 14}px`;
  });
  panel.addEventListener("pointerleave", () => { hideTip(); panel.classList.remove("is-over-point"); });
}

// ---------------------------------------------------------------------------------------------
// Selección y enlace entre globos

function bestBody(point: EarthPoint): Body | null {
  const scored = BODIES.filter((b) => point.data[b]);
  if (!scored.length) return null;
  return scored.reduce((a, b) => (point.data[b]!.score > point.data[a]!.score ? b : a));
}

function twinItemsOf(ref: Reference) {
  return twinsOf(ref)
    .map((t) => earthByKey.get(earthKey(t.lat, t.lon)))
    .filter((i): i is Item => !!i);
}

/** Lado en km de la zona que se comparó para este punto. */
function windowKm(item: Item) {
  if (item.kind === "patch") return PATCH_KM;
  if (item.ref?.window_km) return item.ref.window_km;
  if (item.kind === "earth") {
    const point = item.earth!;
    const ranked = BODIES.some((b) => point.data[b]);
    if (!ranked && point.roles.some((r) => r.kind === "catalog")) return PATCH_KM;
  }
  return WINDOW_KM;
}

// ---------------------------------------------------------------------------------------------
// Cuadrado de la zona comparada: una línea amarilla de grosor fijo en pantalla (se ve sobre gris, arena, nieve y rojo).

const frameLines = (["moon", "earth", "mars"] as GlobeId[]).reduce((acc, id) => {
  const make = (color: number, width: number, order: number) => {
    const material = new LineMaterial({ color, linewidth: width, transparent: true, depthTest: false, depthWrite: false });
    const line = new Line2(new LineGeometry(), material);
    line.renderOrder = order;          // encima de mosaicos y capa polar, debajo de los puntos (1, 2, 3)
    line.frustumCulled = false;
    return line;
  };
  const group = new THREE.Group();
  group.visible = false;
  group.add(make(0xffd23f, 2.5, 0.5));
  globes[id].scene.add(group);
  acc[id] = { group, center: new THREE.Vector3() };
  return acc;
}, {} as Record<GlobeId, { group: THREE.Group; center: THREE.Vector3 }>);

/** Cuadrado de `km` de lado centrado en el punto, con el norte arriba, en el plano tangente (a 15 km la curvatura no se nota). */
function showFrame(item: Item, km: number) {
  const la = THREE.MathUtils.degToRad(item.lat);
  const lo = THREE.MathUtils.degToRad(item.lon);
  const center = direction(item.lat, item.lon);
  const east = new THREE.Vector3(-Math.sin(lo), 0, -Math.cos(lo));
  const north = new THREE.Vector3(-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo));
  const h = km / 2 / RADIUS_KM[item.globe];
  const corners: [number, number][] = [[-1, 1], [1, 1], [1, -1], [-1, -1], [-1, 1]];
  const positions: number[] = [];
  const p = new THREE.Vector3();
  for (let c = 0; c < 4; c++) {
    const [x0, y0] = corners[c];
    const [x1, y1] = corners[c + 1];
    for (let s = 0; s < 16; s++) {
      const t = s / 16;
      p.copy(center).addScaledVector(east, h * (x0 + (x1 - x0) * t)).addScaledVector(north, h * (y0 + (y1 - y0) * t));
      p.setLength(1.0001);
      positions.push(p.x, p.y, p.z);
    }
  }
  positions.push(positions[0], positions[1], positions[2]);
  const frame = frameLines[item.globe];
  for (const line of frame.group.children as Line2[]) {
    line.geometry.dispose();
    line.geometry = new LineGeometry().setPositions(positions);
  }
  frame.center.copy(center);
  frame.group.visible = true;
}

function hideFrames() {
  for (const frame of Object.values(frameLines)) frame.group.visible = false;
}

/**
 * Los dos globos de la pareja vuelan a la MISMA altura en km, para que los terrenos se vean a la misma escala,
 * la que hace que el cuadrado comparado ocupe FRAME_FILL de la vista, y nunca por debajo del mínimo de ninguno
 * de los dos (la Luna no baja de ~17 km: su mosaico tiene 100 m por píxel).
 */
function focusPair(item: Item, partner?: Item, fixedKm?: number) {
  const pair = partner ? [item, partner] : [item];
  const sideOf = (i: Item) => fixedKm ?? windowKm(i);
  const side = Math.max(...pair.map(sideOf));
  const floor = Math.max(...pair.map((i) => MIN_ALTITUDE[i.globe] * RADIUS_KM[i.globe]));
  const km = Math.max(side / (FRAME_FILL * 2 * VIEW_TAN), floor);
  hideFrames();
  for (const i of pair) {
    flyTo(globes[i.globe], i.vec, 1 + km / RADIUS_KM[i.globe]);
    showFrame(i, sideOf(i));
  }
}

/**
 * Al elegir un punto (tocándolo, en «Ir a un punto», en el filtro o en el panel) se acercan los dos globos de la
 * pareja a la vez: el punto de la Tierra y su sitio más parecido de la Luna o Marte, o el sitio y su gemelo n.º 1.
 * Un parche HiRISE de Marte se empareja con su mejor análogo de la Tierra (mismo cálculo que el antiguo visor 3D)
 * y abre debajo la comparación de terreno. Las celdas de calor no tienen pareja: solo se acerca su globo.
 */
function select(item: Item, reference = refFilter ? refById.get(refFilter) : undefined) {
  if (item.kind === "patch") refFilter = null;
  selected = item;
  selectedEarthTwin = item.earth && reference ? twinRoleOf(item.earth, reference) : undefined;
  highlighted = new Set([item]);
  let partner: Item | undefined;
  if (item.kind === "ref") {
    const twins = twinItemsOf(item.ref!);
    twins.forEach((t) => highlighted.add(t));
    partner = twins[0];
    if (comparableRef(item.ref!)) setComparison(item);
  } else if (item.kind === "earth") {
    const body = selectedEarthTwin?.body ?? bestBody(item.earth!);
    const site = selectedEarthTwin?.site ?? (body ? item.earth!.data[body] : undefined);
    partner = site ? refItem.get(site.best_ref) : undefined;
    if (partner) highlighted.add(partner);
  } else if (item.kind === "patch") {
    setComparison(item);
    for (const analog of compare.analogs) {
      const earth = earthItemAt(analog.lat, analog.lon);
      if (earth) highlighted.add(earth);
    }
    partner = compare.analog && earthItemAt(compare.analog.lat, compare.analog.lon);
  }
  focusPair(item, partner, item.kind === "patch" ? PATCH_KM : undefined);
  refreshPoints();
  renderDetail(item);
  refSelect.value = item.kind === "patch" ? item.id : (refFilter ?? "");
  detail.scrollTop = 0;
  const goto = $<HTMLSelectElement>("#gl-goto");
  goto.value = item.kind === "heat" ? "" : item.id;
}

function clearSelection() {
  selected = null;
  selectedEarthTwin = undefined;
  highlighted = new Set();
  hideFrames();
  detail.hidden = true;
  detail.innerHTML = "";
  $<HTMLSelectElement>("#gl-goto").value = "";
  refSelect.value = refFilter ?? "";
  refreshPoints();
}

// ---------------------------------------------------------------------------------------------
// Panel de detalle

const detail = $<HTMLElement>("#gl-detail");

function bar(label: string, v: number | undefined, color: string, note = "") {
  if (!finite(v)) return "";
  return `<div class="gl-bar"><span>${label}${note}</span><i style="--v:${Math.max(0, Math.min(1, v))};--c:${color}"></i><b>${pct(v)}</b></div>`;
}
function row(label: string, value: string | null) {
  return value === null ? "" : `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}
const num = (v: unknown, unit: string, d = 1) => (finite(v) ? `${fmt(v, d)}${unit}` : null);
const refName = (id: string) => esc(id === "malla_polar" ? t("lm.grp.malla_polar") : tr(refById.get(id)?.name ?? id));
const tagLabel = (tag: string) => (tag === "nuevo" ? t("lm.pill.new") : tag === "validación" ? t("lm.pill.val") : tr(tag));

function roleLabel(role: EarthRole) {
  switch (role.kind) {
    case "site": return t(`gl.role.site.${role.body}`, { rank: role.rank });
    case "twin": return t("gl.role.twin", { rank: role.rank, ref: refName(role.ref) });
    case "featured": return t("gl.role.featured", { tag: esc(tagLabel(role.tag)) });
    case "validation": return t(`gl.role.validation.${role.body}`, { p: fmt(role.percentile, 0) });
    case "catalog": return t(role.origin === "curated" ? "gl.role.curated" : "gl.role.global");
  }
}

function climateRows(climate: { t_mean?: number; t_min?: number; t_max?: number; diurnal_range?: number; precip_year?: number } | null | undefined) {
  if (!climate) return "";
  const rows = [
    row(t("gl.tMean"), num(climate.t_mean, " °C")),
    row(t("gl.tMin"), num(climate.t_min, " °C")),
    row(t("gl.tMax"), num(climate.t_max, " °C")),
    row(t("gl.diurnal"), num(climate.diurnal_range, " °C")),
    row(t("gl.precip"), num(climate.precip_year, " mm", 0)),
  ].join("");
  return rows ? `<h3>${t("gl.climateTitle")}</h3><dl class="gl-dl">${rows}</dl>` : "";
}

function header(kicker: string, name: string, lat: number, lon: number) {
  return `<div class="gl-detail-head">
    <p class="gl-kicker">${esc(kicker)}</p>
    <button type="button" class="gl-close" aria-label="${esc(t("gl.close"))}">×</button>
  </div>
  <h2>${esc(name)}</h2>
  <p class="gl-coords">${coord(lat, lon)}</p>`;
}

function renderDetail(item: Item) {
  let html = "";
  if (item.kind === "ref") {
    const ref = item.ref!;
    const twins = twinsOf(ref);
    html = header(t("gl.refKicker", { body: bodyName(ref.body) }), label(item), ref.lat, ref.lon);
    html += `<ul class="gl-roles"><li>${t(`gl.refRole.${ref.body}`)}</li></ul>`;
    // Referencia que no puntúa: se explica por qué no tiene gemelos (la Tierra no se mueve).
    if (ref.usable === false) {
      const text = UNSCORED[getLang()];
      const why = ref.body === "mars" ? text.mars : ref.usable_note ? tr(ref.usable_note) : "";
      html += `<p class="gl-unscored"><b>${esc(text.title)}</b>${why ? ` ${esc(why)}` : ""}</p>`;
    }
    if (ref.note) html += `<p class="gl-note">${esc(tr(ref.note))}</p>`;
    if (ref.source_url?.startsWith("https://")) {
      html += `<p class="gl-sub"><a href="${esc(ref.source_url)}" target="_blank" rel="noopener">${esc(t("gl.source"))}</a></p>`;
    }
    if (comparableRef(ref)) {
      html += `<p class="gl-sub"><a href="#comparison">${esc(ui("detail.compare"))} <span aria-hidden="true">↓</span></a></p>`;
    }
    if (twins.length) {
      html += `<h3>${t("gl.twinsTitle")}</h3><ol class="gl-twins">${twins.map((site) => {
        const twin = earthByKey.get(earthKey(site.lat, site.lon));
        if (!twin) return "";
        return `<li><button type="button" data-item="${esc(twin.id)}"><span>${esc(label(twin))}${twin.named ? `<small>${coord(site.lat, site.lon)}</small>` : ""}</span>${finite(site.score) ? `<b>${pct(site.score)}</b>` : ""}</button></li>`;
      }).join("")}</ol>`;
    }
  } else if (item.kind === "earth") {
    const point = item.earth!;
    html = header(bodyName("earth"), label(item), point.lat, point.lon);
    html += `<ul class="gl-roles">${point.roles.map((r) => `<li>${roleLabel(r)}</li>`).join("")}</ul>`;
    const data = selectedEarthTwin ? { ...point.data, [selectedEarthTwin.body]: selectedEarthTwin.site } : point.data;
    const bodies = BODIES.filter((body) => data[body]).sort((a, b) => data[b]!.score - data[a]!.score);
    for (const body of bodies) {
      const site = data[body]!;
      const ref = refById.get(site.best_ref);
      const color = BAR_COLOR[body];
      html += `<h3>${t(`gl.analogOf.${body}`)}</h3>`;
      if (ref) html += `<p class="gl-sub">${t("gl.closestTo")} <button type="button" class="gl-link" data-item="ref:${esc(ref.id)}">${refName(ref.id)}</button></p>`;
      html += `<div class="gl-bars">${[
        bar(t("gl.total"), site.score, color),
        bar(t("gl.terrain"), site.scores?.terrain, color),
        bar(t("gl.surface"), site.scores?.surface, color, site.surface_assumed ? t("gl.assumed") : ""),
        bar(t("gl.climate"), site.scores?.climate, color),
      ].join("")}</div>`;
    }
    const catalog = point.roles.find((r) => r.kind === "catalog");
    const climate = bodies.length ? data[bodies[0]]!.climate : catalog?.site.climate;
    html += climateRows(climate);
    for (const role of point.roles) if (role.kind === "featured") html += `<p class="gl-note">${esc(tr(role.story))}</p>`;
  } else if (item.kind === "patch") {
    const patch = item.patch!;
    html = header(t("gl.patchKicker"), label(item), patch.latitude, patch.longitude);
    html += `<ul class="gl-roles"><li>${esc(categoryLabel(patch.category))}</li></ul>`;
    const m = patch.metrics;
    const rows = [
      row(t("gl.medianSlope"), num(m?.medianSlope, "°")),
      row(t("gl.steepSlope"), num(m?.steepSlope, "°")),
      row(t("gl.relief"), num(m?.relief, " m", 0)),
      row(t("gl.medianElev"), num(m?.medianElevation, " m", 0)),
    ].join("");
    if (rows) html += `<h3>${t("gl.terrainTitle")}</h3><dl class="gl-dl">${rows}</dl>`;
    if (compare.subject?.item === item && compare.analogs.length) {
      html += `<h3>${t("v.matchesTitle")}</h3><ol class="gl-twins gl-analogs">${compare.analogs.map((analog, index) =>
        `<li><button type="button" data-match="${index}" aria-pressed="${analog === compare.analog}"><span>${esc(analogName(analog))}<small>${esc(analogOrigin(analog))}</small></span><b>${pct(analog.total)}</b></button></li>`,
      ).join("")}</ol>`;
      html += `<p class="gl-sub"><a href="#comparison">${esc(ui("detail.compare"))} <span aria-hidden="true">↓</span></a></p>`;
    }
    if (patch.sourceUrl) html += `<p class="gl-sub"><a href="${esc(patch.sourceUrl)}" target="_blank" rel="noopener">${esc(patch.source || t("gl.source"))}</a></p>`;
  } else {
    const heat = item.heat!;
    html = header(t(`gl.heatKicker.${heat.body}`), label(item), item.lat, item.lon);
    html += `<div class="gl-bars">${bar(t("gl.total"), heat.score, BAR_COLOR[heat.body])}</div>`;
    html += `<p class="gl-sub">${t("gl.heatNote")}</p>`;
  }
  detail.innerHTML = html;
  detail.hidden = false;
}

detail.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".gl-close")) { clearSelection(); return; }
  const matchButton = target.closest<HTMLElement>("[data-match]");
  if (matchButton) {
    const analog = compare.analogs[Number(matchButton.dataset.match)];
    if (analog) void selectAnalog(analog);
    return;
  }
  const button = target.closest<HTMLElement>("[data-item]");
  const item = button && itemById.get(button.dataset.item!);
  if (item) { select(item, selected?.ref); detail.scrollTop = 0; }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !detail.hidden) clearSelection();
});
// El panel de detalle cambia el tamaño de los globos en escritorio.
new ResizeObserver(() => requestRender()).observe(stage);

// ---------------------------------------------------------------------------------------------
// Comparación de terreno con la Tierra (lo que era el «Visor 3D de Marte», ampliado a la Luna):
// - un parche HiRISE de Marte (2 km) con sus 5 mejores análogos del catálogo (rankEarthSites);
// - un sitio de referencia de la Luna o de Marte (ventana L0 de 30 km) con sus gemelos de results.json.
// Tarjetas, los dos terrenos en 3D a la misma escala y la tabla de medidas. Si las alturas L0 aún no están
// exportadas (public/terrain/l0/), se muestran las imágenes de relieve sombreado en 2D.

const patchNames = new Map<string, number>();
for (const { name } of marsPatches) patchNames.set(name, (patchNames.get(name) ?? 0) + 1);
/** Nombre del parche; si hay otro con el mismo nombre, se añaden sus coordenadas. */
const patchLabel = (site: Site) =>
  (patchNames.get(site.name) ?? 0) > 1 ? `${tr(site.name)} (${coord(site.latitude, site.longitude)})` : tr(site.name);
const earthItemAt = (lat: number, lon: number) => earthByKey.get(earthKey(lat, lon));

function originLabel(site: Site) {
  if (site.origin === "curated") return t("v.origin.curated");
  return site.knownAnalog ? t("v.origin.near", { name: tr(site.knownAnalog) }) : t("v.origin.new");
}

/** Lugar de la Tierra que se compara con el sitio elegido (de un parche HiRISE o de una referencia L0). */
type Analog = {
  lat: number; lon: number;
  total: number; terrain: number; surface: number; climate: number;
  match?: Match;
  twin?: EarthSite;
};
type Subject = { item: Item; patch?: Site; ref?: Reference };
type GridMetrics = { medianSlope: number; steepSlope: number; relief: number; medianElevation: number };

const analogName = (a: Analog) => {
  if (a.match) return tr(a.match.site.name);
  const item = earthItemAt(a.lat, a.lon);
  return item ? label(item) : windowName(a.lat, a.lon);
};
const analogOrigin = (a: Analog) => {
  if (a.match) return originLabel(a.match.site);
  const near = a.twin?.known_analog;
  return near ? t("v.origin.near", { name: tr(near) }) : t("v.origin.new");
};

/**
 * Los 5 análogos de un parche: un parche por región escaneada (ids como "g012-34") para que salgan lugares
 * distintos, y siempre el mejor sitio curado (USGS 3DEP, más resolución). Mismo criterio que tenía el visor.
 */
function patchAnalogs(site: Site): [Analog[], number] {
  const ranked = rankEarthSites(site);
  const regions = new Set<string>();
  const shown = ranked.filter(({ site: s }) => {
    const region = s.origin === "global" ? s.id.split("-")[0] : s.id;
    if (regions.has(region)) return false;
    regions.add(region);
    return true;
  }).slice(0, 5);
  const bestCurated = ranked.find(({ site: s }) => s.origin === "curated");
  if (bestCurated && !shown.includes(bestCurated)) shown[shown.length - 1] = bestCurated;
  const analogs = shown.map((match) => ({
    lat: match.site.latitude, lon: match.site.longitude,
    total: match.total, terrain: match.terrain, surface: match.surface, climate: match.climate, match,
  }));
  return [analogs, ranked.length];
}
const refAnalogs = (ref: Reference): Analog[] => twinsOf(ref).map((twin) => ({
  lat: twin.lat, lon: twin.lon, total: twin.score,
  terrain: twin.scores.terrain, surface: twin.scores.surface, climate: twin.scores.climate, twin,
}));
/** Referencias que se pueden comparar: sitios y centros de región que puntúan y tienen gemelos. */
const comparableRef = (ref: Reference) => isHeadlineRef(ref) && ref.usable !== false && twinsOf(ref).length > 0;

const compare = {
  subject: null as Subject | null,
  analogs: [] as Analog[],
  analog: undefined as Analog | undefined,
  ranked: 0,
  pending: undefined as AbortController | undefined,
  viewer: undefined as ReturnType<typeof createViewer> | undefined,
  failed: false,
  flat: false,
  statusKey: null as string | null,
  /** Medidas calculadas de las alturas L0 (referencia, Tierra) cuando se han cargado. */
  gridMetrics: null as [GridMetrics, GridMetrics] | null,
  /** Referencia cuya ventana se dibuja (la best_ref del gemelo, que en una región puede ser una tesela). */
  shownRef: null as Reference | null,
  /** Tamaño de celda de las alturas L0 cargadas (m), para avisar de que las pendientes no son las del mapa. */
  cellM: 300,
};
const matchList = $<HTMLElement>("#match-list");
const terrainCanvas = $<HTMLCanvasElement>("#terrain");
const terrainStage = terrainCanvas.parentElement!;
const terrainStatus = $<HTMLElement>("#viewer-error");
const terrainLegend = $<HTMLElement>("#legend");
const terrainButtons = document.querySelectorAll<HTMLButtonElement>(".comparison .toolbar button");
const flatView = document.createElement("div");
flatView.className = "gl-flat";
flatView.hidden = true;
terrainStage.append(flatView);
const dec = (v: number, d = 1) => fmt(v, d);
const share = (v: number) => `${pct(v)}${getLang() === "es" ? " %" : "%"}`;
const BASE = import.meta.env.BASE_URL;

function setTerrainStatus(key: string | null) {
  compare.statusKey = key;
  terrainStatus.hidden = key === null;
  if (key) terrainStatus.textContent = t(key);
}
function showTerrainError() {
  compare.failed = true;
  setTerrainStatus("v.viewerError");
  terrainCanvas.hidden = true;
  for (const button of terrainButtons) button.disabled = true;
}
terrainCanvas.addEventListener("webglcontextlost", showTerrainError);

const terrainModes = document.querySelectorAll<HTMLButtonElement>(".comparison [data-mode]");
for (const button of terrainModes) {
  button.addEventListener("click", () => {
    const value = button.dataset.mode as TerrainMode;
    compare.viewer?.setMode(value);
    terrainLegend.style.visibility = value === "slope" ? "visible" : "hidden";
    for (const option of terrainModes) option.setAttribute("aria-pressed", String(option === button));
  });
}
$("#top-view").addEventListener("click", () => compare.viewer?.setView("top"));
$("#reset-view").addEventListener("click", () => compare.viewer?.setView("oblique"));

// ---- alturas L0 (public/terrain/l0/, exportadas por el pipeline) ----
type L0Manifest = { window_km: number; grid: number; cell_m: number; refs: string[]; earth: string[] };
let manifestPromise: Promise<L0Manifest | null> | undefined;
function l0Manifest() {
  manifestPromise ??= fetch(`${BASE}terrain/l0/index.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => (m && Array.isArray(m.refs) && Array.isArray(m.earth) && m.grid > 1 && m.cell_m > 0 ? m as L0Manifest : null))
    .catch(() => null);
  return manifestPromise;
}
const key4 = (lat: number, lon: number) => `${lat.toFixed(4)}_${lon.toFixed(4)}`;
const l0Cache = new Map<string, Float32Array>();
async function loadL0(file: string, n: number, signal: AbortSignal) {
  const hit = l0Cache.get(file);
  if (hit) return hit;
  const response = await fetch(`${BASE}terrain/l0/${file}`, { signal });
  if (!response.ok) throw new Error(`No se pudo cargar ${file}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== n * n * 4) throw new Error(`Tamaño no válido: ${file}`);
  const view = new DataView(bytes);
  const elevation = Float32Array.from({ length: n * n }, (_, i) => view.getFloat32(i * 4, true));
  if (!elevation.every(Number.isFinite)) throw new Error(`Celdas no válidas: ${file}`);
  if (l0Cache.size > 24) l0Cache.delete(l0Cache.keys().next().value!);
  l0Cache.set(file, elevation);
  return elevation;
}
function quantile(sorted: Float32Array | number[], q: number) {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
}
/** Mismas medidas que el catálogo: pendiente mediana y p90, desnivel p5–p95 y elevación mediana. */
function gridMetricsOf(elevation: Float32Array, n: number, cell: number): GridMetrics {
  const slopes = Float32Array.from(gridSlopes(elevation, n, cell)).sort();
  const heights = Float32Array.from(elevation).sort();
  return {
    medianSlope: quantile(slopes, 0.5), steepSlope: quantile(slopes, 0.9),
    relief: quantile(heights, 0.95) - quantile(heights, 0.05), medianElevation: quantile(heights, 0.5),
  };
}

function setComparison(item: Item) {
  const subject: Subject = { item, patch: item.patch, ref: item.ref };
  compare.subject = subject;
  if (subject.patch) [compare.analogs, compare.ranked] = patchAnalogs(subject.patch);
  else { compare.analogs = refAnalogs(subject.ref!); compare.ranked = 0; }
  compare.analog = compare.analogs[0];
  pickSelect.value = item.id;
  renderComparisonTexts();
  if (compare.analog) void selectAnalog(compare.analog, false);
}
const pickSelect = $<HTMLSelectElement>("#hirise-site");
pickSelect.addEventListener("change", () => {
  const item = itemById.get(pickSelect.value);
  if (!item) return;
  // Si en los globos ya hay un sitio elegido, se cambia también allí para que ficha y comparación coincidan.
  if (selected?.kind === "patch" || selected?.kind === "ref") select(item);
  else setComparison(item);
});
$("#hirise-show").addEventListener("click", () => {
  const item = itemById.get(pickSelect.value);
  if (!item) return;
  select(item);
  stage.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
});

function showFlat(subject: Subject, analog: Analog) {
  const ref = compare.shownRef ?? subject.ref!;
  const px = ref.body === "moon" ? 120 : 200;
  const la = analog.lat.toFixed(4);
  const lo = analog.lon.toFixed(4);
  const figure = (urls: string[], caption: string) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.alt = caption;
    img.decoding = "async";
    let i = 0;
    img.addEventListener("error", () => {
      if (++i < urls.length) { img.src = urls[i]; return; }
      const empty = document.createElement("div");
      empty.className = "gl-flat-empty";
      empty.textContent = t("lm.noImage");
      img.replaceWith(empty);
    });
    img.src = urls[0];
    fig.append(img);
    return fig;
  };
  flatView.replaceChildren(
    figure([`${BASE}relieve/ref_${ref.id}_L0.png`, `${BASE}relieve/ref_${ref.id}.png`], tr(ref.name)),
    figure([`${BASE}relieve/e_${la}_${lo}_L0_${px}m.png`, `${BASE}relieve/e_${la}_${lo}.png`], analogName(analog)),
  );
  compare.flat = true;
  flatView.hidden = false;
  terrainCanvas.style.visibility = "hidden";
  terrainLegend.style.visibility = "hidden";
  for (const button of terrainButtons) button.disabled = true;
  setTerrainStatus(null);
  renderScaleText();
}

/** Elige el análogo que se compara: la Tierra vuela a él (si el sitio está elegido en los globos) y se cargan los terrenos. */
async function selectAnalog(analog: Analog, fly = true) {
  const subject = compare.subject;
  if (!subject) return;
  compare.analog = analog;
  compare.gridMetrics = null;
  compare.shownRef = subject.ref ? (refById.get(analog.twin?.best_ref ?? "") ?? subject.ref) : null;
  if (fly && selected === subject.item) {
    focusPair(subject.item, earthItemAt(analog.lat, analog.lon), subject.patch ? PATCH_KM : undefined);
  }
  for (const button of document.querySelectorAll<HTMLElement>("#match-list button, .gl-analogs button")) {
    button.setAttribute("aria-pressed", String(compare.analogs[Number(button.dataset.match)] === analog));
  }
  renderTerrainDetails();
  compare.pending?.abort();
  const request = new AbortController();
  compare.pending = request;
  if (compare.failed) return;
  compare.flat = false;
  flatView.hidden = true;
  terrainCanvas.style.visibility = "hidden";
  setTerrainStatus("v.loading");
  for (const button of terrainButtons) button.disabled = true;
  try {
    let grids: ViewerSite[];
    if (subject.patch) {
      grids = await Promise.all([subject.patch, analog.match!.site].map((s) => loadTerrain(s, request.signal)));
    } else {
      const manifest = await l0Manifest();
      const ref = compare.shownRef!;
      const refId = manifest?.refs.includes(ref.id) ? ref.id : manifest?.refs.includes(subject.ref!.id) ? subject.ref!.id : null;
      const earth = key4(analog.lat, analog.lon);
      if (request.signal.aborted) return;
      if (!manifest || !refId || !manifest.earth.includes(earth)) { showFlat(subject, analog); return; }
      if (refId !== ref.id) compare.shownRef = subject.ref!;
      const { grid: n, cell_m: cell } = manifest;
      const [a, b] = await Promise.all([
        loadL0(`ref_${refId}.f32`, n, request.signal), loadL0(`e_${earth}.f32`, n, request.signal),
      ]);
      const ma = gridMetricsOf(a, n, cell);
      const mb = gridMetricsOf(b, n, cell);
      compare.gridMetrics = [ma, mb];
      compare.cellM = cell;
      grids = [
        { id: `l0:ref:${refId}`, elevation: a, n, cell, metrics: ma },
        { id: `l0:e:${earth}`, elevation: b, n, cell, metrics: mb },
      ];
      renderTerrainDetails();
    }
    if (request.signal.aborted || compare.failed) return;
    if (compare.viewer) {
      compare.viewer.setSites(grids);
    } else {
      try {
        compare.viewer = createViewer(terrainCanvas, grids);
      } catch {
        showTerrainError();
        return;
      }
    }
    setTerrainStatus(null);
    terrainCanvas.style.visibility = "visible";
    const slopeOn = document.querySelector(".comparison [data-mode='slope']")?.getAttribute("aria-pressed") === "true";
    terrainLegend.style.visibility = slopeOn ? "visible" : "hidden";
    for (const button of terrainButtons) button.disabled = false;
    renderScaleText();
  } catch (error) {
    if (request.signal.aborted || compare.failed) return;
    console.error(error);
    setTerrainStatus("v.loadError");
  }
}

const MATCH_METRICS = [
  { key: "terrain", icon: "M2 13 6 6l2 3 2-5 4 9H2Z" },
  { key: "surface", icon: "M2 5h12M2 8l4 1 4-1 4 1M2 12h12" },
  { key: "climate", icon: "M8 2v1m0 10v1M2 8h1m10 0h1M3.75 3.75l.7.7m7.1 7.1.7.7m0-8.5-.7.7m-7.1 7.1-.7.7M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" },
] as const;

function renderMatchCards() {
  matchList.replaceChildren(...compare.analogs.map((analog, index) => {
    const item = document.createElement("li");
    item.style.setProperty("--i", String(index)); // retardo de la entrada escalonada (style.css)
    const best = index === 0 && compare.ranked ? t("v.bestOf", { n: compare.ranked }) : "";
    const origin = analog.match?.site.origin ?? "global";
    item.innerHTML = `<button type="button" data-match="${index}" aria-pressed="${analog === compare.analog}">
      <span class="match-rank" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="match-score" aria-hidden="true">${pct(analog.total)}</span>
      <span class="match-name">${esc(analogName(analog))}</span>
      <span class="match-origin ${origin}">${esc(analogOrigin(analog))}</span>
      <span class="match-meta" aria-hidden="true">${esc(best.replace(/[\s·]+$/u, ""))}</span>
      <span class="match-distance">${esc(best + t("v.score", { v: pct(analog.total) }))}</span>
      <span class="match-bars">${MATCH_METRICS.map(({ key, icon }) => `
        <span class="match-metric">
          <span class="match-metric-label"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${icon}"/></svg>${t(`v.bar.${key}`)}</span>
          <i aria-hidden="true" style="--v:${analog[key]}"></i>
          <span class="match-metric-value">${pct(analog[key])}</span>
        </span>`).join("")}</span>
    </button>`;
    return item;
  }));
}
matchList.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLElement>("[data-match]");
  const analog = button && compare.analogs[Number(button.dataset.match)];
  if (analog) void selectAnalog(analog);
});

function renderScaleText() {
  const subject = compare.subject;
  const scale = $("#grid-scale");
  if (!subject || subject.patch) { scale.textContent = t("v.gridScale", { w: patchWidth / 1000, c: cellSize }); return; }
  if (compare.flat) { scale.textContent = ui("flat.scale", { w: WINDOW_KM }); return; }
  void l0Manifest().then((m) => {
    if (m && compare.subject === subject && !compare.flat) {
      scale.textContent = t("v.gridScale", { w: fmt(m.window_km, 0), c: fmt(m.cell_m, 0) });
    }
  });
}

/** Cabeceras de los dos terrenos y tabla de medidas, clima y puntuación. */
function renderTerrainDetails() {
  const subject = compare.subject;
  const analog = compare.analog;
  if (!subject || !analog) return;
  const body: Body = subject.ref?.body ?? "mars";
  const where = (lat: number, lon: number, link?: string, title = "") => link?.startsWith("http")
    ? `<a href="${esc(link)}" title="${esc(title)}" target="_blank" rel="noopener">${coord(lat, lon, 3)}</a>` : `<p>${coord(lat, lon, 3)}</p>`;
  const shown = compare.shownRef ?? subject.ref;
  const left = subject.patch
    ? `<h2>${esc(patchLabel(subject.patch))}</h2>${where(subject.patch.latitude, subject.patch.longitude, subject.patch.raster || subject.patch.sourceUrl, subject.patch.source)}`
    : `<h2>${refName(shown!.id)}</h2>${where(shown!.lat, shown!.lon, shown!.source_url)}`;
  const earthLink = analog.match ? analog.match.site.raster || analog.match.site.sourceUrl : undefined;
  $("#site-headings").innerHTML = `<div class="site is-${body}">${left}</div>`
    + `<div class="site"><h2>${esc(analogName(analog))}</h2>${where(analog.lat, analog.lon, earthLink, analog.match?.site.source)}</div>`;
  const bodyHead = $("#details thead th:nth-child(2)");
  bodyHead.textContent = bodyName(body);
  bodyHead.classList.toggle("is-moon", body === "moon");

  const tr3 = (label: string, a: string, b: string) => `<tr><th scope="row">${label}</th><td>${a}</td><td>${b}</td></tr>`;
  const group = (label: string) => `<tr class="group"><th scope="rowgroup" colspan="3">${label}</th></tr>`;
  const scoreRows = [
    group(t("v.group.score")),
    tr3(t("v.terrainSim", { p: share(weights.terrain) }), "", String(pct(analog.terrain))),
    tr3(t("v.surfaceW", { p: share(weights.surface) }), "", String(pct(analog.surface))),
    tr3(t("v.climateW", { p: share(weights.climate) }), "", String(pct(analog.climate))),
    tr3(t("v.total"), "", `<strong>${pct(analog.total)}</strong>`),
  ];

  if (subject.patch) {
    const site = subject.patch;
    const earth = analog.match!.site;
    const cover = earth.cover;
    const climate = earth.climate;
    const polar = site.category === "Ice & polar terrain";
    $("#metrics").innerHTML = metricDefinitions.map(({ key, label, unit }) =>
      tr3(t(label), `${dec(site.metrics[key])}${unit}`, `${dec(earth.metrics[key])}${unit}`)).join("") + [
      group(t("v.group.surface")),
      tr3(t("v.bare"), polar ? t("v.dustRock") : share(1), cover ? `${share(cover.bare)}${cover.assumed ? t("v.assumed") : ""}` : "—"),
      tr3(t("v.snowIce"), polar ? t("v.iceRich") : "—", cover ? share(cover.snow_ice) : "—"),
      tr3(t("v.vegetation"), share(0), cover ? share(cover.vegetation) : "—"),
      group(t("v.group.climate")),
      tr3(t("v.tMean"), `${marsClimate.t_mean} °C`, climate ? `${dec(climate.t_mean)} °C` : "—"),
      tr3(t("v.diurnal"), `~${marsClimate.diurnal_range} °C`, climate ? `${dec(climate.diurnal_range)} °C` : "—"),
      tr3(t("v.precip"), `${marsClimate.precip_year} mm`, climate ? `${Math.round(climate.precip_year)} mm` : "—"),
      ...scoreRows,
    ].join("");
    return;
  }
  // Referencia L0: las medidas del terreno salen de las alturas cargadas (si aún no hay, «—»).
  const [ma, mb] = compare.gridMetrics ?? [null, null];
  const climate = analog.twin?.climate;
  const bodyClimate = (v: string) => (body === "mars" ? v : ui("moon.noAir"));
  $("#metrics").innerHTML = group(ui("group.terrainGrid", { c: fmt(compare.cellM, 0) })) + metricDefinitions.map(({ key, label, unit }) =>
    tr3(t(label), ma ? `${dec(ma[key], key === "relief" ? 0 : 1)}${unit}` : "—", mb ? `${dec(mb[key], key === "relief" ? 0 : 1)}${unit}` : "—"),
  ).join("") + [
    group(ui("group.climateRef")),
    tr3(t("v.tMean"), bodyClimate(`${marsClimate.t_mean} °C`), climate ? `${dec(climate.t_mean)} °C` : "—"),
    tr3(t("v.diurnal"), bodyClimate(`~${marsClimate.diurnal_range} °C`), climate ? `${dec(climate.diurnal_range)} °C` : "—"),
    tr3(t("v.precip"), bodyClimate(`${marsClimate.precip_year} mm`), climate ? `${Math.round(climate.precip_year)} mm` : "—"),
    ...scoreRows,
  ].join("");
}

/** Textos generados de la comparación (también al cambiar de idioma). */
function renderComparisonTexts() {
  terrainLegend.innerHTML = `<span>${t("v.slope")}</span>${slopeBands.map(({ label, color }) =>
    `<span><i style="background:${color}" aria-hidden="true"></i>${label}</span>`).join("")}`;
  if (compare.statusKey) setTerrainStatus(compare.statusKey);
  const subject = compare.subject;
  renderScaleText();
  if (!subject) return;
  $("#gl-more-for").textContent = subject.patch
    ? ui("more.for", { site: patchLabel(subject.patch), w: patchWidth / 1000 })
    : ui("more.forRef", { site: tr(subject.ref!.name), body: bodyName(subject.ref!.body), w: WINDOW_KM, n: compare.analogs.length });
  $<HTMLElement>("#ranking-method").hidden = !subject.patch;
  renderMatchCards();
  renderTerrainDetails();
}

// ---------------------------------------------------------------------------------------------
// Controles: modo, desplegables y leyenda

const modeButtons = document.querySelectorAll<HTMLButtonElement>(".gl-seg button");
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    mode = button.dataset.mode as Mode;
    for (const b of modeButtons) b.setAttribute("aria-pressed", String(b === button));
    refreshPoints();
  });
}

const refSelect = $<HTMLSelectElement>("#gl-ref");
function fillRefs() {
  refSelect.innerHTML = `<option value="">${esc(t("gl.allSites"))}</option>${BODIES.map((body) =>
    `<optgroup label="${esc(bodyName(body))}">${globeReferences.filter((r) => r.body === body)
      .map((r) => `<option value="${esc(r.id)}">${refName(r.id)}</option>`).join("")}</optgroup>`).join("")}${hiriseOptions()}`;
  refSelect.value = selected?.kind === "patch" ? selected.id : (refFilter ?? "");
  pickSelect.innerHTML = BODIES.map((body) => {
    const refs = globeReferences.filter((r) => r.body === body && comparableRef(r));
    return refs.length ? `<optgroup label="${esc(ui("pick.refs", { body: bodyName(body) }))}">${refs.map((r) =>
      `<option value="ref:${esc(r.id)}">${refName(r.id)}</option>`).join("")}</optgroup>` : "";
  }).join("") + hiriseOptions();
  if (compare.subject) pickSelect.value = compare.subject.item.id;
}
/** Sitios HiRISE de Marte por categoría de terreno (el selector del antiguo visor 3D). */
function hiriseOptions() {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    if (item.kind !== "patch") continue;
    const list = groups.get(item.patch!.category) ?? [];
    list.push(item);
    groups.set(item.patch!.category, list);
  }
  return [...groups].map(([category, list]) =>
    `<optgroup label="${esc(ui("pick.hirise", { cat: categoryLabel(category) }))}">${list.map((item) =>
      `<option value="${esc(item.id)}">${esc(patchLabel(item.patch!))}</option>`).join("")}</optgroup>`).join("");
}
refSelect.addEventListener("change", () => {
  const patch = refSelect.value.startsWith("patch:") ? itemById.get(refSelect.value) : undefined;
  if (patch) { select(patch); return; }
  refFilter = refSelect.value || null;
  if (refFilter) select(refItem.get(refFilter)!);
  else refreshPoints();
});

const gotoSelect = $<HTMLSelectElement>("#gl-goto");
function fillGoto() {
  const lang = locale();
  const groups = (["moon", "earth", "mars"] as GlobeId[]).map((globe) => {
    const list = items.filter((i) => i.globe === globe && i.visible && i.kind !== "heat")
      .map((i) => ({ item: i, text: label(i) }))
      .sort((a, b) => Number(b.item.named) - Number(a.item.named) || (a.item.named
        ? a.text.localeCompare(b.text, lang)
        : (bestScore(b.item) - bestScore(a.item))));
    if (!list.length) return "";
    return `<optgroup label="${esc(t("gl.group", { body: bodyName(globe), n: list.length }))}">${list.map(({ item, text }) =>
      `<option value="${esc(item.id)}">${esc(text)}</option>`).join("")}</optgroup>`;
  });
  gotoSelect.innerHTML = `<option value="">${esc(t("gl.choosePoint"))}</option>${groups.join("")}`;
  gotoSelect.value = selected && selected.visible && selected.kind !== "heat" ? selected.id : "";
}
function bestScore(item: Item) {
  const data = item.earth?.data;
  return data ? Math.max(...BODIES.map((b) => data[b]?.score ?? 0)) : 0;
}
gotoSelect.addEventListener("change", () => {
  const item = itemById.get(gotoSelect.value);
  if (item) select(item);
});

// Las muestras imitan los puntos, que van encima de las imágenes de los planetas: colores fijos.
const legend = $<HTMLElement>("#gl-legend");
// Las muestras de forma (sin color de cuerpo) usan el color del texto para verse en los dos temas.
const SHAPE_INK = "var(--text)";
const swatch = (shape: string, color: string) => `<i class="gl-sw gl-sw-${shape}" style="--c:${color}"></i>`;
function fillLegend() {
  legend.innerHTML = `
    <span>${swatch("disc", COLOR.moon)}${t("gl.analogOf.moon")}</span>
    <span>${swatch("disc", COLOR.mars)}${t("gl.analogOf.mars")}</span>
    <span>${swatch("diamond", SHAPE_INK)}${t("gl.lg.ref")}</span>
    <span>${swatch("star", SHAPE_INK)}${t("gl.lg.featured")}</span>
    <span>${swatch("disc", SHAPE_INK)}${t("gl.lg.site", { moon: bodyName("moon"), moonMin: BEST_MIN_SCORE.moon, mars: bodyName("mars"), marsMin: BEST_MIN_SCORE.mars })}</span>
    <span>${swatch("ring", SHAPE_INK)}${t("gl.lg.validation")}</span>
    <span>${swatch("small", SHAPE_INK)}${t("gl.lg.catalog")}</span>
    <span><i class="gl-ramp" style="--a:${HEAT_RAMP.moon[0]};--b:${HEAT_RAMP.moon[1]}"></i><i class="gl-ramp" style="--a:${HEAT_RAMP.mars[0]};--b:${HEAT_RAMP.mars[1]}"></i>${t("gl.lg.heat")}</span>
    <span class="gl-lg-hint">${swatch("disc", PATCH_COLOR)}${esc(ui("lg.hirise"))}</span>`;
}
const legendToggle = $<HTMLButtonElement>("#gl-legend-toggle");
legendToggle.addEventListener("click", () => {
  const open = legendToggle.getAttribute("aria-expanded") !== "true";
  legendToggle.setAttribute("aria-expanded", String(open));
  legend.classList.toggle("is-open", open);
});

// ---------------------------------------------------------------------------------------------
// Fuentes

const sources: [string, string][] = [
  ["gl.src.moonRefs", "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/"],
  ["gl.src.moonSldem", "https://astrogeology.usgs.gov/search/map/moon_lro_lola_selene_kaguya_tc_dem_merge_60n60s_59m"],
  ["gl.src.marsRefs", "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"],
  ["gl.src.hirise", "https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/"],
  ["gl.src.copernicus", "https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-90"],
  ["src.earth3dep", "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"],
  ["src.earthGlo30", "https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30"],
  ["gl.src.worldcover", "https://planetarycomputer.microsoft.com/dataset/esa-worldcover"],
  ["gl.src.climate", "https://www.meteomatics.com/en/weather-api/"],
  ["gl.src.earthImage", "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/"],
  ["gl.src.marsImage", "https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m"],
];
if (MOON_TEXTURE) sources.push(["gl.src.moonImage", "https://svs.gsfc.nasa.gov/4720"]);
sources.push(["gl.src.moonPole", "https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m"]);
sources.push(
  ["gl.src.earthTiles", "https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"],
  ["gl.src.moonTiles", "https://trek.nasa.gov/moon/"],
  ["gl.src.marsTiles", "https://murray-lab.caltech.edu/CTX/"],
);
function fillSources() {
  $("#source-list").innerHTML = sources.map(([key, url]) => `<li><a href="${url}">${esc(t(key))}</a></li>`).join("");
}

// ---------------------------------------------------------------------------------------------
// Arranque

canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  contextLost = true;
  errorBox.hidden = false;
  hideTip();
});
canvas.addEventListener("webglcontextrestored", () => {
  contextLost = false;
  errorBox.hidden = true;
  requestRender();
});

function paintTexts() {
  fillRefs();
  fillLegend();
  fillSources();
  refreshPoints();
}
// Al cambiar de idioma se vuelve a pintar todo lo generado por código sin perder la selección ni el filtro.
onLangChange(() => {
  hideTip();
  paintTexts();
  renderComparisonTexts();
  if (selected && !detail.hidden) {
    const scroll = detail.scrollTop;
    renderDetail(selected);
    detail.scrollTop = scroll;
  }
});
paintTexts();
const startItem = itemById.get("patch:jezero") ?? items.find((i) => i.kind === "patch");
if (startItem) setComparison(startItem);
