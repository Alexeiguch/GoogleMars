// Modelo de datos de la página «Globos 3D».
// Los datos de origen no se modifican; aquí solo se leen y se fusionan.
import rawResults from "./data/results.json";
import { sites as catalogSites, type Site } from "./data";
import { getLang, locale, t } from "./i18n";
import { nasaAnalogs, type NasaAnalog } from "./nasaAnalogs";

export type Body = "moon" | "mars";
export type GlobeId = "moon" | "earth" | "mars";
type Climate = { t_mean: number; t_min: number; t_max: number; diurnal_range: number; precip_year: number };
export type Reference = {
  id: string; body: Body; name: string; lat: number; lon: number; note: string;
  /** results.json v2: tipo de referencia ("sitio", "region_centro", "region_tesela", "malla"…), región y grupo. */
  kind?: string;
  twin_key?: string;
  region?: string | null;
  group?: string;
  /** false: no puntúa (p. ej. en Marte solo hay MOLA de 463 m); usable_note explica por qué, en español. */
  usable?: boolean;
  usable_note?: string;
  source_url?: string;
  window_km?: number;
};
export type EarthSite = {
  lat: number; lon: number; score: number;
  scores: { terrain: number; surface: number; climate: number };
  climate: Climate | null;
  best_ref: string;
  surface_assumed: boolean;
  known_analog: string | null;
};
type Featured = { body: Body; ref: string; lat: number; lon: number; tag: string; title: string; story: string };
type Validation = { body: Body; name: string; lat: number; lon: number; percentile: number };
type Results = {
  references: Reference[];
  bodies: Record<Body, { sites: EarthSite[]; twins: Record<string, EarthSite[]>; heat: [number, number, number][] }>;
  validation: Validation[];
  featured: Featured[];
};

export const DATA = rawResults as unknown as Results;
export const BODIES: Body[] = ["moon", "mars"];
export const bodyName = (id: GlobeId) => t(`planet.${id}`);

/**
 * Clave con la que results.json v2 guarda los gemelos de una referencia (bodies[b].twins[clave]).
 * Misma regla que twin_key() en pipeline/analogs/rank.py: en Marte, el id; en la Luna, "malla_polar" para la malla,
 * el id para los sitios sueltos (o sin región) y la región para las teselas de una región de Artemis.
 * Nobile Rim 1 comparte mosaico con Mons Mouton y puntúa junto con ella.
 */
export function twinKeyOf(ref: Reference): string {
  if (ref.twin_key) return ref.twin_key;
  if (ref.body === "mars") return ref.id;
  if (ref.id === "nobile_rim_1") return "mons_mouton";
  if (ref.group === "malla_polar") return "malla_polar";
  if (ref.kind === "sitio" || !ref.region) return ref.id;
  return ref.region;
}

/** Gemelos terrestres de una referencia (vacío si no puntúa). */
export function twinsOf(ref: Reference): EarthSite[] {
  if (ref.usable === false) return [];
  return DATA.bodies[ref.body].twins[twinKeyOf(ref)] ?? [];
}

/**
 * Referencias que se ven en «Mejores»: los sitios y los centros de región. La malla polar de la Luna y las teselas
 * de cada región (más de cien rombos sobre el polo sur) solo salen en «Todos» o al elegirlas en el filtro.
 */
export const isHeadlineRef = (ref: Reference) => ref.kind !== "malla" && ref.kind !== "region_tesela";

export type EarthRole =
  | { kind: "site"; body: Body; rank: number }
  | { kind: "twin"; body: Body; ref: string; rank: number; site: EarthSite }
  | { kind: "featured"; body: Body; ref: string; tag: string; title: string; story: string }
  | { kind: "validation"; body: Body; name: string; percentile: number }
  | { kind: "nasa"; pair: NasaAnalog }
  | { kind: "catalog"; origin: "curated" | "global"; name: string; site: Site };

/** Punto de la Tierra con todos los roles que comparten sus coordenadas (redondeadas a 0,01°). */
export type EarthPoint = {
  key: string;
  lat: number;
  lon: number;
  roles: EarthRole[];
  /** Datos del ranking para cada cuerpo del que es análogo (sites o twins). */
  data: Partial<Record<Body, EarthSite>>;
  /** Cuerpo cuyo color usa el punto (el de su mejor puntuación). */
  color: Body;
  best: boolean;
  /** Texto de los datos en español; se traduce al mostrarlo con tr(). */
  name: string | null;
};

export const locationKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export const globeReferences = DATA.references.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
export const refById = new Map(globeReferences.map((r) => [r.id, r]));

/**
 * Puntaje mínimo (0–100) para que un punto de la Tierra salga en «Mejores», por cuerpo: la Luna puntúa más bajo
 * (su terreno es más abrupto que casi toda la Tierra y el clima nunca se le parece), su máximo actual es 82.
 */
