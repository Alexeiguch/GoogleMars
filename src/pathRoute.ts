export type RoutePoint = { lat: number; lon: number };
export type RouteSample = RoutePoint & { distanceKm: number };
export type ImportedRoute = { name: string; points: RoutePoint[] };

export const MARS_RADIUS_KM = 3389.5;
export const EARTH_RADIUS_KM = 6371;
export const MAX_ROUTE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROUTE_POINTS = 20_000;

export type RouteFileErrorCode =
  | "unsupported-format"
  | "file-too-large"
  | "malformed-file"
  | "no-route"
  | "multiple-routes"
  | "invalid-coordinate"
  | "too-many-points"
  | "route-too-short";

export class RouteFileError extends Error {
  readonly code: RouteFileErrorCode;

  constructor(code: RouteFileErrorCode) {
    super(code);
    this.name = "RouteFileError";
    this.code = code;
  }
}

type Vector = [number, number, number];
const RADIANS = Math.PI / 180;
const MIN_ANGLE = 1e-15;
const JOIN_ANGLE = 1e-9;

function unitVector({ lat, lon }: RoutePoint): Vector {
  const phi = lat * RADIANS;
  const lambda = lon * RADIANS;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

function cross([ax, ay, az]: Vector, [bx, by, bz]: Vector): Vector {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function dot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function angleBetween(a: Vector, b: Vector) {
  return Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));
}

function arcBetween(start: RoutePoint, end: RoutePoint) {
  const a = unitVector(start);
  const b = unitVector(end);
  const normal = cross(a, b);
  const normalLength = Math.hypot(...normal);
  return { a, normal, normalLength, angle: Math.atan2(normalLength, dot(a, b)), start, end };
}

function pointOnArc({ a, normal, normalLength, angle, start, end }: ReturnType<typeof arcBetween>, fraction: number): RoutePoint {
  if (fraction <= 0) return { ...start };
  if (fraction >= 1) return { ...end };
  if (angle <= MIN_ANGLE) return { ...start };

  // Antipodal points have no unique shortest arc. Choose one reproducibly in either direction.
  const axis: Vector = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const tangent = cross(normalLength > MIN_ANGLE ? normal : cross(a, axis), a);
  const offset = Math.sin(angle * fraction) / Math.hypot(...tangent);
  const scale = Math.cos(angle * fraction);
  const [x, y, z] = a.map((value, index) => value * scale + tangent[index] * offset);
  return {
    lat: Math.atan2(z, Math.hypot(x, y)) / RADIANS,
    lon: Math.atan2(y, x) / RADIANS,
  };
}

export function interpolateRoutePoint(start: RoutePoint, end: RoutePoint, fraction: number): RoutePoint {
  return pointOnArc(arcBetween(start, end), fraction);
}

export function routeDistanceKm(points: readonly RoutePoint[], radiusKm: number): number {
  let distance = 0;
  for (let index = 1; index < points.length; index++) {
    distance += angleBetween(unitVector(points[index - 1]), unitVector(points[index]));
  }
  return distance * radiusKm;
}

export function resampleRoute(points: readonly RoutePoint[], radiusKm: number, sampleCount: number): RouteSample[] {
  const count = Math.floor(sampleCount);
  if (!points.length || !Number.isFinite(count) || count < 1) return [];
  const first = { ...points[0], distanceKm: 0 };
  if (points.length === 1 || count === 1) return [first];

  const segments: { arc: ReturnType<typeof arcBetween>; startKm: number; endKm: number }[] = [];
  let totalKm = 0;
  for (let index = 1; index < points.length; index++) {
    const arc = arcBetween(points[index - 1], points[index]);
    if (arc.angle <= MIN_ANGLE) continue;
    const endKm = totalKm + arc.angle * radiusKm;
    segments.push({ arc, startKm: totalKm, endKm });
    totalKm = endKm;
  }
  if (!segments.length) return [first];

  const samples = [first];
  let segmentIndex = 0;
  for (let index = 1; index < count - 1; index++) {
    const distanceKm = (index / (count - 1)) * totalKm;
    while (distanceKm > segments[segmentIndex].endKm && segmentIndex < segments.length - 1) segmentIndex++;
    const { arc, startKm, endKm } = segments[segmentIndex];
    samples.push({ ...pointOnArc(arc, (distanceKm - startKm) / (endKm - startKm)), distanceKm });
  }
  samples.push({ ...points[points.length - 1], distanceKm: totalKm });
  return samples;
}

