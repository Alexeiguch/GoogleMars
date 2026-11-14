// Modelo de datos de la página «Globos 3D»: une results.json y catalog.json en puntos por globo.
// Los datos de origen no se modifican; aquí solo se leen y se fusionan.
import rawResults from "./data/results.json";
import { sites as catalogSites, type Site } from "./data";
import { getLang, locale, t } from "./i18n";

export type Body = "moon" | "mars";
export type GlobeId = "moon" | "earth" | "mars";
type Climate = { t_mean: number; t_min: number; t_max: number; diurnal_range: number; precip_year: number };
export type Reference = { id: string; body: Body; name: string; lat: number; lon: number; note: string };
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

export type EarthRole =
  | { kind: "site"; body: Body; rank: number }
  | { kind: "twin"; body: Body; ref: string; rank: number }
  | { kind: "featured"; body: Body; ref: string; tag: string; title: string; story: string }
  | { kind: "validation"; body: Body; name: string; percentile: number }
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

const keyOf = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export const refById = new Map(DATA.references.map((r) => [r.id, r]));

/** Puntaje mínimo (0–100) para que un punto de la Tierra salga en «Mejores». */
export const BEST_MIN_SCORE = 80;

export function buildEarthPoints(): EarthPoint[] {
  const points = new Map<string, EarthPoint>();
  const at = (lat: number, lon: number) => {
    const key = keyOf(lat, lon);
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
        point.roles.push({ kind: "twin", body, ref, rank: index + 1 });
        point.data[body] ??= site;
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

  for (const point of points.values()) {
    // «Mejores»: top 20, gemelo o historia destacada, y además con puntaje de BEST_MIN_SCORE o más
    // (redondeado como se muestra en la página, para que un 80 en pantalla cuente).
    const listed = point.roles.some((r) => r.kind === "site" || r.kind === "twin" || r.kind === "featured");
    const strong = BODIES.some((b) => point.data[b] && Math.round(point.data[b]!.score * 100) >= BEST_MIN_SCORE);
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
  // Los sitios del catálogo vienen del visor de Marte: son candidatos a análogo de Marte.
  return "mars";
}

/** Nombre real del punto (en español, como viene en los datos): name o title; si no, known_analog. Nunca se inventa. */
function earthName(point: EarthPoint): string | null {
  for (const role of point.roles) if (role.kind === "featured") return role.title;
  for (const role of point.roles) if (role.kind === "validation" || role.kind === "catalog") return role.name;
  for (const body of BODIES) if (point.data[body]?.known_analog) return point.data[body]!.known_analog;
  return null;
}

export const marsPatches = catalogSites.filter((s) => s.planet === "Mars");

/** Mejor sitio del ranking (mayor puntuación entre los dos cuerpos). */
export function topSite() {
  return BODIES.map((b) => DATA.bodies[b].sites[0]).reduce((a, b) => (b.score > a.score ? b : a));
}

export const fmt = (v: number, d = 1) => v.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
/** "29,50° S, 69,51° O" en español; "29.50° S, 69.51° W" en inglés. */
export const coord = (lat: number, lon: number, d = 2) =>
  `${fmt(Math.abs(lat), d)}° ${lat < 0 ? "S" : "N"}, ${fmt(Math.abs(lon), d)}° ${lon < 0 ? (getLang() === "es" ? "O" : "W") : "E"}`;
export const windowName = (lat: number, lon: number) => t("gl.window", { coord: coord(lat, lon) });