export const BEST_MIN_SCORE: Record<Body, number> = { moon: 80, mars: 85 };

export function buildEarthPoints(): EarthPoint[] {
  const points = new Map<string, EarthPoint>();
  const at = (lat: number, lon: number) => {
    const key = locationKey(lat, lon);
    let point = points.get(key);
    if (!point) {
      point = { key, lat, lon, roles: [], data: {}, color: "moon", best: false, name: null };
      points.set(key, point);
    }
    return point;
  };

  for (const body of BODIES) {
    DATA.bodies[body].sites.forEach((site, index) => {
      const point = at(site.lat, site.lon);
      point.roles.push({ kind: "site", body, rank: index + 1 });
      point.data[body] ??= site;
    });
    for (const [ref, twins] of Object.entries(DATA.bodies[body].twins)) {
      twins.forEach((site, index) => {
        const point = at(site.lat, site.lon);
        point.roles.push({ kind: "twin", body, ref, rank: index + 1, site });
        const hasOverallRank = point.roles.some((role) => role.kind === "site" && role.body === body);
        if (!hasOverallRank && (!point.data[body] || site.score > point.data[body]!.score)) point.data[body] = site;
      });
    }
  }
  for (const f of DATA.featured) at(f.lat, f.lon).roles.push({ kind: "featured", ...f });
  for (const v of DATA.validation) {
    at(v.lat, v.lon).roles.push({ kind: "validation", body: v.body, name: v.name, percentile: v.percentile });
  }
  for (const site of catalogSites) {
    if (site.planet !== "Earth" || !site.origin) continue;
    at(site.latitude, site.longitude).roles.push({ kind: "catalog", origin: site.origin, name: site.name, site });
  }

  for (const pair of nasaAnalogs) {
    at(pair.earth.lat, pair.earth.lon).roles.push({ kind: "nasa", pair });
  }

  for (const point of points.values()) {
    // «Mejores»: top 20, gemelo o historia destacada, y además con el puntaje mínimo de su cuerpo o más
    // (redondeado como se muestra en la página, para que un 80 en pantalla cuente).
    const listed = point.roles.some((r) => r.kind === "site" || r.kind === "twin" || r.kind === "featured");
    const strong = BODIES.some((body) => {
      const threshold = BEST_MIN_SCORE[body];
      return Math.round((point.data[body]?.score ?? 0) * 100) >= threshold || point.roles.some((role) =>
        role.kind === "twin" && role.body === body && Math.round(role.site.score * 100) >= threshold);
    });
    point.best = listed && strong;
    point.color = colorBody(point);
    point.name = earthName(point);
  }
  return [...points.values()];
}

function colorBody(point: EarthPoint): Body {
  const scored = BODIES.filter((b) => point.data[b]);
  if (scored.length) return scored.reduce((a, b) => (point.data[b]!.score > point.data[a]!.score ? b : a));
  const featured = point.roles.find((r) => r.kind === "featured");
  if (featured) return featured.body;
  const validation = point.roles.filter((r) => r.kind === "validation");
  if (validation.length) return validation.reduce((a, b) => (b.percentile > a.percentile ? b : a)).body;
  const nasa = point.roles.find((r) => r.kind === "nasa");
  if (nasa) return nasa.pair.body;
  // Los sitios del catálogo vienen del visor de Marte: son candidatos a análogo de Marte.
  return "mars";
}

/** Nombre real del punto (en español, como viene en los datos): name o title; si no, known_analog. Nunca se inventa. */
function earthName(point: EarthPoint): string | null {
  for (const role of point.roles) if (role.kind === "featured") return role.title;
  for (const role of point.roles) if (role.kind === "validation" || role.kind === "catalog") return role.name;
  for (const role of point.roles) if (role.kind === "nasa") return role.pair.earth.name;
  for (const body of BODIES) if (point.data[body]?.known_analog) return point.data[body]!.known_analog;
  return null;
}

export const marsPatches = catalogSites.filter((s) => s.planet === "Mars");

/** Mejor sitio del ranking (mayor puntuación entre los dos cuerpos). */
export function topSite() {
  return BODIES.flatMap((body) => DATA.bodies[body].sites.slice(0, 1))
    .reduce<EarthSite | undefined>((a, b) => (!a || b.score > a.score ? b : a), undefined);
}

export const fmt = (v: number, d = 1) => v.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
/** "29,50° S, 69,51° O" en español; "29.50° S, 69.51° W" en inglés. */
export const coord = (lat: number, lon: number, d = 2) =>
  `${fmt(Math.abs(lat), d)}° ${lat < 0 ? "S" : "N"}, ${fmt(Math.abs(lon), d)}° ${lon < 0 ? (getLang() === "es" ? "O" : "W") : "E"}`;
export const windowName = (lat: number, lon: number) => t("gl.window", { coord: coord(lat, lon) });