type FileFormat = "geojson" | "gpx" | "kml";
type Candidate = { name?: string; parts: RoutePoint[][] };
type ReadPoint = (longitude: unknown, latitude: unknown) => RoutePoint;

function fileFormat(filename: string): FileFormat {
  const extension = /\.([^.]+)$/.exec(filename)?.[1].toLowerCase();
  if (extension === "json" || extension === "geojson") return "geojson";
  if (extension === "gpx" || extension === "kml") return extension;
  throw new RouteFileError("unsupported-format");
}

function readCoordinate(longitude: unknown, latitude: unknown): RoutePoint {
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 360) {
    throw new RouteFileError("invalid-coordinate");
  }
  // Mars datasets also use positive-east longitudes in a 0–360° range.
  return { lat: latitude, lon: longitude >= 180 ? longitude - 360 : longitude };
}

function decimal(value: string | null | undefined) {
  const numeric = value?.trim() ?? "";
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(numeric) ? Number(numeric) : NaN;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function parseGeoJson(content: string, readPoint: ReadPoint): Candidate[] {
  let root: unknown;
  try {
    root = JSON.parse(content);
  } catch {
    throw new RouteFileError("malformed-file");
  }
  if (!record(root)) throw new RouteFileError("malformed-file");

  const array = (value: unknown): unknown[] => {
    if (!Array.isArray(value)) throw new RouteFileError("malformed-file");
    return value;
  };
  const parseLine = (value: unknown) => array(value).map((position) => {
    if (!Array.isArray(position)) throw new RouteFileError("invalid-coordinate");
    return readPoint(position[0], position[1]);
  });
  const candidates: Candidate[] = [];
  const pending: { value: unknown; name?: string }[] = [{ value: root }];
  // Iterate over nested collections so malformed deep JSON cannot overflow the call stack.
  while (pending.length) {
    const { value, name } = pending.pop()!;
    const object = record(value);
    if (!object) continue;
    if (object.type === "FeatureCollection" || object.type === "GeometryCollection") {
      const children = array(object.type === "FeatureCollection" ? object.features : object.geometries);
      for (let index = children.length - 1; index >= 0; index--) pending.push({ value: children[index], name });
    } else if (object.type === "Feature") {
      const featureName = record(object.properties)?.name;
      pending.push({ value: object.geometry, name: typeof featureName === "string" ? featureName : name });
    } else if (object.type === "LineString") {
      candidates.push({ name, parts: [parseLine(object.coordinates)] });
    } else if (object.type === "MultiLineString") {
      candidates.push({ name, parts: array(object.coordinates).map(parseLine) });
    }
  }
  return candidates;
}

function parseXml(content: string, rootName: string): Element {
  if (/<!DOCTYPE\b/i.test(content)) throw new RouteFileError("malformed-file");
  const doc = new DOMParser().parseFromString(content, "application/xml");
  if (doc.documentElement.localName !== rootName || doc.getElementsByTagNameNS("*", "parsererror").length) {
    throw new RouteFileError("malformed-file");
  }
  return doc.documentElement;
}

const childrenNamed = (element: Element, name: string) => Array.from(element.children).filter((child) => child.localName === name);
const nameOf = (element: Element) => childrenNamed(element, "name")[0]?.textContent ?? undefined;

function parseGpx(content: string, readPoint: ReadPoint): Candidate[] {
  const root = parseXml(content, "gpx");
  const readElement = (point: Element) => readPoint(decimal(point.getAttribute("lon")), decimal(point.getAttribute("lat")));
  const tracks = childrenNamed(root, "trk").map((track) => ({
    name: nameOf(track),
    parts: childrenNamed(track, "trkseg").map((segment) => childrenNamed(segment, "trkpt").map(readElement)),
  }));
  const routes = childrenNamed(root, "rte").map((route) => ({
    name: nameOf(route),
    parts: [childrenNamed(route, "rtept").map(readElement)],
  }));
  return [...tracks, ...routes];
}

function parseKml(content: string, readPoint: ReadPoint): Candidate[] {
  const root = parseXml(content, "kml");
  return Array.from(root.getElementsByTagNameNS("*", "Placemark"), (placemark) => {
    const parts: RoutePoint[][] = [];
    const pending = Array.from(placemark.children).reverse();
    while (pending.length) {
      const geometry = pending.pop()!;
      if (geometry.localName === "LineString") {
        const coordinates = childrenNamed(geometry, "coordinates")[0]?.textContent?.trim();
        if (!coordinates) continue;
        parts.push(coordinates.split(/\s+/).map((position) => {
          const [lon, lat] = position.split(",");
          return readPoint(decimal(lon), decimal(lat));
        }));
      } else if (geometry.localName === "Track") {
        parts.push(childrenNamed(geometry, "coord").map((point) => {
          const [lon, lat] = point.textContent?.trim().split(/\s+/) ?? [];
          return readPoint(decimal(lon), decimal(lat));
        }));
      } else if (geometry.localName === "MultiGeometry" || geometry.localName === "MultiTrack") {
        for (let index = geometry.children.length - 1; index >= 0; index--) pending.push(geometry.children[index]);
      }
    }
    return { name: nameOf(placemark), parts };
  });
}

function mergeRouteParts(parts: RoutePoint[][]): RoutePoint[] {
  const points: RoutePoint[] = [];
  for (const part of parts) {
    if (!part.length) continue;
    if (points.length && angleBetween(unitVector(points[points.length - 1]), unitVector(part[0])) > JOIN_ANGLE) {
      throw new RouteFileError("multiple-routes");
    }
    for (const point of part) {
      if (!points.length || angleBetween(unitVector(points[points.length - 1]), unitVector(point)) > MIN_ANGLE) {
        points.push(point);
      }
    }
  }
  if (points.length < 2) throw new RouteFileError("route-too-short");
  return points;
}

function parseRoute(filename: string, content: string, format: FileFormat): ImportedRoute {
  content = content.replace(/^\uFEFF/, "");
  let pointCount = 0;
  const readPoint: ReadPoint = (longitude, latitude) => {
    if (++pointCount > MAX_ROUTE_POINTS) throw new RouteFileError("too-many-points");
    return readCoordinate(longitude, latitude);
  };
  const parsers = { geojson: parseGeoJson, gpx: parseGpx, kml: parseKml };
  const candidates = parsers[format](content, readPoint);
  const routes = candidates.filter((candidate) => candidate.parts.some((part) => part.length));
  if (!routes.length) throw new RouteFileError("no-route");
  if (routes.length > 1) throw new RouteFileError("multiple-routes");
  const [route] = routes;
  const name = (route.name?.trim() || filename.replace(/\.[^.]+$/, "")).replace(/\s+/g, " ").slice(0, 120);
  return { name, points: mergeRouteParts(route.parts) };
}

export function parseRouteFile(filename: string, content: string): ImportedRoute {
  if (new TextEncoder().encode(content).byteLength > MAX_ROUTE_FILE_BYTES) throw new RouteFileError("file-too-large");
  return parseRoute(filename, content, fileFormat(filename));
}

export async function importRouteFile(file: File): Promise<ImportedRoute> {
  const format = fileFormat(file.name);
  if (file.size > MAX_ROUTE_FILE_BYTES) throw new RouteFileError("file-too-large");
  let content: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be"
      : format === "geojson" ? "utf-8"
      // GPX and KML may declare a legacy encoding such as ISO-8859-1 for accented names.
      : /^\s*<\?xml\b[^>]*\bencoding\s*=\s*["']([\w.:-]+)["']/
        .exec(new TextDecoder("windows-1252").decode(bytes.subarray(0, 256)))?.[1] ?? "utf-8";
    content = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    throw new RouteFileError("malformed-file");
  }
  return parseRoute(file.name, content, format);
}
