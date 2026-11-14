import catalog from "./data/catalog.json";
import { t } from "./i18n";

type Metrics = { medianSlope: number; steepSlope: number; medianElevation: number; relief: number };
export type Cover = {
  bare: number; snow_ice: number; moss_lichen: number; vegetation: number; water: number; built: number;
  assumed?: boolean;
};
export type Climate = { t_mean: number; t_min: number; t_max: number; diurnal_range: number; precip_year: number };
type ClimateParts = { cold: number; dry: number; swing: number };
export type Site = {
  id: string;
  name: string;
  planet: string;
  category: string;
  latitude: number;
  longitude: number;
  source: string;
  sourceUrl: string;
  raster?: string;
  groups?: string[];
  metrics: Metrics;
  /** Solo Tierra: "curated" = sitio elegido a mano (USGS 3DEP), "global" = hallado por el escaneo mundial. */
  origin?: "curated" | "global";
  cover?: Cover | null;
  climate?: Climate | null;
  climateParts?: ClimateParts | null;
  knownAnalog?: string | null;
};

export const sites = catalog as Site[];
export const gridSize = 100;
export const cellSize = 20;
export const patchWidth = gridSize * cellSize;
export type Terrain = Site & { elevation: Float32Array };

export function cellSlopes(elevation: Float32Array) {
  return elevation.map((_, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const west = Math.max(0, col - 1);
    const east = Math.min(gridSize - 1, col + 1);
    const north = Math.max(0, row - 1);
    const south = Math.min(gridSize - 1, row + 1);
    const dx = (elevation[row * gridSize + east] - elevation[row * gridSize + west]) /
      ((east - west) * cellSize);
    const dz = (elevation[south * gridSize + col] - elevation[north * gridSize + col]) /
      ((south - north) * cellSize);
    return Math.atan(Math.hypot(dx, dz)) * 180 / Math.PI;
  });
}

/** `label` es una clave de i18n.ts (metric.*). */
export const metricDefinitions = [
  { key: "medianSlope", label: "metric.medianSlope", unit: "°" },
  { key: "steepSlope", label: "metric.steepSlope", unit: "°" },
  { key: "relief", label: "metric.relief", unit: " m" },
] as const;

/** Nombre traducido de las categorías de terreno de Marte (las claves del catálogo siguen en inglés; ver cat.* en i18n.ts). */
export const categoryLabel = (category: string) => {
  const label = t(`cat.${category}`);
  return label === `cat.${category}` ? category : label;
};

// Mismos pesos y fórmulas que pipeline/analogs/patches.py: mantenlos sincronizados.
export const weights = { terrain: 0.5, surface: 0.25, climate: 0.25 } as const;
const climateWeights = { cold: 0.35, dry: 0.35, swing: 0.3 } as const;
const iceCategory = "Ice & polar terrain";

/** Condiciones típicas en la superficie de Marte, junto al clima terrestre como referencia. */
export const marsClimate = { t_mean: -63, diurnal_range: 70, precip_year: 0 };

export function terrainDistance(target: Site, site: Site) {
  return metricDefinitions.reduce((sum, { key }) => {
    const total = target.metrics[key] + site.metrics[key];
    return sum + (total === 0 ? 0 : Math.abs(target.metrics[key] - site.metrics[key]) / total);
  }, 0) / metricDefinitions.length;
}

export function surfaceScore(cover: Cover | null | undefined, category: string) {
  if (!cover) return 0;
  const [main, other] = category === iceCategory ? [cover.snow_ice, cover.bare] : [cover.bare, cover.snow_ice];
  return Math.min(1, main + 0.6 * other + 0.3 * cover.moss_lichen);
}

export function climateScore(parts: ClimateParts | null | undefined) {
  if (!parts) return 0;
  return climateWeights.cold * parts.cold + climateWeights.dry * parts.dry + climateWeights.swing * parts.swing;
}

export type Match = { site: Site; distance: number; terrain: number; surface: number; climate: number; total: number };

/**
 * Los sitios curados solo compiten dentro de la categoría de terreno del sitio de Marte (asignada a mano);
 * los del escaneo mundial compiten solo por sus medidas.
 */
export function rankEarthSites(target: Site): Match[] {
  return sites.filter((site) => site.planet === "Earth" &&
    (site.origin === "global" || site.groups?.includes(target.category))).map((site) => {
    const distance = terrainDistance(target, site);
    const terrain = 1 - distance;
    const surface = surfaceScore(site.cover, target.category);
    const climate = climateScore(site.climateParts);
    const total = weights.terrain * terrain + weights.surface * surface + weights.climate * climate;
    return { site, distance, terrain, surface, climate, total };
  }).sort((a, b) => b.total - a.total);
}

export async function loadTerrain(site: Site, signal: AbortSignal): Promise<Terrain> {
  const response = await fetch(`${import.meta.env.BASE_URL}terrain/${site.id}.f32`, { signal });
  if (!response.ok) throw new Error(`No se pudo cargar el terreno de ${site.name}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== gridSize * gridSize * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error(`Tamaño de terreno no válido para ${site.name}`);
  }
  const view = new DataView(bytes);
  const elevation = Float32Array.from({ length: gridSize * gridSize }, (_, index) =>
    view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true),
  );
  if (!elevation.every(Number.isFinite)) throw new Error(`Celdas de terreno no válidas para ${site.name}`);
  return { ...site, elevation };
}
