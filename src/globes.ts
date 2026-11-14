import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Site } from "./data";

// SphereGeometry starts at the antimeridian; east longitude increases toward -Z.
function direction({ latitude, longitude }: Site) {
  const lat = THREE.MathUtils.degToRad(latitude);
  const lon = THREE.MathUtils.degToRad(longitude);
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
}

export function createGlobes(canvas: HTMLCanvasElement, target: Site, markers: { site: Site; button: HTMLButtonElement }[], earthPin: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const loader = new THREE.TextureLoader();
  const size = new THREE.Vector2();
  const point = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const lightOffset = new THREE.Vector3(-2, 2, 1);

  function globe(name: string, color: number) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 20);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 72, 48), material));
    const light = new THREE.DirectionalLight(0xfff3e7, 1.35);
    const fill = new THREE.AmbientLight(0xffffff, 1.05);
    scene.add(light, fill);
    loader.load(`${import.meta.env.BASE_URL}imagery/${name}.jpg`, (map) => {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      material.color.set(0xffffff);
      material.map = map;
      material.needsUpdate = true;
      render();
    });
    return { scene, camera, light };
  }

  const mars = globe("mars", 0xb76845);
  const earth = globe("earth", 0x315b79);
  let selected = target.id;
  const marsPoints = markers.map(({ site, button }) => ({ site, button, vector: direction(site) }));
  mars.camera.position.copy(direction(target)).multiplyScalar(4.65);
  const controls = new OrbitControls(mars.camera, document.querySelector<HTMLElement>("#mars-drag")!);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.rotateSpeed = 0.55;
  controls.update();

  const earthDirection = new THREE.Vector3(-0.62, 0.24, 0.76).normalize();
  earth.camera.position.copy(earthDirection).multiplyScalar(4.65);
  earth.camera.lookAt(0, 0, 0);

  let earthPoint: THREE.Vector3 | undefined;
  let animation = 0;
  let active = true;
  function pin(element: HTMLElement, vector: THREE.Vector3 | undefined, camera: THREE.PerspectiveCamera, x: number, width: number, height: number) {
    if (!vector || vector.dot(forward.copy(camera.position).normalize()) <= 1 / camera.position.length()) {
      element.hidden = true;
      return;
    }
    point.copy(vector).multiplyScalar(1.005).project(camera);
    element.hidden = false;
    element.style.left = `${x + (point.x + 1) * width / 2}px`;
    element.style.top = `${(1 - point.y) * height / 2}px`;
  }

  function render() {
    if (!active) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.getSize(size);
    if (size.x !== width || size.y !== height) renderer.setSize(width, height, false);
    const panelWidth = Math.floor(width / 2);
    renderer.setScissorTest(true);

    for (const [index, { scene, camera, light }] of [mars, earth].entries()) {
      const x = index * panelWidth;
      camera.aspect = panelWidth / height;
      // Keep the full sphere in view on narrow screens.
      camera.fov = camera.aspect < 1
        ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18)) / camera.aspect))
        : 36;
      camera.updateProjectionMatrix();
      light.position.copy(camera.position).add(lightOffset);
      renderer.setViewport(x, 0, panelWidth, height);
      renderer.setScissor(x, 0, panelWidth, height);
      renderer.render(scene, camera);
    }

    const occupied: { x: number; y: number }[] = [];
    const prioritized = [...marsPoints].sort((a, b) => Number(b.site.id === selected) - Number(a.site.id === selected));
    for (const { site, button, vector } of prioritized) {
      pin(button, vector, mars.camera, 0, panelWidth, height);
      if (button.hidden) continue;
      const x = Number.parseFloat(button.style.left);
      const y = Number.parseFloat(button.style.top);
      const minSpacing = panelWidth < 300 ? 20 : 25;
      button.hidden = site.id !== selected && occupied.some((p) => Math.hypot(x - p.x, y - p.y) < minSpacing);
      if (!button.hidden) occupied.push({ x, y });
    }
    pin(earthPin, earthPoint, earth.camera, panelWidth, panelWidth, height);
  }

  function selectMars(site: Site) {
    selected = site.id;
    mars.camera.position.copy(direction(site)).multiplyScalar(4.65);
    controls.update();
    render();
  }

  function flyTo(site: Site) {
    if (!active) return;
    earthPoint = direction(site);
    cancelAnimationFrame(animation);
    const from = earthDirection.clone();
    const startDistance = earth.camera.position.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(from, earthPoint);
    const step = new THREE.Quaternion();
    const start = performance.now();
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 820;

    function frame(now: number) {
      const t = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      step.identity().slerp(rotation, t * t * (3 - 2 * t));
      earthDirection.copy(from).applyQuaternion(step);
      const distance = THREE.MathUtils.lerp(startDistance, 4.35, t);
      earth.camera.position.copy(earthDirection).multiplyScalar(distance);
      earth.camera.lookAt(0, 0, 0);
      render();
      if (t < 1) animation = requestAnimationFrame(frame);
    }

    animation = requestAnimationFrame(frame);
  }

  canvas.addEventListener("webglcontextlost", () => {
    active = false;
    cancelAnimationFrame(animation);
    for (const { button } of markers) button.hidden = true;
    earthPin.hidden = true;
  });
  controls.addEventListener("change", render);
  new ResizeObserver(render).observe(canvas);
  render();
  return { flyTo, selectMars };
}
