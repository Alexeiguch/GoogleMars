import { cellSize, gridSize, loadTerrain, sites, type Site } from "./data";
import regionalEarthIds from "./data/path-earth.json";
import {
  EARTH_RADIUS_KM, MARS_RADIUS_KM, resampleRoute, routeDistanceKm, type RoutePoint, type RouteSample,
} from "./pathRoute";

export type TerrainSample = RouteSample & { elevationM: number; slopeDeg: number };
export type TerrainProfile = {
  points: readonly RoutePoint[];
  samples: TerrainSample[];
  distanceKm: number;
  ascentM: number;
  descentM: number;
  maxSlopeDeg: number;
  resolutionM: number;
  sampleSpacingM: number;
  source: string;
  sourceUrl: string;
};
export type EarthRouteMatch = { site: Site; profile: TerrainProfile; score: number };
export type PathTerrainResult = { mars: TerrainProfile; matches: EarthRouteMatch[]; sitesSearched: number };
type ErrorCode = "coverage" | "earthData" | "distance" | "route" | "noMatch";

export class PathTerrainError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = "PathTerrainError";
  }
}

export const MIN_PLANNER_DISTANCE_KM = 0.1;
export const MAX_PLANNER_DISTANCE_KM = 200;

export function plannerDistanceRange(distanceKm: number) {
  // Great-circle calculations can land just outside an exact endpoint due to floating-point rounding.
  const toleranceKm = 1e-9;
  if (distanceKm < MIN_PLANNER_DISTANCE_KM - toleranceKm) return "short";
  if (distanceKm > MAX_PLANNER_DISTANCE_KM + toleranceKm) return "long";
  return "ready";
}

export const marsRouteSites = sites.filter((site) => site.planet === "Mars");

const regionalIds = new Set(regionalEarthIds);
const earthSites = sites.filter((site) => site.planet === "Earth" && (site.cover?.water ?? 0) < 0.1);
const regionalEarthSites = sites.filter((site) => regionalIds.has(site.id));
const radians = Math.PI / 180;
const marsRadiusM = MARS_RADIUS_KM * 1000;
const earthRadiusM = EARTH_RADIUS_KM * 1000;
const earthRegionSource = { source: "Mapzen Terrain Tiles", sourceUrl: "https://registry.opendata.aws/terrain-tiles/" };
const noData = -32768;
const searchConcurrency = 12;
const maxProfileSamples = 241;
const earthRegionSizes = [{ size: 256, resolutionM: 1000 }, { size: 160, resolutionM: 250 }] as const;
const scales = [1, 0.85, 1.15];
const directions = Array.from({ length: 16 }, (_, index) => index * 2 * Math.PI / 16);
const offsets = [0.5, 0.12, 0.88];

type ElevationGrid = Float32Array | Int16Array;
type XY = { east: number; north: number };
type TerrainSource = Pick<TerrainProfile, "source" | "sourceUrl" | "resolutionM">;
type ElevationSource = TerrainSource & { sample: (point: RoutePoint) => number };
type EarthGrid = TerrainSource & { values: ElevationGrid; size: number; landMask?: true };

function plane(center: RoutePoint, radiusM: number) {
  const phi0 = center.lat * radians;
  const sinPhi0 = Math.sin(phi0);
  const cosPhi0 = Math.cos(phi0);
  return {
    project(point: RoutePoint): XY {
      const phi = point.lat * radians;
      const dLon = (point.lon - center.lon) * radians;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const east = cosPhi * Math.sin(dLon);
      const north = cosPhi0 * sinPhi - sinPhi0 * cosPhi * Math.cos(dLon);
      const sinAngular = Math.hypot(east, north);
      const angular = Math.atan2(sinAngular, sinPhi0 * sinPhi + cosPhi0 * cosPhi * Math.cos(dLon));
      const scale = sinAngular > 1e-15 ? radiusM * angular / sinAngular : radiusM;
      return { east: east * scale, north: north * scale };
    },
    unproject({ east, north }: XY): RoutePoint {
      const rho = Math.hypot(east, north);
      if (!rho) return { ...center };
      const c = rho / radiusM;
      const sinC = Math.sin(c);
      const cosC = Math.cos(c);
      const lat = Math.asin(Math.max(-1, Math.min(1, cosC * sinPhi0 + north * sinC * cosPhi0 / rho))) / radians;
      const dLon = Math.atan2(east * sinC, rho * cosPhi0 * cosC - north * sinPhi0 * sinC);
      return { lat, lon: ((center.lon + dLon / radians + 540) % 360) - 180 };
    },
  };
}

