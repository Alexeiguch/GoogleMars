// Página «Globos 3D»: Luna | Tierra | Marte en un solo canvas (un contexto WebGL), con viewports y scissor
// como src/globes.ts. Se dibuja solo cuando algo cambia (sin bucle continuo).
import "./style.css";
import "./globos.css";
import "./prefs";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadGlobeTexture } from "./globeTexture";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { categoryLabel, type Site } from "./data";
import { locale, onLangChange, t, tr } from "./i18n";
import {
  BODIES, DATA, bodyName, buildEarthPoints, coord, fmt, globeReferences, marsPatches, refById, topSite,
  windowName, type Body, type EarthPoint, type EarthRole, type GlobeId, type Reference,
} from "./globosData";
import { TileLayer, direction, type TileLayerOptions } from "./tiles";

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
for (const point of buildEarthPoints()) {
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
let mode: Mode = "best";
let refFilter: string | null = null;
let selected: Item | null = null;
let highlighted = new Set<Item>();

function matchesRef(point: EarthPoint, refId: string) {
  const ref = refById.get(refId)!;
  return point.data[ref.body]?.best_ref === refId ||
    point.roles.some((r) => r.kind === "twin" && r.body === ref.body && r.ref === (ref.twin_key ?? refId));
}

function isVisible(item: Item) {
  switch (item.kind) {
    case "ref": return !refFilter || item.ref!.id === refFilter;
    case "patch": return mode === "all" && !refFilter;
    case "heat": return mode === "all" && !refFilter;
    case "earth": {
      const point = item.earth!;
      if (refFilter) {
        if (!matchesRef(point, refFilter)) return false;
        // Con un sitio elegido se ven siempre sus 3 gemelos, aunque no lleguen al puntaje de «Mejores».
        const ref = refById.get(refFilter)!;
        return mode === "all" || point.best ||
          point.roles.some((r) => r.kind === "twin" && r.body === ref.body && r.ref === (ref.twin_key ?? refFilter));
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
  return (DATA.bodies[ref.body].twins[ref.twin_key ?? ref.id] ?? [])
    .map((t) => earthByKey.get(earthKey(t.lat, t.lon)))
    .filter((i): i is Item => !!i);
}

/** Lado en km de la zona que se comparó para este punto. */
function windowKm(item: Item) {
  if (item.kind === "patch") return PATCH_KM;
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
function focusPair(item: Item, partner?: Item) {
  const pair = partner ? [item, partner] : [item];
  const side = Math.max(...pair.map(windowKm));
  const floor = Math.max(...pair.map((i) => MIN_ALTITUDE[i.globe] * RADIUS_KM[i.globe]));
  const km = Math.max(side / (FRAME_FILL * 2 * VIEW_TAN), floor);
  hideFrames();
  for (const i of pair) {
    flyTo(globes[i.globe], i.vec, 1 + km / RADIUS_KM[i.globe]);
    showFrame(i, windowKm(i));
  }
}

/**
 * Al elegir un punto (tocándolo, en «Ir a un punto», en el filtro o en el panel) se acercan los dos globos de la
 * pareja a la vez: el punto de la Tierra y su sitio más parecido de la Luna o Marte, o el sitio y su gemelo n.º 1.
 * Los parches HiRISE y las celdas de calor no tienen pareja: solo se acerca su globo.
 */
function select(item: Item) {
  selected = item;
  highlighted = new Set([item]);
  let partner: Item | undefined;
  if (item.kind === "ref") {
    const twins = twinItemsOf(item.ref!);
    twins.forEach((t) => highlighted.add(t));
    partner = twins[0];
  } else if (item.kind === "earth") {
    const body = bestBody(item.earth!);
    partner = body ? refItem.get(item.earth!.data[body]!.best_ref) : undefined;
    if (partner) highlighted.add(partner);
  }
  focusPair(item, partner);
  refreshPoints();
  renderDetail(item);
  detail.scrollTop = 0;
  const goto = $<HTMLSelectElement>("#gl-goto");
  goto.value = item.kind === "heat" ? "" : item.id;
}

function clearSelection() {
  selected = null;
  highlighted = new Set();
  hideFrames();
  detail.hidden = true;
  detail.innerHTML = "";
  $<HTMLSelectElement>("#gl-goto").value = "";
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
const refName = (id: string) => esc(tr(refById.get(id)?.name ?? id));
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
    const twins = DATA.bodies[ref.body].twins[ref.twin_key ?? ref.id] ?? [];
    html = header(t("gl.refKicker", { body: bodyName(ref.body) }), label(item), ref.lat, ref.lon);
    html += `<ul class="gl-roles"><li>${t(`gl.refRole.${ref.body}`)}</li></ul>`;
    if (ref.note) html += `<p class="gl-note">${esc(tr(ref.note))}</p>`;
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
    const bodies = BODIES.filter((b) => point.data[b]).sort((a, b) => point.data[b]!.score - point.data[a]!.score);
    for (const body of bodies) {
      const site = point.data[body]!;
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
    const climate = bodies.length ? point.data[bodies[0]]!.climate : catalog?.site.climate;
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
  const button = target.closest<HTMLElement>("[data-item]");
  const item = button && itemById.get(button.dataset.item!);
  if (item) { select(item); detail.scrollTop = 0; }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !detail.hidden) clearSelection();
});
// El panel de detalle cambia el tamaño de los globos en escritorio.
new ResizeObserver(() => requestRender()).observe(stage);

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
      .map((r) => `<option value="${esc(r.id)}">${refName(r.id)}</option>`).join("")}</optgroup>`).join("")}`;
  refSelect.value = refFilter ?? "";
}
refSelect.addEventListener("change", () => {
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
    <span>${swatch("disc", SHAPE_INK)}${t("gl.lg.site")}</span>
    <span>${swatch("ring", SHAPE_INK)}${t("gl.lg.validation")}</span>
    <span>${swatch("small", SHAPE_INK)}${t("gl.lg.catalog")}</span>
    <span><i class="gl-ramp" style="--a:${HEAT_RAMP.moon[0]};--b:${HEAT_RAMP.moon[1]}"></i><i class="gl-ramp" style="--a:${HEAT_RAMP.mars[0]};--b:${HEAT_RAMP.mars[1]}"></i>${t("gl.lg.heat")}</span>`;
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
  ["gl.src.moonRefs", "https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m"],
  ["gl.src.marsRefs", "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m"],
  ["gl.src.hirise", "https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/"],
  ["gl.src.copernicus", "https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-90"],
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
  if (selected && !detail.hidden) {
    const scroll = detail.scrollTop;
    renderDetail(selected);
    detail.scrollTop = scroll;
  }
});
paintTexts();
