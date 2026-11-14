import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { cellSize, gridSize, patchWidth } from "./data";

/**
 * Terreno que se dibuja: una cuadrícula cuadrada de alturas en metros (fila 0 = norte). Por defecto, la de los
 * parches HiRISE del catálogo (100 × 100 celdas de 20 m); las ventanas L0 de la Luna y Marte traen n y cell propios
 * (100 × 100 celdas de 300 m = 30 km). Todas se escalan a la misma anchura en pantalla con escala vertical real.
 */
export type ViewerSite = {
  id: string;
  elevation: Float32Array;
  n?: number;
  cell?: number;
  metrics: { medianElevation: number; relief: number };
};
/** Anchura en unidades de escena a la que se dibuja cualquier terreno (la de un parche HiRISE de 2 km). */
const SCENE_WIDTH = patchWidth;

/** Pendiente en grados de cada celda (diferencias centradas, como cellSlopes de data.ts, con tamaño variable). */
export function gridSlopes(elevation: Float32Array, n: number, cell: number) {
  return elevation.map((_, index) => {
    const row = Math.floor(index / n);
    const col = index % n;
    const west = Math.max(0, col - 1);
    const east = Math.min(n - 1, col + 1);
    const north = Math.max(0, row - 1);
    const south = Math.min(n - 1, row + 1);
    const dx = (elevation[row * n + east] - elevation[row * n + west]) / ((east - west) * cell);
    const dz = (elevation[south * n + col] - elevation[north * n + col]) / ((south - north) * cell);
    return Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
  });
}

export type Mode = "relief" | "slope";

export const slopeBands = [
  { upper: 3, label: "0–3°", color: "#d8d4c6" },
  { upper: 6, label: "3–6°", color: "#d1ae80" },
  { upper: 10, label: "6–10°", color: "#bf7851" },
  { upper: Infinity, label: "10°+", color: "#a14431" },
];

export function createViewer(canvas: HTMLCanvasElement, sites: ViewerSite[]) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 14000);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minZoom = 0.65;
  controls.maxZoom = 4;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.zoomSpeed = 0.65;
  const defaultPosition = new THREE.Vector3(2650, 2450, 3550);

  function makeTerrain(site: ViewerSite) {
    const metrics = site.metrics;
    const n = site.n ?? gridSize;
    const cell = site.cell ?? cellSize;
    // Metros → unidades de escena; la misma escala en horizontal y en vertical (escala vertical real).
    const scale = SCENE_WIDTH / (n * cell);
    const slope = gridSlopes(site.elevation, n, cell);
    const side = (n - 1) * cell * scale;
    const geometry = new THREE.PlaneGeometry(side, side, n - 1, n - 1);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, (site.elevation[i] - metrics.medianElevation) * scale);
    }
    geometry.computeVertexNormals();

    const colors = new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3);
    geometry.setAttribute("color", colors);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
    }));

    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(0xfff2df, 2.25);
    sun.position.set(-1600, 1850, -950);
    const fill = new THREE.HemisphereLight(0xeeeef2, 0x5a5148, 1.8);
    const grid = new THREE.GridHelper(2800, 14, 0x444346, 0x333236);
    grid.position.y = (Math.min(...site.elevation) - metrics.medianElevation) * scale - 35;
    scene.add(mesh, grid, sun, fill);
    // Rango del color de relieve: ±105 m en los parches de 2 km; en ventanas con más desnivel, la mitad del desnivel.
    const reliefHalf = Math.max(105, metrics.relief / 2);
    return { scene, colors, metrics, slope, mesh, grid, site, reliefHalf };
  }

  const terrain = sites.map(makeTerrain);
  let mode: Mode = "slope";

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;

    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
    renderer.setScissorTest(true);
    const panelWidth = Math.floor(width / terrain.length);
    const aspect = panelWidth / height;
    const halfWidth = 1500 * Math.max(1, aspect * 0.8);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfWidth / aspect;
    camera.bottom = -halfWidth / aspect;
    camera.updateProjectionMatrix();

    terrain.forEach(({ scene }, index) => {
      const x = index * panelWidth;
      renderer.setViewport(x, 0, panelWidth, height);
      renderer.setScissor(x, 0, panelWidth, height);
      renderer.render(scene, camera);
    });
  }

  function setMode(nextMode: Mode) {
    mode = nextMode;
    const bandColors = slopeBands.map((band) => new THREE.Color(band.color));
    const low = new THREE.Color("#7d766b");
    const high = new THREE.Color("#e1dbcc");
    const reliefColor = new THREE.Color();
    terrain.forEach(({ colors, metrics, slope, site, reliefHalf }) => {
      const { elevation } = site;
      for (let i = 0; i < colors.count; i++) {
        const band = slopeBands.findIndex((item) => slope[i] < item.upper);
        const height = elevation[i] - metrics.medianElevation;
        const color = mode === "slope"
          ? bandColors[band]
          : reliefColor.copy(low).lerp(high, THREE.MathUtils.clamp((height + reliefHalf) / (2 * reliefHalf), 0, 1));
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
    });
    render();
  }

  function setView(view: "top" | "oblique") {
    camera.position.copy(view === "top" ? new THREE.Vector3(0, 4900, 1) : defaultPosition);
    camera.zoom = 1;
    controls.update();
    render();
  }

  canvas.addEventListener("keydown", (event) => {
    const offset = new THREE.Spherical().setFromVector3(camera.position);
    switch (event.key) {
      case "ArrowLeft": offset.theta -= 0.14; break;
      case "ArrowRight": offset.theta += 0.14; break;
      case "ArrowUp": offset.phi -= 0.1; break;
      case "ArrowDown": offset.phi += 0.1; break;
      case "+": case "=": camera.zoom *= 1.15; break;
      case "-": camera.zoom /= 1.15; break;
      default: return;
    }
    event.preventDefault();
    camera.zoom = THREE.MathUtils.clamp(camera.zoom, controls.minZoom, controls.maxZoom);
    offset.phi = THREE.MathUtils.clamp(offset.phi, 0.001, controls.maxPolarAngle);
    camera.position.setFromSpherical(offset);
    controls.update();
    render();
  });

  setView("oblique");
  setMode("slope");
  controls.addEventListener("change", render);
  new ResizeObserver(render).observe(canvas);
  function setSites(pair: ViewerSite[]) {
    for (const [index, site] of pair.entries()) {
      const old = terrain[index];
      if (old.site.id === site.id) continue;
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
      old.grid.geometry.dispose();
      old.grid.material.dispose();
      terrain[index] = makeTerrain(site);
    }
    setMode(mode);
  }

  return { setMode, setView, setSites };
}