function bounds(points: readonly XY[]) {
  let west = Infinity, east = -Infinity, north = -Infinity, south = Infinity;
  for (const point of points) {
    west = Math.min(west, point.east);
    east = Math.max(east, point.east);
    south = Math.min(south, point.north);
    north = Math.max(north, point.north);
  }
  return { west, east, south, north };
}

function gridElevation(values: ElevationGrid, width: number, height: number, col: number, row: number, wrap = false) {
  if (row < -0.5 || row > height - 0.5 || (!wrap && (col < -0.5 || col > width - 0.5))) return NaN;
  col = wrap ? (col + width) % width : Math.max(0, Math.min(width - 1, col));
  row = Math.max(0, Math.min(height - 1, row));
  const x = Math.floor(col), y = Math.floor(row);
  const dx = col - x, dy = row - y;
  const right = wrap ? (x + 1) % width : Math.min(width - 1, x + 1);
  const bottom = Math.min(height - 1, y + 1);
  const a = values[y * width + x], b = values[y * width + right];
  const c = values[bottom * width + x], d = values[bottom * width + right];
  if (a === noData || b === noData || c === noData || d === noData) return NaN;
  return a + dx * (b - a) + dy * (c - a + dx * (d - c - b + a));
}

function localElevation(grid: EarthGrid, east: number, north: number) {
  const center = (grid.size - 1) / 2;
  return gridElevation(grid.values, grid.size, grid.size, center + east / grid.resolutionM, center - north / grid.resolutionM);
}

async function loadArchive(name: string, signal: AbortSignal) {
  const response = await fetch(`${import.meta.env.BASE_URL}terrain/${name}.i16.gz`, { signal });
  if (!response.ok) throw new Error(`Unable to read ${name}`);
  let bytes = await response.arrayBuffer();
  const prefix = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
  // Some hosts serve .gz as a compressed transfer and fetch has already decoded it.
  if (prefix[0] === 0x1f && prefix[1] === 0x8b) {
    bytes = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  }
  signal.throwIfAborted();
  return new DataView(bytes);
}

function decodeGrid(data: DataView, start: number, width: number, height: number) {
  const values = new Int16Array(width * height);
  for (let row = 0; row < height; row++) {
    const base = row * width;
    let previous = 0;
    for (let col = 0; col < width; col++) {
      const index = base + col;
      values[index] = previous + data.getInt16(start + index * 2, true);
      previous = values[index];
    }
  }
  return values;
}

const globalMars = { file: "path-mars-mola-8ppd", width: 2880, height: 1440, west: 0, north: 90,
  step: 0.125, resolutionM: 7400, source: "MOLA · NASA PDS",
  sourceUrl: "https://pds-geosciences.wustl.edu/missions/mgs/megdr.html", wrap: true };
