// Mosaicos por nivel de zoom sobre una esfera de radio 1 (página «Globos 3D»).
//
// Cada globo tiene un TileLayer: un árbol de mosaicos (cada mosaico se parte en 4 al acercarse) que
// en cada fotograma decide qué mosaicos hacen falta según lo que ve la cámara, los pide en orden
// (primero los más generales y los del centro de la vista) y, mientras llegan, dibuja el antecesor
// más cercano que ya esté cargado. Debajo sigue la esfera con la imagen global, que sirve de respaldo
// sin conexión y para las zonas sin datos.
//
// Los mosaicos se dibujan sin prueba de profundidad, en orden de nivel (el más detallado encima), y
// solo por la cara frontal: en una esfera convexa eso basta para que no se pisen ni asome la cara oculta.
import * as THREE from "three";

/** SphereGeometry empieza en el antimeridiano; la longitud este crece hacia -Z. */
export function direction(lat: number, lon: number) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

export type TileSource = {
  /** Primer nivel en el que se usa esta fuente (en Marte, Viking de lejos y CTX de cerca). */
  minLevel: number;
  maxLevel: number;
  tileSize: number;
  url: (z: number, x: number, y: number) => string;
  /** Multiplica el color del mosaico para igualarlo con la imagen global (brillo y tono), en valores sRGB. */
  tint?: [number, number, number];
  /** PNG con huecos sin datos: se ve el nivel de debajo. */
  transparent?: boolean;
};


export type TileLayerOptions = {
  /** geographic: lat/lon lineales, raíz de 2 × 1 mosaicos. mercator: Web Mercator, raíz de 1 mosaico (±85,05°). */
  scheme: "geographic" | "mercator";
  sources: TileSource[];
  onLoad: () => void;
};

const MAX_IN_FLIGHT = 8;
const MAX_CACHED = 320;
/** Un mosaico se parte cuando ocupa en pantalla más de QUALITY × su tamaño en píxeles. */
const QUALITY = 1.1;
const RENDER_ORDER = -100;  // por debajo de los puntos y de la capa polar; la esfera base va en -1000

type Node = {
  z: number;
  x: number;
  y: number;
  key: string;
  latS: number;
  latN: number;
  lon0: number;
  lon1: number;
  center: THREE.Sphere;
  children: Node[] | null;
  state: "idle" | "loading" | "ready" | "error";
  mesh: THREE.Mesh | null;
  lastUsed: number;
};

const mercLat = (t: number) => THREE.MathUtils.radToDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * t))));
const wrap180 = (d: number) => ((d + 540) % 360) - 180;

export class TileLayer {
  readonly group = new THREE.Group();
  private readonly roots: Node[];
  private readonly nodes = new Map<string, Node>();
  private inFlight = 0;
  private frame = 0;
  private readonly frustum = new THREE.Frustum();
  private readonly matrix = new THREE.Matrix4();
  private readonly maxLevel: number;
  private anisotropy = 1;

  constructor(private readonly options: TileLayerOptions) {
    this.maxLevel = Math.max(...options.sources.map((s) => s.maxLevel));
    this.roots = options.scheme === "geographic" ? [this.node(0, 0, 0), this.node(0, 1, 0)] : [this.node(0, 0, 0)];
  }

  setAnisotropy(value: number) { this.anisotropy = value; }

  private source(z: number) {
    let pick: TileSource | null = null;
    for (const s of this.options.sources) if (z >= s.minLevel && z <= s.maxLevel) pick = s;
    return pick;
  }

  private node(z: number, x: number, y: number): Node {
    const key = `${z}/${x}/${y}`;
    const known = this.nodes.get(key);
    if (known) return known;
    let latS: number, latN: number, lon0: number, lon1: number;
    if (this.options.scheme === "geographic") {
      const span = 180 / 2 ** z;
      lon0 = -180 + x * span; lon1 = lon0 + span;
      latN = 90 - y * span; latS = latN - span;
    } else {
      const n = 2 ** z;
      lon0 = -180 + (x * 360) / n; lon1 = -180 + ((x + 1) * 360) / n;
      latN = mercLat(y / n); latS = mercLat((y + 1) / n);
    }
    const mid = direction((latS + latN) / 2, (lon0 + lon1) / 2);
    const corners = [direction(latS, lon0), direction(latS, lon1), direction(latN, lon0), direction(latN, lon1), direction(latN, (lon0 + lon1) / 2), direction(latS, (lon0 + lon1) / 2)];
    const radius = Math.max(...corners.map((c) => c.distanceTo(mid)));
    const node: Node = {
      z, x, y, key, latS, latN, lon0, lon1, center: new THREE.Sphere(mid, radius),
      children: null, state: "idle", mesh: null, lastUsed: 0,
    };
    this.nodes.set(key, node);
    return node;
  }

