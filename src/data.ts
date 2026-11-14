import catalog from "./data/catalog.json";

type Metrics = { medianSlope: number; steepSlope: number; medianElevation: number; relief: number };
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
};

export const sites: Site[] = catalog;
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

export const metricDefinitions = [
  { key: "medianSlope", label: "Median slope", unit: "°" },
  { key: "steepSlope", label: "90th percentile slope", unit: "°" },
  { key: "relief", label: "Elevation span (5th–95th percentile)", unit: " m" },
] as const;

export function rankEarthSites(target: Site) {
  return sites.filter((site) => site.planet === "Earth" && site.groups?.includes(target.category)).map((site) => {
    const distance = metricDefinitions.reduce((sum, { key }) => {
      const total = target.metrics[key] + site.metrics[key];
      return sum + (total === 0 ? 0 : Math.abs(target.metrics[key] - site.metrics[key]) / total);
    }, 0) / metricDefinitions.length;
    return { site, distance };
  }).sort((a, b) => a.distance - b.distance);
}

export async function loadTerrain(site: Site, signal: AbortSignal): Promise<Terrain> {
  const response = await fetch(`${import.meta.env.BASE_URL}terrain/${site.id}.f32`, { signal });
  if (!response.ok) throw new Error(`Could not load terrain for ${site.name}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== gridSize * gridSize * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error(`Invalid terrain size for ${site.name}`);
  }
  const view = new DataView(bytes);
  const elevation = Float32Array.from({ length: gridSize * gridSize }, (_, index) =>
    view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true),
  );
  if (!elevation.every(Number.isFinite)) throw new Error(`Invalid terrain cells for ${site.name}`);
  return { ...site, elevation };
}