const regionalMars = { file: "path-mars-jezero", width: 564, height: 535, west: 76.4972914244982,
  north: 19.302046235579127, step: 0.003374120830641, resolutionM: 500, source: "HRSC + MOLA · USGS",
  sourceUrl: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_mex_hrsc_blended_dem_global_200m", wrap: false };
const usgsGlobal = {
  // This published version is a little-endian BigTIFF with uncompressed, contiguous 16-bit rows.
  url: "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif",
  dataStart: 854272, width: 106694, height: 53347, step: regionalMars.step,
  resolutionM: regionalMars.resolutionM, source: regionalMars.source, sourceUrl: regionalMars.sourceUrl,
};
const marsArchives = new Map<string, Int16Array>();
const usgsCells = new Map<number, number>();

async function sphericalSource(config: typeof globalMars, signal: AbortSignal): Promise<ElevationSource> {
  let values = marsArchives.get(config.file);
  if (!values) {
    const data = await loadArchive(config.file, signal);
    if (data.byteLength !== config.width * config.height * 2) throw new Error(`Invalid grid ${config.file}`);
    values = decodeGrid(data, 0, config.width, config.height);
    marsArchives.set(config.file, values);
  }
  return {
    resolutionM: config.resolutionM,
    source: config.source,
    sourceUrl: config.sourceUrl,
    sample(point) {
      const lon = config.wrap ? (point.lon + 360) % 360 : point.lon;
      return gridElevation(values, config.width, config.height,
        (lon - config.west) / config.step - 0.5, (config.north - point.lat) / config.step - 0.5, config.wrap);
    },
  };
}

function sampleCount(distanceKm: number, spacingM: number) {
  return Math.min(maxProfileSamples, 1 + Math.max(1, Math.floor(distanceKm * 1000 / spacingM)));
}

function usgsCell({ lat, lon }: RoutePoint) {
  const { width, height, step } = usgsGlobal;
  const col = ((lon + 180) / step - 0.5 + width) % width;
  const row = Math.max(0, Math.min(height - 1, (90 - lat) / step - 0.5));
  const left = Math.floor(col), top = Math.floor(row);
  return { left, top, right: (left + 1) % width, bottom: Math.min(height - 1, top + 1), dx: col - left, dy: row - top };
}

async function usgsElevation(points: readonly RoutePoint[], distanceKm: number, spacingM: number,
  signal: AbortSignal): Promise<ElevationSource | undefined> {
  if (distanceKm > 5 || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const samples = resampleRoute(points, MARS_RADIUS_KM, sampleCount(distanceKm, Math.max(usgsGlobal.resolutionM, spacingM)));
  const wanted = new Set<number>();
  const { width, dataStart } = usgsGlobal;
  for (const point of samples) {
    const { left, top, right, bottom } = usgsCell(point);
    for (const row of [top, bottom]) {
      wanted.add(row * width + left);
      wanted.add(row * width + right);
    }
  }
  const missing = [...wanted].filter((index) => !usgsCells.has(index)).sort((a, b) => a - b);
  const mergeRanges = (maxGap: number) => {
    const ranges: { first: number; last: number }[] = [];
    for (const index of missing) {
      const previous = ranges.at(-1);
      if (previous && index - previous.last <= maxGap) previous.last = index;
      else ranges.push({ first: index, last: index });
    }
    return ranges;
  };
  // For many requests, trade at most 4 MiB for fewer requests. Rows are contiguous.
  const sparse = mergeRanges(8);
  const ranges = sparse.length <= 8 ? sparse : mergeRanges(width * 3);
  if (ranges.reduce((bytes, { first, last }) => bytes + (last - first + 1) * 2, 0) > 4 * 1024 * 1024) return;

  const pending = new AbortController();
  const limit = AbortSignal.any([signal, pending.signal, AbortSignal.timeout(2400)]);
  const values = new Map<number, number>();
  for (const index of wanted) {
    const cached = usgsCells.get(index);
    if (cached !== undefined) values.set(index, cached);
  }
  try {
    await Promise.all(ranges.map(async ({ first, last }) => {
      const start = dataStart + first * 2;
      const length = (last - first + 1) * 2;
      const response = await fetch(usgsGlobal.url, { headers: { Range: `bytes=${start}-${start + length - 1}` }, signal: limit });
      const contentLength = response.headers.get("Content-Length");
      const contentRange = response.headers.get("Content-Range");
      if (response.status !== 206 || (contentLength !== null && Number(contentLength) !== length) ||
        (contentRange !== null && !contentRange.startsWith(`bytes ${start}-${start + length - 1}/`))) {
        await response.body?.cancel();
        throw new Error("USGS byte range unavailable");
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== length) throw new Error("Invalid USGS elevation byte range");
      const data = new DataView(bytes);
      for (const index of wanted) {
        if (index >= first && index <= last) values.set(index, data.getInt16((index - first) * 2, true));
      }
    }));
  } catch {
    pending.abort();
    signal.throwIfAborted();
    return;
  }
  const source: ElevationSource = {
    source: usgsGlobal.source, sourceUrl: usgsGlobal.sourceUrl, resolutionM: usgsGlobal.resolutionM,
    sample(point) {
      const { left, top, right, bottom, dx, dy } = usgsCell(point);
      const a = values.get(top * width + left), b = values.get(top * width + right);
      const c = values.get(bottom * width + left), d = values.get(bottom * width + right);
      if (a === undefined || b === undefined || c === undefined || d === undefined ||
        a === noData || b === noData || c === noData || d === noData) return NaN;
      return a + dx * (b - a) + dy * (c - a + dx * (d - c - b + a));
    },
  };
  if (samples.every((point) => Number.isFinite(source.sample(point)))) {
    for (const [index, elevation] of values) {
      usgsCells.delete(index);
      usgsCells.set(index, elevation);
    }
    while (usgsCells.size > 4096) usgsCells.delete(usgsCells.keys().next().value!);
    return source;
  }
}

async function marsElevation(points: readonly RoutePoint[], checkSamples: RouteSample[], distanceKm: number,
  spacingM: number, signal: AbortSignal): Promise<ElevationSource> {
  for (const site of marsRouteSites) {
    const projection = plane({ lat: site.latitude, lon: site.longitude }, marsRadiusM);
    const fits = (point: RoutePoint) => {
      const { east, north } = projection.project(point);
      return Math.abs(east) <= gridSize * cellSize / 2 && Math.abs(north) <= gridSize * cellSize / 2;
    };
    if (!fits(points[0]) || !points.every(fits) || !checkSamples.every(fits)) continue;
    try {
      const terrain = await loadTerrain(site, signal);
      const grid = { values: terrain.elevation, size: gridSize, resolutionM: cellSize, source: site.source, sourceUrl: site.sourceUrl };
      return {
        source: site.source, sourceUrl: site.sourceUrl, resolutionM: cellSize,
        sample(point) {
          const { east, north } = projection.project(point);
          return localElevation(grid, east, north);
        },
      };
    } catch {
      signal.throwIfAborted();
    }
  }
  if (points.every(({ lat, lon }) => {
    const col = (lon - regionalMars.west) / regionalMars.step;
    const row = (regionalMars.north - lat) / regionalMars.step;
    return col > 0 && col < regionalMars.width && row > 0 && row < regionalMars.height;
  })) {
    try {
      const source = await sphericalSource(regionalMars, signal);
      if (checkSamples.every((point) => Number.isFinite(source.sample(point)))) return source;
    } catch {
      signal.throwIfAborted();
    }
  }
  const remote = await usgsElevation(points, distanceKm, spacingM, signal);
  if (remote) return remote;
  try {
    return await sphericalSource(globalMars, signal);
  } catch {
    signal.throwIfAborted();
    throw new PathTerrainError("coverage");
  }
}

function profileStats(elevations: readonly number[], distanceKm: number) {
  let ascentM = 0, descentM = 0, maxSlopeDeg = 0;
  const stepM = distanceKm * 1000 / (elevations.length - 1);
  const slopes = elevations.map((elevation, index) => {
    if (index === 0) return 0;
    const change = elevation - elevations[index - 1];
    ascentM += Math.max(0, change);
    descentM += Math.max(0, -change);
    const slope = Math.atan2(change, stepM) / radians;
    maxSlopeDeg = Math.max(maxSlopeDeg, Math.abs(slope));
    return slope;
  });
  slopes[0] = slopes[1];
  return { ascentM, descentM, maxSlopeDeg, slopes };
}

function buildProfile(points: readonly RoutePoint[], coordinates: RouteSample[], elevations: number[],
  { source, sourceUrl, resolutionM }: TerrainSource): TerrainProfile {
  const distanceKm = coordinates.at(-1)!.distanceKm;
  const { slopes, ...stats } = profileStats(elevations, distanceKm);
  return {
    points, distanceKm, ...stats, source, sourceUrl, resolutionM, sampleSpacingM: distanceKm * 1000 / (coordinates.length - 1),
    samples: coordinates.map((point, index) => ({ ...point, elevationM: elevations[index], slopeDeg: slopes[index] })),
  };
}

function similarity(mars: TerrainProfile, earth: number[], distanceKm: number, elevationScale: number, slopeScale: number) {
  const { ascentM, descentM, slopes } = profileStats(earth, distanceKm);
  let relativeElevationError = 0, slopeError = 0;
  for (let index = 1; index < earth.length; index++) {
    const marsSample = mars.samples[index];
    const marsRelative = marsSample.elevationM - mars.samples[0].elevationM;
    relativeElevationError += Math.abs(marsRelative - (earth[index] - earth[0]));
    slopeError += Math.abs(marsSample.slopeDeg - slopes[index]);
  }
  const steps = earth.length - 1;
  const climbError = Math.abs(ascentM - mars.ascentM) + Math.abs(descentM - mars.descentM);
  const distanceFit = Math.min(distanceKm, mars.distanceKm) / Math.max(distanceKm, mars.distanceKm);
  // Compare relative elevation so the Mars areoid and Earth's elevation datum can differ.
  const elevationFit = Math.exp(-(relativeElevationError / steps + climbError * 0.5) / elevationScale);
  const slopeFit = Math.exp(-slopeError / steps / slopeScale);
  return 100 * (0.2 * distanceFit + 0.4 * elevationFit + 0.4 * slopeFit);
}

type Pattern = { points: XY[]; landCheck: XY[]; bounds: ReturnType<typeof bounds>; scale: number; cosine: number; sine: number };
type Candidate = { site: Site; grid: EarthGrid; pattern: Pattern; east: number; north: number; values: number[]; score: number };

function rotate({ east, north }: XY, cosine: number, sine: number, scale: number) {
  return { east: (east * cosine - north * sine) * scale, north: (east * sine + north * cosine) * scale };
}

function patternsFor(points: readonly XY[], samples: readonly XY[], landSamples: readonly XY[]): Pattern[] {
  return directions.flatMap((angle) => {
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const b = bounds(points.map((point) => rotate(point, cosine, sine, 1)));
    return scales.map((scale) => ({
      scale, cosine, sine,
      points: samples.map((point) => rotate(point, cosine, sine, scale)),
      landCheck: landSamples.map((point) => rotate(point, cosine, sine, scale)),
      bounds: { west: b.west * scale, east: b.east * scale, south: b.south * scale, north: b.north * scale },
    }));
  });
}

function searchGrid(site: Site, grid: EarthGrid, patterns: Pattern[], mars: TerrainProfile) {
  const range = (grid.size - 1) * grid.resolutionM / 2;
  const elevationScale = Math.max(10, (mars.ascentM + mars.descentM) / 2, mars.distanceKm * 12);
  const typicalSlope = mars.samples.slice(1).reduce((total, sample) => total + Math.abs(sample.slopeDeg), 0) / (mars.samples.length - 1);
  const slopeScale = Math.max(3, typicalSlope);
  let best: Candidate | undefined;
  for (const pattern of patterns) {
    const b = pattern.bounds;
    const eastRange = 2 * range - (b.east - b.west);
    const northRange = 2 * range - (b.north - b.south);
    if (eastRange < 0 || northRange < 0) continue;
    const distanceKm = mars.distanceKm * pattern.scale;
    for (const y of offsets) {
      const north = -range - b.south + y * northRange;
      for (const x of offsets) {
        const east = -range - b.west + x * eastRange;
        const values: number[] = [];
        for (const point of pattern.points) {
          const value = localElevation(grid, point.east + east, point.north + north);
          if (!Number.isFinite(value)) break;
          values.push(value);
        }
        if (values.length !== pattern.points.length) continue;
        const score = similarity(mars, values, distanceKm, elevationScale, slopeScale);
        if (best && score <= best.score) continue;
        if (grid.landMask && !pattern.landCheck.every((point) =>
          Number.isFinite(localElevation(grid, point.east + east, point.north + north)))) continue;
        best = { site, grid, pattern, east, north, values, score };
      }
    }
  }
  return best;
}

// Keep the first search's grids available when the planner edits the same route.
const earthPatches = new Map<string, EarthGrid>();
const earthArchives = new Map<string, EarthGrid[]>();
async function earthGrids(site: Site, regional: boolean, signal: AbortSignal): Promise<EarthGrid[]> {
  signal.throwIfAborted();
  if (!regional) {
    const cached = earthPatches.get(site.id);
    if (cached) return [cached];
    const { elevation } = await loadTerrain(site, signal);
    const grid = { values: elevation, size: gridSize, resolutionM: cellSize, source: site.source, sourceUrl: site.sourceUrl };
    earthPatches.set(site.id, grid);
    return [grid];
  }
  const cached = earthArchives.get(site.id);
  if (cached) return cached;
  const data = await loadArchive(`path-earth-${site.id}`, signal);
  let offset = 0;
  const grids = earthRegionSizes.map(({ size, resolutionM }): EarthGrid => {
    const values = decodeGrid(data, offset, size, size);
    offset += values.byteLength;
    return { values, size, resolutionM, ...earthRegionSource, landMask: true };
  });
  if (data.byteLength !== offset) throw new Error(`Invalid Earth grid ${site.id}`);
  earthArchives.set(site.id, grids);
  return grids;
}

export async function searchPathTerrain(
  points: readonly RoutePoint[], signal: AbortSignal, onProgress?: (done: number, total: number) => void,
  savedSiteId?: string,
): Promise<PathTerrainResult> {
  signal.throwIfAborted();
  if (points.length < 2 || points.some(({ lat, lon }) =>
    !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lon) || Math.abs(lon) > 180)) {
    throw new PathTerrainError("route");
  }
  const distanceKm = routeDistanceKm(points, MARS_RADIUS_KM);
  if (plannerDistanceRange(distanceKm) !== "ready") throw new PathTerrainError("distance");

  const checkSamples = resampleRoute(points, MARS_RADIUS_KM, 101);
  const center = checkSamples[50];
  const project = plane(center, marsRadiusM).project;
  const localPoints = points.map(project);
  const extent = bounds(localPoints);
  // The diagonal bounds the projected span at any search rotation.
  const diameter = Math.hypot(extent.east - extent.west, extent.north - extent.south);
  const regional = diameter > (gridSize - 1) * cellSize * 0.85;
  const gridTier = diameter > (earthRegionSizes[1].size - 1) * earthRegionSizes[1].resolutionM * 0.85 ? 0 : 1;
  const earthSpacing = regional ? earthRegionSizes[gridTier].resolutionM : cellSize;
  const source = await marsElevation(points, checkSamples, distanceKm, earthSpacing, signal);
  const spacingM = Math.max(source.resolutionM, earthSpacing);
  const samples = resampleRoute(points, MARS_RADIUS_KM, sampleCount(distanceKm, spacingM));
  const elevations = samples.map(source.sample);
  if (!elevations.every(Number.isFinite)) throw new PathTerrainError("coverage");
  const mars = buildProfile(points, samples, elevations, source);
  const landSamples = regional ? resampleRoute(points, MARS_RADIUS_KM, 1 + Math.ceil(distanceKm * 1150 / earthSpacing)) : [];
  const patterns = patternsFor(localPoints, samples.map(project), landSamples.map(project));
  const candidates: Candidate[] = [];
  const searchSites = regional ? regionalEarthSites : earthSites;
  let sitesSearched = 0, processed = 0;
  onProgress?.(0, searchSites.length);

  await Promise.all(Array.from({ length: searchConcurrency }, async (_, worker) => {
    for (let index = worker; index < searchSites.length; index += searchConcurrency) {
      const site = searchSites[index];
      let grids: EarthGrid[];
      try {
        grids = await earthGrids(site, regional, signal);
      } catch {
        signal.throwIfAborted();
        onProgress?.(++processed, searchSites.length);
        continue;
      }
      sitesSearched++;
      const match = searchGrid(site, grids[regional ? gridTier : 0], patterns, mars);
      if (match) candidates.push(match);
      onProgress?.(++processed, searchSites.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
      signal.throwIfAborted();
    }
  }));
  if (!sitesSearched) throw new PathTerrainError("earthData");
  if (!candidates.length) throw new PathTerrainError("noMatch");

  const matches: EarthRouteMatch[] = [];
  const chosenCenters: RoutePoint[] = [];
  let extraSaved: EarthRouteMatch | undefined;
  for (const { site, grid, pattern, east, north, values, score } of candidates.sort((a, b) => b.score - a.score || a.site.id.localeCompare(b.site.id))) {
    const saved = site.id === savedSiteId;
    if (matches.length >= 8 && !saved) continue;
    const unproject = plane({ lat: site.latitude, lon: site.longitude }, earthRadiusM).unproject;
    const mapPoint = (point: XY) => unproject({ east: point.east + east, north: point.north + north });
    const routeMidpoint = mapPoint({ east: 0, north: 0 });
    const ranked = matches.length < 8 && !chosenCenters.some((other) => routeDistanceKm([routeMidpoint, other], EARTH_RADIUS_KM) < 5);
    if (!saved && !ranked) continue;
    const earthPoints = localPoints.map((point) => mapPoint(rotate(point, pattern.cosine, pattern.sine, pattern.scale)));
    const coordinates = pattern.points.map((point, index) => ({ ...mapPoint(point), distanceKm: samples[index].distanceKm * pattern.scale }));
    const match = { site, profile: buildProfile(earthPoints, coordinates, values, grid), score };
    if (ranked) {
      matches.push(match);
      chosenCenters.push(routeMidpoint);
    } else {
      extraSaved = match;
    }
    if (matches.length >= 8 && (!savedSiteId || extraSaved || matches.some(({ site }) => site.id === savedSiteId))) break;
  }
  const savedMatch = extraSaved;
  if (savedMatch) {
    const index = matches.findIndex((match) => match.score < savedMatch.score);
    matches.splice(index === -1 ? matches.length : index, 0, savedMatch);
  }
  return { mars, matches, sitesSearched };
}