  private childrenOf(node: Node) {
    if (!node.children) {
      const { z, x, y } = node;
      node.children = [
        this.node(z + 1, 2 * x, 2 * y), this.node(z + 1, 2 * x + 1, 2 * y),
        this.node(z + 1, 2 * x, 2 * y + 1), this.node(z + 1, 2 * x + 1, 2 * y + 1),
      ];
    }
    return node.children;
  }

  /** Malla del mosaico: rejilla en el espacio de la proyección, así la UV es lineal. */
  private geometry(node: Node) {
    const spanDeg = Math.max(node.latN - node.latS, node.lon1 - node.lon0);
    const seg = THREE.MathUtils.clamp(Math.ceil(spanDeg / 3.75), 2, 64);
    const position: number[] = [];
    const uv: number[] = [];
    const n = 2 ** node.z;
    for (let i = 0; i <= seg; i++) {
      const lat = this.options.scheme === "geographic"
        ? node.latN - ((node.latN - node.latS) * i) / seg
        : mercLat((node.y + i / seg) / n);
      for (let j = 0; j <= seg; j++) {
        const lon = node.lon0 + ((node.lon1 - node.lon0) * j) / seg;
        const v = direction(lat, lon);
        position.push(v.x, v.y, v.z);
        uv.push(j / seg, 1 - i / seg);
      }
    }
    const index: number[] = [];
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j;           // noroeste
        const b = a + 1;                       // noreste
        const c = a + seg + 1;                 // suroeste
        index.push(a, c, b, b, c, c + 1);      // sentido antihorario visto desde fuera
      }
    }
    const geometry = new THREE.BufferGeometry();
    const pos = new THREE.Float32BufferAttribute(position, 3);
    geometry.setAttribute("position", pos);
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(index);
    geometry.boundingSphere = node.center.clone();
    return geometry;
  }

  private load(node: Node) {
    const source = this.source(node.z);
    if (!source) { node.state = "error"; return; }
    node.state = "loading";
    this.inFlight++;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    const done = () => { this.inFlight--; this.options.onLoad(); };
    image.onload = () => {
      // El servidor de CTX entrega algunos PNG cortados: el navegador los decodifica a medias y los pinta en un
      // canvas 2D, pero WebGL los sube como negro transparente. Pasar por un canvas conserva la parte buena.
      let pixels: HTMLImageElement | HTMLCanvasElement = image;
      if (source.transparent) {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d")?.drawImage(image, 0, 0);
        pixels = canvas;
      }
      const texture = new THREE.Texture(pixels);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.anisotropy;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;
      const material = new THREE.MeshStandardMaterial({
        map: texture, roughness: 1, depthTest: false, depthWrite: false,
        transparent: !!source.transparent, side: THREE.FrontSide,
      });
      // El tinte se mide sobre valores de píxel (sRGB); se convierte al espacio lineal del shader.
      if (source.tint) material.color.setRGB(...source.tint, THREE.SRGBColorSpace);
      const mesh = new THREE.Mesh(this.geometry(node), material);
      mesh.renderOrder = RENDER_ORDER + node.z;
      mesh.frustumCulled = false;
      mesh.visible = false;
      node.mesh = mesh;
      node.state = "ready";
      this.group.add(mesh);
      done();
    };
    image.onerror = () => { node.state = "error"; done(); };
    image.src = source.url(node.z, node.x, node.y);
  }


  private dispose(node: Node) {
    if (!node.mesh) return;
    this.group.remove(node.mesh);
    node.mesh.geometry.dispose();
    const material = node.mesh.material as THREE.MeshStandardMaterial;
    material.map?.dispose();
    material.dispose();
    node.mesh = null;
    node.state = "idle";
  }

  /**
   * Elige y muestra los mosaicos para esta cámara. viewportHeight en píxeles del dispositivo.
   * Llamar justo antes de dibujar el globo.
   */
  update(camera: THREE.PerspectiveCamera, viewportHeight: number) {
    this.frame++;
    camera.updateMatrixWorld();
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    const cam = camera.position;
    const camLen = cam.length();
    const camLat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(cam.y / camLen, -1, 1)));
    const camLon = THREE.MathUtils.radToDeg(Math.atan2(-cam.z, cam.x));
    const pxPerRad = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const closest = new THREE.Vector3();
    const toCam = new THREE.Vector3();

    const leaves: { node: Node; distance: number }[] = [];
    const visit = (node: Node) => {
      // Punto del mosaico más cercano a la cámara (en ángulo).
      const lat = THREE.MathUtils.clamp(camLat, node.latS, node.latN);
      const half = (node.lon1 - node.lon0) / 2;
      const mid = (node.lon0 + node.lon1) / 2;
      const lon = mid + THREE.MathUtils.clamp(wrap180(camLon - mid), -half, half);
      closest.copy(direction(lat, lon));
      toCam.subVectors(cam, closest);
      if (closest.dot(toCam) <= 0) return;                           // tras el horizonte
      if (!this.frustum.intersectsSphere(node.center)) return;        // fuera de la vista
      const distance = toCam.length();
      const source = this.source(node.z);
      const nearEquator = Math.min(Math.abs(node.latS), Math.abs(node.latN));
      const sameSign = node.latS * node.latN > 0;
      const width = THREE.MathUtils.degToRad(node.lon1 - node.lon0) * Math.cos(THREE.MathUtils.degToRad(sameSign ? nearEquator : 0));
      const height = THREE.MathUtils.degToRad(node.latN - node.latS);
      const projected = (Math.max(width, height) / distance) * pxPerRad;
      const split = node.z < this.maxLevel && (!source || projected > source.tileSize * QUALITY);
      if (split) for (const child of this.childrenOf(node)) visit(child);
      else leaves.push({ node, distance });
    };
    for (const root of this.roots) visit(root);

    // Dibujar: cada hoja cargada, o su antecesor cargado más cercano.
    for (const node of this.nodes.values()) if (node.mesh) node.mesh.visible = false;
    const wanted: { node: Node; distance: number }[] = [];
    for (const leaf of leaves) {
      let node = leaf.node;
      node.lastUsed = this.frame;
      if (node.state === "idle") wanted.push(leaf);
      while (node.state !== "ready") {
        const parent = this.parentOf(node);
        if (!parent) break;
        node = parent;
        node.lastUsed = this.frame;
      }
      if (node.mesh) node.mesh.visible = true;
      // Fuente con huecos (CTX: zonas sin órbitas y PNG que el servidor entrega cortados): debajo va siempre
      // el último nivel de la fuente opaca anterior, para que por los huecos se vea color y no la esfera base.
      const source = this.source(leaf.node.z);
      if (source?.transparent && source.minLevel > 0) {
        // Primero los antecesores de la misma fuente ya cargados (mismo tono, menos detalle)…
        for (let up = this.parentOf(node); up && up.z >= source.minLevel; up = this.parentOf(up)) {
          up.lastUsed = this.frame;
          if (up.mesh) up.mesh.visible = true;
        }
        const parent = this.parentOf(leaf.node);
        if (parent && parent.z >= source.minLevel && parent.state === "idle") wanted.push({ node: parent, distance: leaf.distance });
        // …y debajo de todo, la fuente opaca anterior.
        const base = this.ancestorAt(leaf.node, source.minLevel - 1);
        if (base) {
          base.lastUsed = this.frame;
          if (base.state === "idle") wanted.push({ node: base, distance: leaf.distance });
          if (base.mesh) base.mesh.visible = true;
        }
      }
    }

    // Los dos primeros niveles siempre, para tener algo que enseñar mientras llega el detalle.
    const base = this.options.scheme === "geographic" ? 1 : 2;
    const preload: Node[] = [];
    const collect = (node: Node) => {
      node.lastUsed = Math.max(node.lastUsed, this.frame);
      if (node.state === "idle") preload.push(node);
      if (node.z < base) for (const c of this.childrenOf(node)) collect(c);
    };
    for (const root of this.roots) collect(root);

    const queue = [...preload.map((node) => ({ node, distance: 0 })), ...wanted]
      .sort((a, b) => a.node.z - b.node.z || a.distance - b.distance);
    for (const { node } of queue) {
      if (this.inFlight >= MAX_IN_FLIGHT) break;
      if (node.state !== "idle") continue;
      this.load(node);
    }

    this.evict();
    return this.inFlight > 0;
  }

  private ancestorAt(node: Node, level: number): Node | null {
    let current: Node | null = node;
    while (current && current.z > level) current = this.parentOf(current);
    return current && current.z === level ? current : null;
  }

  private parentOf(node: Node): Node | null {
    if (node.z === 0) return null;
    return this.nodes.get(`${node.z - 1}/${node.x >> 1}/${node.y >> 1}`) ?? null;
  }

  private evict() {
    const ready = [...this.nodes.values()].filter((n) => n.state === "ready");
    if (ready.length <= MAX_CACHED) return;
    ready.sort((a, b) => a.lastUsed - b.lastUsed);
    for (const node of ready.slice(0, ready.length - MAX_CACHED)) {
      if (node.lastUsed === this.frame) break;
      this.dispose(node);
    }
  }
}
