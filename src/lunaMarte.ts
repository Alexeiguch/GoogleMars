// Vista 2D global: análogos terrestres de la Luna (polo sur) y de Marte.
// Datos: src/data/results.json (pipeline/analogs/rank.py). Relieve: public/relieve/ (relief_images.py).
// Admite el formato v1 (solo ventanas de 30 km) y el v2 (referencias por grupo y búsqueda de grueso a fino:
// L0 = 30 km, L1 = 10 km, L2 = 5 km en la Luna y 2 km en Marte). Todos los campos v2 son opcionales.
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./lunaMarte.css";
import "./prefs";
import L from "leaflet";
import { getLang, hasMsg, locale, onLangChange, t, tr, type Lang } from "./i18n";
import rawResults from "./data/results.json";

// ---- tipos del results.json ----------------------------------------------------
type Body = "moon" | "mars";
type Level = "L0" | "L1" | "L2";
type Features = Record<string, number | null | undefined>;
type Quality = { effres_p50?: number | null; effres_p90?: number | null; R400?: number | null; eq1m?: number | null; clase?: string | null };
type Reference = {
  id: string; body: Body; name: string; lat?: number | null; lon?: number | null; note?: string | null;
  features?: Features | null; shape?: Features | null; level?: string; group?: string | null; region?: string | null;
  kind?: string | null; source_url?: string | null; source_note?: string | null; coord_quality?: string | null; dem?: string | null;
  quality?: Quality | null; usable?: boolean; usable_note?: string | null; group_only?: boolean;
};
type Literature = { status?: string | null; url?: string | null; note?: string | null; name?: string | null; km?: number | null };
type Win = { lat: number; lon: number; best_ref?: string | null; hirise?: string | null };
type Scores = {
  terrain: number; surface: number; climate: number;
  terrain_L0?: number | null; terrain_L1?: number | null; terrain_L2?: number | null;
};
type EarthSite = {
  lat: number; lon: number; elev_mean?: number | null; score: number; scores: Scores;
  climate_parts?: { cold: number; dry: number; swing: number } | null;
  climate?: { t_mean: number; t_min: number; t_max: number; diurnal_range: number; precip_year: number } | null;
  best_ref: string; best_ref_L0?: string | null; best_ref_L1?: string | null; best_ref_L2?: string | null;
  twin_key?: string | null; level?: string | number | null; hirise?: string | null; l2_scope?: string | null;
  levels?: Partial<Record<Level, Win>> | null; l2?: Win | null; parent_L0?: Win | null;
  features?: Features | null; shape?: Features | null;
  cover?: { bare: number; snow_ice: number } | null;
  surface_assumed?: boolean; known_analog?: string | null; literature?: Literature | null;
  robust?: Partial<Record<"final" | "final_new", { top10_frac: number; best: number; worst: number }>> | null;
};
type Featured = { body: Body; ref: string; lat: number; lon: number; tag: string; title: string; story: string };
type Group = { name: string; body: Body; kind?: string; n_refs?: number; n_refs_levels?: Partial<Record<Level, number>> };
type LevelInfo = { window_km?: number; px_m?: number; ref_data?: string; earth_data?: string; coarsest?: string; feature_labels?: Record<string, string> };
type ValidationRow = {
  body: Body; name: string; percentile?: number | null; before?: number | null; after?: number | null;
  delta?: number | null; fine?: number | null; note?: string | null;
};
/** [id, cuerpo, nivel, grupo, lat, lon, usable] */
type RefPoint = [string, Body, string, string | null, number, number, boolean];
type BodyData = {
  sites: EarthSite[]; twins: Record<string, EarthSite[]>; heat: [number, number, number][];
  fine?: { sites?: EarthSite[] | null; twins?: Record<string, EarthSite[]> | null; final?: EarthSite[] | null; final_new?: EarthSite[] | null } | null;
};
type Results = {
  references: Reference[];
  references_fine?: Reference[] | null;
  feature_labels: Record<string, string>;
  bodies: Record<Body, BodyData>;
  validation: ValidationRow[];
  validation_no_window?: ValidationRow[] | null;
  featured?: Featured[] | null;
  groups?: Record<string, Group> | null;
  levels?: Partial<Record<Level, Partial<Record<Body, LevelInfo>>>> | null;
  reference_points?: RefPoint[] | null;
  weight_sensitivity?: { n_combos: number } | null;
};

const DATA = rawResults as unknown as Results;
const BASE = import.meta.env.BASE_URL;
// Colores de los marcadores sobre imágenes (satélite, relieve): iguales en tema claro y oscuro.
const BODY_COLOR: Record<Body, string> = { moon: "#c9d1e0", mars: "#d69a70" };
const bodyName = (b: Body) => t(b === "moon" ? "planet.moon" : "planet.mars");
const EARTH_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
// Mosaico CTX global de Marte (~5 m/píxel), Caltech Murray Lab vía Esri. Va en EPSG:4326 con teselas de 512 px.
const MARS_TILES = "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}";
const EARTH_RADIUS_KM = 6371;
const MARS_RADIUS_KM = 3389.5;
const LEVELS: Level[] = ["L0", "L1", "L2"];
// Escalas del PLAN_v2 §3 por si el results.json no trae "levels" (v1): ventana de medida y píxel de las imágenes.
const DEFAULT_WINDOW_KM: Record<Body, Record<Level, number>> = { moon: { L0: 30, L1: 10, L2: 5 }, mars: { L0: 30, L1: 10, L2: 2 } };
const IMAGE_PX: Record<Body, Record<Level, number>> = { moon: { L0: 120, L1: 120, L2: 60 }, mars: { L0: 200, L1: 200, L2: 30 } };

const LIMITS: Record<Lang, Record<Body, string[]>> = {
  es: {
    moon: [
      "Gravedad: 1 g en la Tierra frente a 0,17 g en la Luna.",
      "Sin atmósfera: la Luna está en vacío; aquí hay aire, viento y erosión.",
      "Temperatura: los cráteres en sombra permanente del polo sur bajan de −200 °C, imposible en la Tierra.",
      "Iluminación: la luz casi permanente de las crestas y la sombra permanente de los cráteres polares no se modelan todavía.",
      "Radiación y regolito: sin campo magnético ni atmósfera, y un polvo lunar muy abrasivo que aquí no existe.",
      "Forma del terreno: las pendientes y la rugosidad pueden coincidir, pero aquí el relieve lo tallan el agua y el hielo (valles y crestas) y en la Luna los impactos (cráteres). Compáralo en la vista de relieve.",
    ],
    mars: [
      "Gravedad: 1 g frente a 0,38 g en Marte.",
      "Atmósfera: Marte tiene ~0,6 % de la presión terrestre y es casi todo CO₂.",
      "Temperatura media de Marte ≈ −60 °C; ningún desierto terrestre llega a ese frío de forma sostenida.",
      "Radiación UV y cósmica mucho mayor en superficie; aquí la biología lo coloniza casi todo.",
      "Forma del terreno: las estadísticas de pendiente pueden coincidir aunque los procesos sean distintos (en Marte dominan cráteres, viento y agua antigua). Compáralo en la vista de relieve.",
    ],
  },
  en: {
    moon: [
      "Gravity: 1 g on Earth versus 0.17 g on the Moon.",
      "No atmosphere: the Moon is in a vacuum; here there is air, wind and erosion.",
      "Temperature: the permanently shadowed craters at the south pole drop below −200 °C, impossible on Earth.",
      "Lighting: the near-permanent sunlight on the ridges and the permanent shadow in polar craters are not modeled yet.",
      "Radiation and regolith: no magnetic field or atmosphere, and a very abrasive lunar dust that does not exist here.",
      "Landform: slopes and roughness may match, but here the relief is carved by water and ice (valleys and ridges), and on the Moon by impacts (craters). Compare them in the relief view.",
    ],
    mars: [
      "Gravity: 1 g versus 0.38 g on Mars.",
      "Atmosphere: Mars has ~0.6% of Earth's surface pressure and is almost entirely CO₂.",
      "Mean temperature on Mars ≈ −60 °C; no desert on Earth stays that cold for long.",
      "Much higher UV and cosmic radiation at the surface; here, life colonizes almost everything.",
      "Landform: slope statistics may match even when the processes differ (on Mars, craters, wind and ancient water dominate). Compare them in the relief view.",
    ],
  },
};

// ---- utilidades -------------------------------------------------------------------
const fmt = (v: number | null | undefined, d = 1) =>
  v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : String(Math.round(v * 100)));
/** Coordenadas en el formato del idioma: "29,50° S · 69,51° O" / "29.50° S · 69.51° W". */
const coord = (lat: number, lon: number, d = 2) =>
  `${fmt(Math.abs(lat), d)}° ${lat < 0 ? "S" : "N"} · ${fmt(Math.abs(lon), d)}° ${lon < 0 ? (getLang() === "es" ? "O" : "W") : "E"}`;
const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const safeUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u) ? u : null);
/** Distancia (km) por la superficie de la Tierra entre dos puntos. */
function distKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
const km = (v: number) => (v < 1 ? `${fmt(v * 1000, 0)} m` : `${fmt(v, v % 1 ? 1 : 0)} km`);
/** Texto de un código (grupo, tipo, calidad de coordenada…) con su clave de i18n, o el código legible. */
const codeText = (prefix: string, code: string | null | undefined) => {
  if (!code) return "";
  if (hasMsg(`${prefix}${code}`)) return t(`${prefix}${code}`);
  if (hasMsg(`cat.${code}`)) return t(`cat.${code}`);   // categorías HiRISE de Marte (L2)
  return code.replace(/_/g, " ");
};

// ---- índices ------------------------------------------------------------------------
// references: las L0 (se dibujan); references_fine: las L1/L2 que son mejor pareja de algún sitio (rasgos por escala).
const REFS = new Map([...DATA.references, ...(DATA.references_fine ?? [])].map((r) => [r.id, r]));
const GROUPS: Record<string, Group> = DATA.groups ?? {};
type Point = { id: string; body: Body; level: Level; group: string | null; lat: number; lon: number; usable: boolean };
const toLevel = (v: unknown): Level | null => {
  const s = String(v ?? "").toUpperCase().replace(/^L/, "");
  return s === "0" || s === "1" || s === "2" ? (`L${s}` as Level) : null;
};
const POINTS: Point[] = (DATA.reference_points ?? [])
  .filter((p) => Array.isArray(p) && p.length >= 6 && Number.isFinite(p[4]) && Number.isFinite(p[5]))
  .map(([id, b, lv, group, lat, lon, usable]) => ({ id, body: b, level: toLevel(lv) ?? "L1", group, lat, lon, usable: usable !== false }));
// Si no hay reference_points (v1), las referencias L0 hacen de puntos.
if (!POINTS.length) {
  for (const r of DATA.references) {
    if (r.group_only || r.lat == null || r.lon == null) continue;
    POINTS.push({ id: r.id, body: r.body, level: "L0", group: r.group ?? null, lat: r.lat, lon: r.lon, usable: r.usable !== false });
  }
}
const POINT_BY_ID = new Map<string, Point>();
for (const p of POINTS) if (!POINT_BY_ID.has(p.id)) POINT_BY_ID.set(p.id, p);

const levelInfo = (b: Body, lv: Level): LevelInfo | undefined => DATA.levels?.[lv]?.[b];
const windowKm = (b: Body, lv: Level) => levelInfo(b, lv)?.window_km ?? DEFAULT_WINDOW_KM[b][lv];
const siteLevel = (s: EarthSite): Level => toLevel(s.level) ?? "L0";

/** Clave de gemelos de una referencia L0 (como twin_key en rank.py). */
function twinKeyOf(r: Reference): string {
  if (GROUPS[r.id]) return r.id;
  if (r.group === "malla_polar") return "malla_polar";
  if (r.region && GROUPS[r.region]) return r.region;
  return r.id;
}
// La malla polar tiene un nombre largo en los datos; en listas y títulos basta el corto (la ficha explica el resto).
const groupName = (key: string | null | undefined) =>
  !key ? "" : key === "malla_polar" ? t("lm.grp.malla_polar") : tr(GROUPS[key]?.name ?? REFS.get(key)?.name ?? key);
/** Nombre legible de una referencia de cualquier nivel. */
function refLabel(id: string | null | undefined, twinKey?: string | null, b: Body = body): string {
  if (!id) return "—";
  const r = REFS.get(id);
  if (r) return tr(r.name);
  if (/^hirise_/i.test(id)) return t("lm.hirisePatch", { id: id.replace(/^hirise_/i, "") });
  const p = POINT_BY_ID.get(id);
  const base = twinKey ? groupName(twinKey) : "";
  if (p && base) return `${base} · ${t("lm.tileOf", { km: fmt(windowKm(b, p.level), 0) })}`;
  return base || id;
}

// Ventana L0 de cada ventana L1 (para los finalistas, que no la traen): fine.sites y fine.twins por coordenadas.
const key4 = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
const L1_PARENT = new Map<string, { parent: Win; ref: string | null }>();
for (const b of ["moon", "mars"] as Body[]) {
  const F = DATA.bodies[b]?.fine;
  const all = [...(F?.sites ?? []), ...Object.values(F?.twins ?? {}).flat()];
  for (const s of all) {
    if (s?.parent_L0 && Number.isFinite(s.parent_L0.lat)) {
      L1_PARENT.set(`${b}|${key4(s.lat, s.lon)}`, { parent: s.parent_L0, ref: s.best_ref_L0 ?? null });
    }
  }
}

// ---- mapa principal ---------------------------------------------------------------------
let body: Body = "moon";
let baseLayer: L.LayerGroup | undefined;
let rankLayer: L.LayerGroup | undefined;
let heatLayer: L.LayerGroup | undefined;
let heatBody: Body | undefined;
const map = L.map("map", { worldCopyJump: true, minZoom: 2, preferCanvas: true }).setView([10, 0], 2);
let attribution = t("lm.attribution");
L.tileLayer(EARTH_TILES, { attribution, maxZoom: 13 }).addTo(map);
const legend = new L.Control({ position: "bottomright" });
const legendBox = L.DomUtil.create("div", "lm-legend");
legend.onAdd = () => legendBox;
legend.addTo(map);
function renderMapText() {
  legendBox.innerHTML = t(hasFinal("moon") || hasFinal("mars") ? "lm.legendV2" : "lm.legend");
  const next = t("lm.attribution");
  if (next !== attribution) {
    map.attributionControl.removeAttribution(attribution).addAttribution(next);
    attribution = next;
  }
}

// ---- elementos abribles (sitios de la Tierra) -------------------------------------------
let selectedEl: HTMLElement | null = null;
function markActive(el: HTMLElement | null) {
  selectedEl?.setAttribute("aria-pressed", "false");
  selectedEl = el;
  el?.setAttribute("aria-pressed", "true");
}
/** Elemento abierto en el detalle (p. ej. "rank-final-0", "twin-haworth-1"). Se conserva al cambiar de idioma. */
let currentKey: string | null = null;
const openers = new Map<string, (fly?: boolean) => void>();
function register(key: string, el: HTMLElement, open: (fly: boolean) => void) {
  const go = (fly = true) => { markActive(el); currentKey = key; open(fly); };
  el.addEventListener("click", () => go());
  openers.set(key, go);
  if (key === currentKey) markActive(el);
  return go;
}

const isStudied = (s: EarthSite) => !!s.known_analog || s.literature?.status === "ya_estudiado";
/** "Nuevo" solo si se revisó la bibliografía y no se encontró nada; si no, "sin revisar". */
const isReviewedNew = (s: EarthSite) => !isStudied(s) && s.literature?.status === "no_encontrado";
const pill = (s: EarthSite) => isStudied(s)
  ? `<span class="lm-pill known">${t(s.known_analog ? "lm.pill.known" : "lm.pill.studied")}</span>`
  : isReviewedNew(s)
    ? `<span class="lm-pill new">${t("lm.pill.new")}</span>`
    : `<span class="lm-pill unrev">${t("lm.pill.unreviewed")}</span>`;

function listItem(s: EarthSite, badge: string, subtitle: string, extra = "") {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `${badge}
    <span class="lm-name">${coord(s.lat, s.lon)}<small>${esc(subtitle)}</small>${extra}</span>
    <span class="lm-score"><b>${pct(s.score)}</b>${pill(s)}</span>`;
  li.append(button);
  return { li, button };
}

const rankBadge = (n: number | string, color: string, outline = false) => outline
  ? `<span class="lm-rank" style="border:2px solid ${color};color:${color}">${n}</span>`
  : `<span class="lm-rank" style="background:${color}">${n}</span>`;

const fineOf = (b: Body) => DATA.bodies[b]?.fine ?? null;
const finalOf = (b: Body) => (fineOf(b)?.final ?? []).filter((s) => s && Number.isFinite(s.lat));
const hasFinal = (b: Body) => finalOf(b).length > 0;
/** Top de candidatos no conocidos (lejos de los análogos conocidos y sin estudios encontrados en la bibliografía). */
const newOf = (b: Body) => (fineOf(b)?.final_new ?? []).filter((s) => s && Number.isFinite(s.lat));
/** Nombre de la referencia o del grupo al que se parece un sitio. */
const likeName = (s: EarthSite) => (s.twin_key ? groupName(s.twin_key) : refLabel(s.best_ref));

// ---- ranking ------------------------------------------------------------------------------
type RankMode = "final" | "new" | "l0";
let rankMode: RankMode = "final";
const rankModes = document.querySelectorAll<HTMLButtonElement>("[data-rank]");
for (const b of rankModes) {
  b.addEventListener("click", () => {
    const next = b.dataset.rank as RankMode;
    if (next === rankMode) return;
    rankMode = next;
    for (const key of openers.keys()) if (key.startsWith("rank-")) openers.delete(key);
    if (currentKey?.startsWith("rank-")) currentKey = null;
    renderRanking();
    reopen();
  });
}

function levelsLine(s: EarthSite) {
  const sc = s.scores ?? ({} as Scores);
  if (sc.terrain_L1 == null && sc.terrain_L2 == null) return "";
  return `<small class="lm-levels">${esc(t("lm.levelsShort", {
    k: fmt(windowKm(body, "L2"), 0), a: pct(sc.terrain_L0), b: pct(sc.terrain_L1), c: pct(sc.terrain_L2),
  }))}</small>`;
}

function renderRanking() {
  const color = BODY_COLOR[body];
  const fin = finalOf(body);
  const nw = newOf(body);
  const mode: RankMode = !fin.length ? "l0" : rankMode === "new" && !nw.length ? "final" : rankMode;
  const box = $("#rank-modes");
  box.hidden = !fin.length;
  for (const b of rankModes) {
    b.setAttribute("aria-pressed", String(b.dataset.rank === mode));
    if (b.dataset.rank === "new") b.hidden = !nw.length;
  }
  $("#rank-note").hidden = mode !== "new";

  if (rankLayer) map.removeLayer(rankLayer);
  rankLayer = L.layerGroup().addTo(map);
  const list = mode === "final" ? fin : mode === "new" ? nw : DATA.bodies[body].sites;
  const ranking = $("#ranking");
  ranking.replaceChildren();
  list.forEach((s, i) => {
    const title = t(mode === "final" ? "lm.finalTitle" : mode === "new" ? "lm.newTitle" : "lm.rankTitle", { n: i + 1 });
    const { li, button } = listItem(s, rankBadge(i + 1, color), t("lm.similarTo", { name: likeName(s) }), levelsLine(s));
    const go = register(`rank-${mode}-${i}`, button, (fly) => select(s, title, null, fly));
    const icon = L.divIcon({ className: "", iconSize: [24, 24], html: rankBadge(i + 1, color) });
    L.marker([s.lat, s.lon], { icon, title: `${title} · ${coord(s.lat, s.lon)}` }).addTo(rankLayer!).on("click", () => go());
    ranking.append(li);
  });
}

// ---- gemelos por grupo ---------------------------------------------------------------------
const openGroups = new Set<string>();

function twinList(list: EarthSite[], keyPrefix: string, label: string, outline: boolean, makeTitle: (k: number) => string) {
  // Dentro del panel el contorno usa --body (contrasta en los dos temas); el relleno, el color fijo del mapa.
  const color = outline ? "var(--body)" : BODY_COLOR[body];
  const wrap = document.createElement("div");
  if (!list.length) return wrap;
  const h = document.createElement("h4");
  h.className = "lm-minihead";
  h.textContent = label;
  const ol = document.createElement("ol");
  ol.className = "lm-list";
  list.forEach((s, k) => {
    const sub = s.known_analog ? tr(s.known_analog) : s.literature?.status === "ya_estudiado" ? t("lm.lit.known")
      : isReviewedNew(s) ? t("lm.noStudies") : t("lm.notReviewed");
    const { li, button } = listItem(s, rankBadge(k + 1, color, outline), sub, levelsLine(s));
    register(`${keyPrefix}-${k}`, button, (fly) => select(s, makeTitle(k), null, fly));
    ol.append(li);
  });
  wrap.append(h, ol);
  return wrap;
}

function renderTwins() {
  const B = DATA.bodies[body];
  const F = fineOf(body);
  const keys = [...new Set([...Object.keys(B.twins ?? {}), ...Object.keys(F?.twins ?? {})])];
  const best = (k: string) => Math.max(-1, ...[...(B.twins?.[k] ?? []), ...(F?.twins?.[k] ?? [])].map((s) => s.score ?? -1));
  keys.sort((a, b) => best(b) - best(a));
  const box = $("#twins");
  box.replaceChildren();
  for (const key of keys) {
    const l0 = B.twins?.[key] ?? [];
    const l1 = F?.twins?.[key] ?? [];
    const det = document.createElement("details");
    det.className = "lm-group";
    det.open = openGroups.has(key);
    det.addEventListener("toggle", () => { if (det.open) openGroups.add(key); else openGroups.delete(key); });
    const sum = document.createElement("summary");
    const b = best(key);
    sum.innerHTML = `<span class="lm-gname">${esc(groupName(key))}</span>
      <span class="lm-score"><b>${b >= 0 ? pct(b) : "—"}</b><small>${t("lm.bestTwin")}</small></span>`;
    det.append(sum);
    const name = groupName(key);
    det.append(twinList(l0, `twin-${key}`, t("lm.twins30"), true, (k) => t("lm.twinTitle", { k: k + 1, name })));
    det.append(twinList(l1, `ftwin-${key}`, t("lm.twins10"), false, (k) => `${t("lm.twinTitle", { k: k + 1, name })} · 10 km`));
    if (!l0.length && !l1.length) {
      const p = document.createElement("p");
      p.className = "lm-note";
      p.textContent = t("lm.noTwins");
      det.append(p);
    }
    const show = document.createElement("button");
    show.type = "button";
    show.className = "lm-link";
    show.textContent = t("lm.showRef");
    show.addEventListener("click", () => {
      selectRef(`g:${key}`);
      $("#refs").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    det.append(show);
    box.append(det);
  }
}

// ---- referencias: recuento, minimapa y ficha ---------------------------------------------
/** Selección del minimapa: "g:<clave de gemelos>" o "r:<id de referencia>". */
let refSel: string | null = null;
const MOON_VIEW = 10.6;   // grados al polo que muestra el minimapa de la Luna (hasta ~79,4°S)
const MOON_EDGE = 12;     // la imagen moon_south_pole.webp llega a 78°S (EDGE_DEG en moon_pole.py)
/** Proyección del minimapa. Luna: azimutal equidistante polar (moon_pole.py; fila 0 = y +12°). Marte: equirectangular. */
function proj(b: Body, lat: number, lon: number): [number, number] {
  if (b === "moon") {
    const rho = 90 + lat;
    const a = (lon * Math.PI) / 180;
    return [rho * Math.sin(a), -rho * Math.cos(a)];
  }
  const lo = ((((lon + 180) % 360) + 360) % 360);
  return [lo, 90 - lat];
}
// Nombres cortos para las etiquetas de las regiones de Artemis III en el minimapa.
const SHORT: Record<string, string> = {
  peak_near_cabeus_b: "Cabeus B", haworth: "Haworth", malapert_massif: "Malapert", mons_mouton_plateau: "Mouton Plateau",
  mons_mouton: "Mons Mouton", nobile_rim_1: "Nobile 1", nobile_rim_2: "Nobile 2", de_gerlache_rim_2: "de Gerlache 2",
  slater_plain: "Slater",
};
// Estilo de cada clase de marcador (forma + color, para no depender solo del color).
const MK = {
  a24: "#ffd166", a22: "#ff9a62", site: "#7fdbff", grid: "#ffffff", usable: "#ffd166", mola: "#ffd166", unusable: "#ff9a62",
};

type MarkerClass = "a24" | "a24t" | "a22" | "site" | "grid" | "usable" | "mola" | "unusable";
function markerClass(r: Reference): MarkerClass {
  if (r.body === "mars") {
    if (r.usable === false) return "unusable";
    return r.quality?.clase === "solo_mola" ? "mola" : "usable";
  }
  if (r.group === "malla_polar") return "grid";
  if (r.group === "artemis_2024") return r.kind === "region_tesela" ? "a24t" : "a24";
  if (r.group === "artemis_2022_retirada") return "a22";
  if (r.group === "sitios_polo_sur" || r.group === "luna_fuera_del_polo") return "site";
  return "a24";   // v1: las 6 referencias de la Luna
}
function markerSvg(c: MarkerClass, x: number, y: number, u: number, extra: string) {
  const s = (n: number) => (n * u).toFixed(3);
  const dark = `stroke="#000" stroke-opacity=".75" stroke-width="${s(1)}"`;
  switch (c) {
    case "a24": case "usable": return `<circle cx="${x}" cy="${y}" r="${s(4.5)}" fill="${MK.a24}" ${dark} ${extra}/>`;
    case "a24t": return `<circle cx="${x}" cy="${y}" r="${s(2.8)}" fill="${MK.a24}" fill-opacity=".85" ${dark} ${extra}/>`;
    case "mola": return `<circle cx="${x}" cy="${y}" r="${s(4.5)}" fill="${MK.mola}" ${dark} ${extra}/><circle cx="${x}" cy="${y}" r="${s(1.7)}" fill="#000" ${extra}/>`;
    case "a22": case "unusable":
      return `<circle cx="${x}" cy="${y}" r="${s(4)}" fill="#000" fill-opacity=".35" stroke="${MK.a22}" stroke-width="${s(2)}" ${extra}/>`;
    case "site": {
      const d = 5.2 * u;
      return `<path d="M${x} ${y - d}L${x + d} ${y}L${x} ${y + d}L${x - d} ${y}Z" fill="${MK.site}" ${dark} ${extra}/>`;
    }
    case "grid": return `<circle cx="${x}" cy="${y}" r="${s(2)}" fill="${MK.grid}" fill-opacity=".8" ${extra}/>`;
  }
}
function legendSwatch(c: MarkerClass | "fine" | "sel") {
  const svg = (inner: string) => `<svg viewBox="-7 -7 14 14" width="14" height="14" aria-hidden="true">${inner}</svg>`;
  if (c === "fine") return svg(`<circle r="1.6" fill="#fff" fill-opacity=".6"/>`);
  if (c === "sel") return svg(`<circle r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/>`);
  return svg(markerSvg(c, 0, 0, 1, "") ?? "");
}

function refCounts(b: Body) {
  const rows = new Map<string, Record<Level, number>>();
  let unusable = 0;
  const tot: Record<Level, number> = { L0: 0, L1: 0, L2: 0 };
  for (const p of POINTS) {
    if (p.body !== b) continue;
    const g = p.group ?? "none";
    if (!rows.has(g)) rows.set(g, { L0: 0, L1: 0, L2: 0 });
    rows.get(g)![p.level]++;
    tot[p.level]++;
    if (!p.usable) unusable++;
  }
  return { rows, tot, unusable };
}

function renderRefs() {
  const box = $("#refs");
  const { rows, tot, unusable } = refCounts(body);
  const k2 = fmt(windowKm(body, "L2"), 0);
  const fmtN = (n: number) => n.toLocaleString(locale());
  const summary = t("lm.refsSummary", { n0: fmtN(tot.L0), n1: fmtN(tot.L1), n2: fmtN(tot.L2), k2 }) +
    (unusable ? t("lm.refsUnusable", { u: fmtN(unusable) }) : "");
  const head = LEVELS.map((lv) => `<th scope="col">${fmt(windowKm(body, lv), 0)} km</th>`).join("");
  const body_ = [...rows.entries()]
    .sort((a, b) => (a[0] === "none" ? 1 : 0) - (b[0] === "none" ? 1 : 0))
    .map(([g, c]) => `<tr><th scope="row">${esc(codeText("lm.grp.", g))}</th>${LEVELS.map((lv) => `<td>${c[lv] ? fmtN(c[lv]) : "—"}</td>`).join("")}</tr>`)
    .join("");

  // Minimapa (SVG): imagen de fondo + puntos L1/L2 tenues + marcadores L0 + etiquetas de las regiones de Artemis.
  const moon = body === "moon";
  const vb = moon ? [-MOON_VIEW, -MOON_VIEW, 2 * MOON_VIEW, 2 * MOON_VIEW] : [0, 0, 360, 180];
  const u = vb[2] / 400;   // unidades del viewBox por píxel de pantalla (aprox.)
  const img = moon
    ? `<image href="${BASE}imagery/moon_south_pole.webp" x="${-MOON_EDGE}" y="${-MOON_EDGE}" width="${2 * MOON_EDGE}" height="${2 * MOON_EDGE}" preserveAspectRatio="none"/>`
    : `<image href="${BASE}imagery/mars.webp" x="0" y="0" width="360" height="180" preserveAspectRatio="none"/>`;
  let grat = "";
  if (moon) {
    for (const r of [2, 4, 6, 8, 10]) {
      grat += `<circle r="${r}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="${(0.8 * u).toFixed(3)}"/>`;
    }
    for (const r of [5, 10]) {
      grat += `<text x="${(0.25).toFixed(2)}" y="${(r - 0.25).toFixed(2)}" class="lm-mm-grat" font-size="${(10 * u).toFixed(3)}">${t("lm.ring", { lat: 90 - r })}</text>`;
    }
    const lonLbl = (lon: number) => lon === 0 || lon === 180 ? `${lon}°` : `${Math.abs(lon)}° ${lon < 0 ? (getLang() === "es" ? "O" : "W") : "E"}`;
    for (const lon of [0, 90, 180, -90]) {
      const [x, y] = proj("moon", -90 + 9.4, lon);
      const anchor = lon === 90 ? "end" : lon === -90 ? "start" : "middle";
      const dy = lon === 0 ? -0.15 : lon === 180 ? 0.5 : 0.15;
      grat += `<text x="${x.toFixed(2)}" y="${(y + dy).toFixed(2)}" text-anchor="${anchor}" class="lm-mm-grat" font-size="${(10 * u).toFixed(3)}">${lonLbl(lon)}</text>`;
    }
  }
  let fine = "";
  // El minimapa de la Luna es el polo sur: los sitios fuera del polo (Apollo, Chang'e, fosos) no caben.
  const inMap = (lat: number | null | undefined) => !moon || (lat != null && lat <= -78);
  for (const p of POINTS) {
    if (p.body !== body || p.level === "L0" || !inMap(p.lat)) continue;
    const [x, y] = proj(body, p.lat, p.lon);
    fine += `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${((p.level === "L2" ? 1.3 : 1) * u).toFixed(3)}" fill="#fff" fill-opacity="${p.level === "L2" ? 0.6 : 0.4}"/>`;
  }
  const l0all = DATA.references.filter((r) => r.body === body && !r.group_only && r.lat != null && r.lon != null);
  const l0 = l0all.filter((r) => inMap(r.lat));
  const outside = l0all.length - l0.length;
  // Malla y teselas primero (debajo), los sitios con nombre encima.
  const order: MarkerClass[] = ["grid", "a24t", "a22", "unusable", "mola", "usable", "site", "a24"];
  l0.sort((a, b) => order.indexOf(markerClass(a)) - order.indexOf(markerClass(b)));
  const present = new Set<MarkerClass>();
  let marks = "";
  // Etiquetas de las regiones; las que caen en el mismo sitio (Nobile Rim 1 y Mons Mouton comparten mosaico) se juntan.
  const lbls: { x: number; y: number; text: string[] }[] = [];
  for (const r of l0) {
    const [x, y] = proj(body, r.lat!, r.lon!);
    const c = markerClass(r);
    present.add(c);
    const key = twinKeyOf(r);
    const title = `<title>${esc(tr(r.name))}</title>`;
    marks += `<g class="lm-mm-pt" data-ref="r:${esc(r.id)}" data-key="${esc(key)}">${markerSvg(c, +x.toFixed(3), +y.toFixed(3), u, "") ?? ""}${title}</g>`;
    if (moon && c === "a24" && (r.kind === "region_centro" || !r.kind)) {
      const lbl = SHORT[r.region ?? r.id] ?? SHORT[r.id] ?? tr(r.name);
      const same = lbls.find((l) => Math.hypot(l.x - x, l.y - y) < 0.35);
      if (same) { if (!same.text.includes(lbl)) same.text.push(lbl); }
      else lbls.push({ x, y, text: [lbl] });
    }
  }
  const labels = lbls.map(({ x, y, text }) => {
    const right = x >= -1.5;
    return `<text x="${(x + (right ? 7 : -7) * u).toFixed(3)}" y="${(y + 3.5 * u).toFixed(3)}" text-anchor="${right ? "start" : "end"}" class="lm-mm-label" font-size="${(10.5 * u).toFixed(3)}" stroke-width="${(2.6 * u).toFixed(3)}">${esc(text.join(" / "))}</text>`;
  }).join("");
  const svg = `<svg class="lm-mm-svg ${moon ? "moon" : "mars"}" viewBox="${vb.join(" ")}" role="img" aria-label="${esc(t(`lm.refsMapLabel.${body}`))}">
    ${moon ? `<defs><clipPath id="mm-clip"><circle r="${MOON_VIEW}"/></clipPath></defs><g clip-path="url(#mm-clip)">${img}</g>` : img}
    ${grat}<g class="lm-mm-fine">${fine}</g><g class="lm-mm-marks">${marks}</g><g class="lm-mm-sel" id="mm-sel"></g><g aria-hidden="true">${labels}</g></svg>`;

  const lg: [string, string][] = [];
  if (moon) {
    if (present.has("a24") || present.has("a24t")) lg.push([legendSwatch("a24"), codeText("lm.grp.", POINTS.some((p) => p.group === "artemis_2024") ? "artemis_2024" : "none")]);
    if (present.has("a22")) lg.push([legendSwatch("a22"), codeText("lm.grp.", "artemis_2022_retirada")]);
    if (present.has("site")) lg.push([legendSwatch("site"), codeText("lm.grp.", "sitios_polo_sur")]);
    if (present.has("grid")) lg.push([legendSwatch("grid"), codeText("lm.grp.", "malla_polar")]);
  } else {
    if (present.has("usable")) lg.push([legendSwatch("usable"), t("lm.lg.usable")]);
    if (present.has("mola")) lg.push([legendSwatch("mola"), t("lm.lg.mola")]);
    if (present.has("unusable")) lg.push([legendSwatch("unusable"), t("lm.lg.unusable")]);
  }
  if (fine) lg.push([legendSwatch("fine"), t(moon ? "lm.lg.l1" : "lm.lg.l1mars")]);
  lg.push([legendSwatch("sel"), t("lm.lg.selected")]);

  // Selector accesible: grupos de gemelos y referencias con nombre (sin los puntos de la malla ni las teselas).
  const gkeys = Object.entries(GROUPS).filter(([, g]) => g.body === body).map(([k]) => k);
  const named = l0.filter((r) => { const c = markerClass(r); return c !== "grid" && c !== "a24t"; })
    .sort((a, b) => tr(a.name).localeCompare(tr(b.name), locale()));
  const opts = (gkeys.length
    ? `<optgroup label="${esc(t("lm.refPickGroups"))}">${gkeys.map((k) => `<option value="g:${esc(k)}">${esc(groupName(k))}</option>`).join("")}</optgroup>`
    : "") +
    `<optgroup label="${esc(t("lm.refPickRefs"))}">${named.map((r) => `<option value="r:${esc(r.id)}">${esc(tr(r.name))}</option>`).join("")}</optgroup>`;

  box.innerHTML = `
    <p class="lm-note">${esc(summary)}</p>
    ${outside ? `<p class="lm-note">${esc(t("lm.refsOutside", { n: outside }))}</p>` : ""}
    <table class="lm-table lm-counts"><thead><tr><th scope="col">${t("lm.refsGroup")}</th>${head}</tr></thead><tbody>${body_}</tbody></table>
    <figure class="lm-minimap">${svg}
      <figcaption><ul class="lm-mm-legend">${lg.map(([sw, txt]) => `<li>${sw}<span>${esc(txt)}</span></li>`).join("")}</ul></figcaption>
    </figure>
    <label class="lm-pick"><span>${t("lm.refPick")}</span>
      <select id="ref-pick"><option value="">${esc(t("lm.refPickNone"))}</option>${opts}</select></label>
    <p class="lm-note lm-hint">${t("lm.refPickHint")}</p>
    <div id="ref-detail" class="lm-refdetail" aria-live="polite"></div>`;

  const svgEl = box.querySelector("svg")!;
  svgEl.addEventListener("click", (e) => {
    const g = (e.target as Element).closest<SVGGElement>("[data-ref]");
    if (g?.dataset.ref) selectRef(g.dataset.ref);
  });
  $<HTMLSelectElement>("#ref-pick").addEventListener("change", (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (v) selectRef(v);
  });
  renderRefDetail();
}

function selectRef(sel: string) {
  refSel = sel;
  renderRefDetail();
}

/** Resalta en el minimapa la referencia elegida o todas las L0 de su grupo. */
function highlight(ids: Reference[]) {
  const g = document.getElementById("mm-sel");
  if (!g) return;
  const moon = body === "moon";
  const u = (moon ? 2 * MOON_VIEW : 360) / 400;
  g.innerHTML = ids.filter((r) => r.lat != null && r.lon != null && (!moon || r.lat <= -78)).map((r) => {
    const [x, y] = proj(body, r.lat!, r.lon!);
    const rad = (ids.length > 20 ? 3.4 : 7.5) * u;
    return `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${rad.toFixed(3)}" fill="none" stroke="#000" stroke-opacity=".7" stroke-width="${(3.4 * u).toFixed(3)}"/>` +
      `<circle cx="${x.toFixed(3)}" cy="${y.toFixed(3)}" r="${rad.toFixed(3)}" fill="none" stroke="#fff" stroke-width="${(1.6 * u).toFixed(3)}"/>`;
  }).join("");
}

function qualityText(r: Reference) {
  const q = r.quality;
  const out: string[] = [];
  if (r.usable === false) out.push(t("lm.q.unusable"));
  if (q?.effres_p50 != null) out.push(t("lm.q.effres", { p50: fmt(q.effres_p50, 0), p90: fmt(q.effres_p90, 0) }));
  else if (q?.clase) {
    const v = { r: fmt(q.R400, 2), m: fmt(q.eq1m, 2) };
    out.push(q.clase === "hrsc" ? t("lm.q.hrsc", v) : q.clase === "solo_mola" ? t("lm.q.mola", v) : q.clase);
  }
  if (r.usable_note) out.push(tr(r.usable_note));
  return out.length ? out.join(" ") : t("lm.q.none");
}

function renderRefDetail() {
  const box = document.getElementById("ref-detail");
  if (!box) return;
  const pick = document.getElementById("ref-pick") as HTMLSelectElement | null;
  if (!refSel) { box.innerHTML = ""; highlight([]); if (pick) pick.value = ""; return; }
  const isGroup = refSel.startsWith("g:");
  const id = refSel.slice(2);
  let ref = REFS.get(id);
  if (ref && ref.body !== body) ref = undefined;
  const key = isGroup ? id : ref ? twinKeyOf(ref) : id;
  const group = GROUPS[key];
  if (!ref && !group) { refSel = null; renderRefDetail(); return; }
  if (pick) pick.value = [...pick.options].some((o) => o.value === refSel) ? refSel : "";

  // Referencias L0 del grupo (para resaltarlas) y la principal (la que tiene el mismo id que el grupo).
  const members = DATA.references.filter((r) => r.body === body && !r.group_only && twinKeyOf(r) === key);
  const main = ref && !ref.group_only ? ref : REFS.get(key) && !REFS.get(key)!.group_only ? REFS.get(key)! : null;
  highlight(isGroup ? (members.length ? members : main ? [main] : []) : ref ? [ref] : []);

  const k2 = fmt(windowKm(body, "L2"), 0);
  const nl = group?.n_refs_levels;
  const parts: string[] = [];
  const title = isGroup ? groupName(key) : tr(ref!.name);
  parts.push(`<h3 class="lm-subtitle">${esc(title)}</h3>`);
  const meta: string[] = [];
  const show = isGroup ? main : ref!;
  if (show?.lat != null && show.lon != null) meta.push(coord(show.lat, show.lon));
  if (show?.kind) meta.push(codeText("lm.kind.", show.kind));
  else if (group?.kind) meta.push(codeText("lm.kind.", group.kind));
  if (show?.group) meta.push(codeText("lm.grp.", show.group));
  if (meta.length) parts.push(`<p class="lm-note">${esc(meta.join(" · "))}</p>`);
  const dl: string[] = [];
  if (group) {
    // En la ficha de un grupo el título ya es su nombre: solo el recuento por escala.
    const counts = nl ? esc(t("lm.refCounts", { n0: (nl.L0 ?? 0).toLocaleString(locale()), n1: (nl.L1 ?? 0).toLocaleString(locale()), n2: (nl.L2 ?? 0).toLocaleString(locale()), k2 })) : "";
    const gname = isGroup || groupName(key) === title ? "" : esc(groupName(key));
    if (gname || counts) dl.push(`<dt>${t("lm.refsGroup")}</dt><dd>${gname}${gname && counts ? "<br>" : ""}${counts ? `<small>${counts}</small>` : ""}</dd>`);
  }
  if (key === "malla_polar") dl.push(`<dt>${t("lm.coordQuality")}</dt><dd>${esc(t("lm.gridPoints"))}</dd>`);
  if (show) {
    // v1 no trae calidad ni fuente: esas filas solo aparecen si hay datos.
    if (show.quality || show.usable === false || show.usable_note) dl.push(`<dt>${t("lm.quality")}</dt><dd>${esc(qualityText(show))}</dd>`);
    if (show.coord_quality && key !== "malla_polar") dl.push(`<dt>${t("lm.coordQuality")}</dt><dd>${esc(codeText("lm.cq.", show.coord_quality))}</dd>`);
    const url = safeUrl(show.source_url);
    let host = "";
    try { host = url ? new URL(url).host : ""; } catch { /* URL rara: se muestra tal cual */ }
    // v2: nota de la fuente (larga, en español) plegada; v1: la nota corta del sitio, traducida.
    const noteHtml = show.source_note
      ? `<details class="lm-srcnote"><summary>${t("lm.sourceNote")}</summary><p>${esc(tr(show.source_note))}</p></details>`
      : "";
    const generated = show.coord_quality === "malla_generada" || show.group === "malla_polar";
    const link = url
      ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t("lm.sourceLink")}</a> <small>(${esc(host)})</small>`
      : generated ? esc(t("lm.noSource")) : "";
    if (link || noteHtml) dl.push(`<dt>${t("lm.source")}</dt><dd>${link}${noteHtml}</dd>`);
  }
  if (dl.length) parts.push(`<dl class="lm-dl">${dl.join("")}</dl>`);
  // v1: nota corta del sitio (sin fuente).
  if (show && !show.source_note && show.note) parts.push(`<p class="lm-note lm-refnote">${esc(tr(show.note))}</p>`);
  parts.push(`<h4 class="lm-minihead">${t("lm.refTwins")}</h4><div id="ref-twins"></div>`);
  box.innerHTML = parts.join("");

  const tw = $("#ref-twins");
  const B = DATA.bodies[body];
  const l0 = B.twins?.[key] ?? [];
  const l1 = fineOf(body)?.twins?.[key] ?? [];
  const name = groupName(key);
  tw.append(twinList(l0, `rtwin-${key}`, t("lm.twins30"), true, (k) => t("lm.twinTitle", { k: k + 1, name })));
  tw.append(twinList(l1, `rftwin-${key}`, t("lm.twins10"), false, (k) => `${t("lm.twinTitle", { k: k + 1, name })} · 10 km`));
  if (!l0.length && !l1.length) tw.innerHTML = `<p class="lm-note">${t("lm.noTwins")}</p>`;
}

// ---- historias destacadas -------------------------------------------------------------------
function featuredSite(f: Featured): EarthSite | null {
  const B = DATA.bodies[f.body];
  if (!B || !Number.isFinite(f.lat) || !Number.isFinite(f.lon)) return null;
  const near = (list: EarthSite[], maxKm: number) => {
    let best: EarthSite | null = null;
    let bd = maxKm;
    for (const s of list) {
      const d = distKm(s, f);
      if (d < bd || (best === null && d <= bd)) { best = s; bd = d; } // con empate gana el primero (el del ranking final)
    }
    return best;
  };
  // Primero el ranking final y los gemelos finos (tienen las tres escalas); luego los de 30 km.
  // Siempre cerca del punto de la historia, para que el texto corresponda al sitio mostrado.
  const fine = B.fine ? [...(B.fine.final ?? []), ...(B.fine.final_new ?? []), ...(B.fine.sites ?? []),
    ...Object.values(B.fine.twins ?? {}).flat()] : [];
  return near(fine, 30)
    ?? near(B.twins?.[f.ref] ?? [], 30)
    ?? near([...B.sites, ...Object.values(B.twins ?? {}).flat()], 30);
}

function renderFeatured() {
  const color = BODY_COLOR[body];
  const featured = $("#featured");
  featured.replaceChildren();
  const stories = (Array.isArray(DATA.featured) ? DATA.featured : []).filter((f) => f && f.body === body);
  let firstKey: string | null = null;
  for (const f of stories) {
    const s = featuredSite(f);
    if (!s) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lm-card";
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `${f.tag === "nuevo" ? `<span class="lm-pill new">${t("lm.pill.new")}</span>` : `<span class="lm-pill val">${t("lm.pill.val")}</span>`}
      <b>${esc(tr(f.title))}</b><span class="lm-note">${t("lm.cardNote", { s: pct(s.score), t: pct(s.scores?.terrain) })}</span>`;
    const key = `feat-${f.ref}`;
    const go = register(key, btn, (fly) => select(s, tr(f.title), tr(f.story), fly));
    const icon = L.divIcon({ className: "", iconSize: [30, 30],
      html: `<span class="lm-rank lm-star" style="box-shadow:0 0 0 3px ${color}">★</span>` });
    L.marker([s.lat, s.lon], { icon, zIndexOffset: 1000, title: tr(f.title) }).addTo(baseLayer!).on("click", () => go());
    featured.append(btn);
    firstKey ??= key;
  }
  $("#featured-h").hidden = !firstKey;
  featured.hidden = !firstKey;
  return firstKey;
}

// ---- validación ---------------------------------------------------------------------------------
function renderValidation() {
  const v = (DATA.validation ?? []).filter((x) => x.body === body);
  const nw = (DATA.validation_no_window ?? []).filter((x) => x.body === body);
  const v2 = v.some((x) => x.after != null || x.before != null || "fine" in x);
  const table = $("#validation");
  table.classList.toggle("lm-valid3", v2);
  if (!v2) {
    table.innerHTML = `<thead><tr><th scope="col">${t("lm.knownAnalog")}</th><th scope="col">${t("lm.percentile")}</th></tr></thead><tbody>` +
      v.map((x) => `<tr><th scope="row">${esc(tr(x.name))}</th><td>${fmt(x.percentile, 0)}</td></tr>`).join("") +
      nw.map((x) => `<tr><th scope="row">${esc(tr(x.name))}</th><td class="lm-nowin">${esc(tr(x.note) || t("lm.noWindow"))}</td></tr>`).join("") + "</tbody>";
    $("#validation-note").textContent = t("lm.validationNote");
    return;
  }
  const delta = (d: number | null | undefined) =>
    d == null || !Number.isFinite(d) || Math.abs(d) < 0.05 ? "" : ` <small class="${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${fmt(Math.abs(d), 1)}</small>`;
  table.innerHTML = `<thead><tr><th scope="col">${t("lm.knownAnalog")}</th><th scope="col">${t("lm.before")}</th>` +
    `<th scope="col">${t("lm.after")}</th><th scope="col">${t("lm.fine")}</th></tr></thead><tbody>` +
    v.map((x) => `<tr><th scope="row">${esc(tr(x.name))}</th><td>${fmt(x.before, 0)}</td><td>${fmt(x.after ?? x.percentile, 0)}${delta(x.delta)}</td><td>${fmt(x.fine, 0)}</td></tr>`).join("") +
    nw.map((x) => `<tr><th scope="row">${esc(tr(x.name))}</th><td colspan="3" class="lm-nowin">${esc(x.note ? tr(x.note) : t("lm.noWindow"))}</td></tr>`).join("") +
    "</tbody>";
  $("#validation-note").textContent = t("lm.validationNoteV2");
}

// ---- pintado de la pestaña -----------------------------------------------------------------------
function reopen(fallback: string | null = null) {
  const open = (currentKey && openers.get(currentKey)) || (fallback && openers.get(fallback)) ||
    openers.get(`rank-${hasFinal(body) && rankMode !== "l0" ? (rankMode === "new" && newOf(body).length ? "new" : "final") : "l0"}-0`) || openers.values().next().value;
  open?.(false);
}

function render() {
  if (baseLayer) map.removeLayer(baseLayer);
  baseLayer = L.layerGroup().addTo(map);
  openers.clear();
  selectedEl = null;
  if (heatBody !== body) {
    if (heatLayer) map.removeLayer(heatLayer);
    heatLayer = L.layerGroup().addTo(map);
    heatBody = body;
    const color = BODY_COLOR[body];
    for (const [la, lo, s] of DATA.bodies[body].heat ?? []) {
      L.circleMarker([la, lo], {
        radius: 2.5, stroke: false, fillColor: color, fillOpacity: 0.15 + 0.5 * s, interactive: false,
      }).addTo(heatLayer);
    }
  }
  renderRanking();
  renderTwins();
  renderRefs();
  const firstFeatured = renderFeatured();
  renderValidation();
  $("#lm-results").hidden = false;
  // Reabre lo que estaba abierto (cambio de idioma) o, si no, la primera historia destacada / el n.º 1.
  reopen(firstFeatured);
}

// ---- detalle de un sitio ---------------------------------------------------------------------------
function bar(label: string, v: number | null | undefined, color: string) {
  const val = v == null || !Number.isFinite(v) ? 0 : Math.max(0, v);
  return `<div class="lm-bar"><span>${label}</span><i style="--v:${val};--c:${color}"></i><b>${pct(v)}</b></div>`;
}

/** Ventanas de un sitio en cada nivel (centro en la Tierra y referencia con la que se compara). */
function siteWindows(s: EarthSite): Partial<Record<Level, Win>> {
  const out: Partial<Record<Level, Win>> = {};
  const lv = siteLevel(s);
  const lvls = s.levels ?? {};
  if (lv === "L0") out.L0 = { lat: s.lat, lon: s.lon, best_ref: s.best_ref };
  else {
    const w1 = lvls.L1 ?? (lv === "L1" ? { lat: s.lat, lon: s.lon } : null);
    const found = w1 ? L1_PARENT.get(`${body}|${key4(w1.lat, w1.lon)}`) : undefined;
    const parent = lvls.L0 ?? s.parent_L0 ?? found?.parent ?? null;
    let ref = s.best_ref_L0 ?? parent?.best_ref ?? found?.ref ?? null;
    if (!ref && s.twin_key && REFS.get(s.twin_key)?.features) ref = s.twin_key;
    if (parent && Number.isFinite(parent.lat)) out.L0 = { lat: parent.lat, lon: parent.lon, best_ref: ref };
  }
  const w1 = lvls.L1 ?? (lv === "L1" ? { lat: s.lat, lon: s.lon } : null);
  if (w1) out.L1 = { lat: w1.lat, lon: w1.lon, best_ref: s.best_ref_L1 ?? w1.best_ref ?? (lv === "L1" ? s.best_ref : null) };
  const w2 = lvls.L2 ?? s.l2 ?? (lv === "L2" ? { lat: s.lat, lon: s.lon } : null);
  if (w2) out.L2 = { lat: w2.lat, lon: w2.lon, best_ref: s.best_ref_L2 ?? w2.best_ref ?? null, hirise: w2.hirise ?? s.hirise ?? null };
  return out;
}

/** Último modo y escala de la comparación lado a lado; se mantienen entre sitios. */
let cmpMode: "relief" | "real" = "relief";
let cmpLevel: Level = "L2";

function featText(k: string, v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "—";
  if (k === "curv_p90" || (Math.abs(v) > 0 && Math.abs(v) < 0.01)) {
    const e = v.toExponential(1);
    return getLang() === "es" ? e.replace(".", ",") : e;
  }
  const d = k.startsWith("frac") || k === "pit_frac" || k === "hypso" ? 2 : k === "relief" || k === "rough_1km" ? 0 : 1;
  return fmt(v, d);
}

function scopeText(scope: string | null | undefined) {
  if (!scope) return "";
  const [kind, val] = scope.split(":");
  if (kind === "todas") return t("lm.scope.all");
  if (kind === "categoria" && val) return t("lm.scope.cat", { c: codeText("lm.grp.", val) });
  if ((kind === "region" || kind === "parent") && val) return t("lm.scope.region", { name: groupName(val) });
  return scope;
}

function literatureHtml(s: EarthSite) {
  if (!("literature" in s)) return "";
  const lit = s.literature;
  const st = lit?.status ?? "no_verificado";
  const url = safeUrl(lit?.url);
  const note = lit?.note ? `<span class="lm-note">${esc(tr(lit.note))}</span>` : "";
  const name = lit?.name ? ` · ${esc(tr(lit.name))}` : "";
  const dist = lit?.km != null ? ` <small>(${esc(t("lm.lit.km", { km: fmt(lit.km, 0) }))})</small>` : "";
  let head: string;
  let cls: string;
  if (st === "ya_estudiado") { head = t("lm.lit.known"); cls = "known"; }
  else if (st === "no_encontrado") { head = t("lm.lit.none"); cls = "none"; }
  else { head = t("lm.lit.unverified"); cls = "unverified"; }
  return `<h3 class="lm-subtitle">${t("lm.lit")}</h3>
    <div class="lm-lit ${cls}"><b>${esc(head)}</b>${name}${dist}${note}${url ? ` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t("lm.lit.link")}</a>` : ""}</div>`;
}

/** Robustez frente a los pesos (rank.weight_sensitivity): % de combinaciones en que sigue en el top 10. */
function robustHtml(s: EarthSite) {
  const r = s.robust?.final_new ?? s.robust?.final;
  const n = DATA.weight_sensitivity?.n_combos;
  if (!r || !n) return "";
  return `<p class="lm-note">${esc(t("lm.robust", { p: pct(r.top10_frac), n, a: r.best, b: r.worst }))}</p>`;
}

function select(s: EarthSite, title: string, story: string | null = null, fly = true) {
  const lv = siteLevel(s);
  const wins = siteWindows(s);
  const avail = LEVELS.filter((l) => wins[l]);
  if (!wins[cmpLevel]) cmpLevel = avail[avail.length - 1] ?? "L0";
  const mainRef = REFS.get(s.best_ref) ?? (wins.L0?.best_ref ? REFS.get(wins.L0.best_ref) : undefined);
  const name = likeName(s) || (mainRef ? tr(mainRef.name) : "—");
  if (fly) {
    const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.flyTo([s.lat, s.lon], 8, { animate, duration: 1.2 });
    $("#detail").scrollIntoView({ block: "start", behavior: animate ? "smooth" : "instant" });
  }

  // Tabla de rasgos: los del nivel del sitio, con sus etiquetas (la rugosidad cambia de escala).
  const labels = levelInfo(body, lv)?.feature_labels ?? DATA.feature_labels;
  const here: Features = { ...(s.features ?? {}), ...(s.shape ?? {}) };
  const refHere = REFS.get(wins[lv]?.best_ref ?? (lv === "L0" ? s.best_ref : "") ?? "");
  const there: Features | null = refHere?.features ? { ...refHere.features, ...(refHere.shape ?? {}) } : null;
  const rows = Object.keys(labels).filter((k) => here[k] != null || there?.[k] != null).map((k) =>
    `<tr><th scope="row">${esc(tr(labels[k]))}</th><td>${featText(k, here[k])}</td><td>${featText(k, there?.[k])}</td></tr>`).join("");

  const c = s.climate;
  const cp = s.climate_parts;
  const cov = s.cover;
  const ok: string[] = [];
  const no: string[] = [];
  const terrain = s.scores?.terrain ?? 0;
  if (terrain >= 0.5) ok.push(t("lm.ok.terrain", { name: esc(name), v: pct(terrain) }));
  else no.push(t("lm.no.terrain", { name: esc(name), v: pct(terrain) }));
  if (cov) (cov.bare + cov.snow_ice >= 0.8 ? ok : no).push(t("lm.cover", { bare: pct(cov.bare), ice: pct(cov.snow_ice) }));
  else if (s.surface_assumed) no.push(t("lm.noCover"));
  if (c && cp) {
    (cp.cold >= 0.5 ? ok : no).push(t("lm.temp", { m: fmt(c.t_mean), min: fmt(c.t_min) }));
    (cp.dry >= 0.5 ? ok : no).push(t("lm.rain", { v: fmt(c.precip_year, 0) }));
    (cp.swing >= 0.5 ? ok : no).push(t("lm.swing", { v: fmt(c.diurnal_range) }));
  }

  const sc = s.scores ?? ({} as Scores);
  const hasLevels = sc.terrain_L0 !== undefined || sc.terrain_L1 !== undefined || sc.terrain_L2 !== undefined;
  const levelBars = hasLevels ? `<p class="lm-minihead">${t("lm.terrainLevels")}</p>
    <div class="lm-bars lm-bars-lv">${LEVELS.map((l) => bar(t("lm.levelBar", { km: fmt(windowKm(body, l), 0), lv: l }), sc[`terrain_${l}` as const], "var(--info)")).join("")}</div>` : "";
  const levelBtns = avail.length > 1 ? `<div class="lm-seg lm-cmp-levels" role="group" aria-label="${t("lm.cmpLevel")}">${avail.map((l) =>
    `<button type="button" data-lv="${l}" aria-pressed="${l === cmpLevel}">${fmt(windowKm(body, l), 0)} km</button>`).join("")}</div>` : "";

  $("#detail").innerHTML = `
    <h2>${esc(title)}</h2>
    <p class="lm-note">${coord(s.lat, s.lon, 3)}${s.elev_mean != null ? ` · ${t("lm.altitude", { v: fmt(s.elev_mean, 0) })}` : ""} ·
      ${s.known_analog ? t("lm.nearKnown", { name: esc(tr(s.known_analog)) }) : isReviewedNew(s) ? t("lm.notStudied") : t("lm.notReviewed")}</p>
    ${story ? `<p class="lm-story">${esc(story)}</p>` : ""}
    <div class="lm-bars">
      ${bar(t("lm.bar.total"), s.score, "var(--body)")}
      ${bar(t("lm.bar.terrain"), sc.terrain, "var(--info)")}
      ${bar(t("lm.bar.surface"), sc.surface, "var(--warn)")}
      ${bar(t("lm.bar.climate"), sc.climate, "var(--ok)")}
    </div>
    ${levelBars}
    ${robustHtml(s)}
    <div class="lm-compare">
      <div class="lm-cmp-modes" role="group" aria-label="${t("lm.cmpLabel")}">
        <button type="button" data-cmp="relief" aria-pressed="${cmpMode === "relief"}">${t("lm.cmpRelief")}</button>
        <button type="button" data-cmp="real" aria-pressed="${cmpMode === "real"}">${t("lm.cmpReal")}</button>
      </div>
      ${levelBtns}
      <div class="lm-cmp-grid" id="cmp"></div>
      <div class="lm-scale" id="cmp-scale"><i></i><span></span></div>
      <p class="lm-cmp-info" id="cmp-info"></p>
    </div>
    <ul class="lm-why">${ok.map((x) => `<li class="ok">${x}</li>`).join("")}${no.map((x) => `<li class="no">${x}</li>`).join("")}</ul>
    <table class="lm-table">
      <thead><tr><th scope="col">${t("lm.terrainWindowKm", { km: fmt(windowKm(body, lv), 0) })}</th><th scope="col">${t("lm.here")}</th><th scope="col">${bodyName(body)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${!there && rows ? `<p class="lm-note">${t("lm.noRefFeatures")}</p>` : ""}
    ${refHere?.note ? `<p class="lm-note"><b>${esc(tr(refHere.name))}</b>: ${esc(tr(refHere.note))}</p>` : ""}
    ${literatureHtml(s)}
    <h3 class="lm-subtitle">${t("lm.breaks")}</h3>
    <ul class="lm-why">${LIMITS[getLang()][body].map((x) => `<li class="no">${x}</li>`).join("")}</ul>`;

  const modes = document.querySelectorAll<HTMLButtonElement>("[data-cmp]");
  for (const b of modes) {
    b.addEventListener("click", () => {
      for (const x of modes) x.setAttribute("aria-pressed", String(x === b));
      cmpMode = b.dataset.cmp as "relief" | "real";
      showCompare(s, wins, cmpLevel, cmpMode);
    });
  }
  const lvBtns = document.querySelectorAll<HTMLButtonElement>("[data-lv]");
  for (const b of lvBtns) {
    b.addEventListener("click", () => {
      for (const x of lvBtns) x.setAttribute("aria-pressed", String(x === b));
      cmpLevel = b.dataset.lv as Level;
      showCompare(s, wins, cmpLevel, cmpMode);
    });
  }
  showCompare(s, wins, cmpLevel, cmpMode);
}

// ---- comparación lado a lado -------------------------------------------------------------------------
let miniMaps: L.Map[] = [];
const rel = (name: string) => `${BASE}relieve/${name}`;

/** Imágenes candidatas (la primera que exista): nombres v2 por nivel y, en L0, los de v1 como respaldo. */
function earthUrls(w: Win, lv: Level) {
  const la = w.lat.toFixed(4);
  const lo = w.lon.toFixed(4);
  const out = [rel(`e_${la}_${lo}_${lv}_${IMAGE_PX[body][lv]}m.png`)];
  if (lv === "L0") out.push(rel(`e_${la}_${lo}.png`));
  return out;
}
function refUrls(w: Win, lv: Level) {
  const id = w.best_ref;
  const out: string[] = [];
  if (lv === "L2" && body === "mars") {
    const ids = [w.hirise, id, id?.replace(/^hirise_/i, "")].filter((x): x is string => !!x);
    for (const x of new Set(ids)) out.push(rel(`ref_${x}_L2.png`));
    return out;
  }
  if (!id) return out;
  out.push(rel(`ref_${id}_${lv}.png`));
  if (lv === "L0") out.push(rel(`ref_${id}.png`));
  return out;
}
/** <img> que prueba las URL en orden y, si ninguna existe, muestra el aviso de imagen no generada. */
function fallbackImg(urls: string[], alt: string, onFallback?: (i: number) => void) {
  if (!urls.length) {
    const d = document.createElement("div");
    d.className = "lm-mini lm-empty";
    d.textContent = t("lm.noImage");
    return d;
  }
  const img = document.createElement("img");
  img.alt = alt;
  img.decoding = "async";
  let i = 0;
  img.addEventListener("error", () => {
    i++;
    if (i < urls.length) { img.src = urls[i]; onFallback?.(i); return; }
    const d = document.createElement("div");
    d.className = "lm-mini lm-empty";
    d.textContent = t("lm.noImage");
    img.replaceWith(d);
  });
  img.src = urls[0];
  return img;
}

function boxBounds(lat: number, lon: number, radiusKm: number, halfKm: number): L.LatLngBoundsExpression {
  const dLat = halfKm / (Math.PI * radiusKm / 180);
  const dLon = dLat / Math.max(Math.cos(lat * Math.PI / 180), 0.01);
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]];
}
const NICE_KM = [0.2, 0.5, 1, 2, 5, 10, 20];

function showCompare(s: EarthSite, wins: Partial<Record<Level, Win>>, lv: Level, mode: "relief" | "real") {
  for (const m of miniMaps) m.remove();
  miniMaps = [];
  const grid = $("#cmp");
  const scale = $("#cmp-scale");
  const info = $("#cmp-info");
  const w = wins[lv];
  grid.replaceChildren();
  if (!w) {
    grid.innerHTML = `<div class="lm-mini lm-empty">${t("lm.noImage")}</div>`;
    scale.hidden = true;
    info.textContent = "";
    return;
  }
  const W = windowKm(body, lv);
  const twinKey = s.twin_key ?? (lv === "L0" && w.best_ref ? twinKeyOf(REFS.get(w.best_ref) ?? { id: w.best_ref } as Reference) : null);
  const refName = refLabel(lv === "L2" && body === "mars" && w.hirise ? `hirise_${w.hirise}` : w.best_ref, twinKey);
  const capE = document.createElement("figcaption");
  capE.innerHTML = `<b>${t("planet.earth")}</b> · ${coord(w.lat, w.lon)}`;
  const capR = document.createElement("figcaption");
  capR.innerHTML = `<b>${bodyName(body)}</b> · ${esc(refName)}`;
  const figE = document.createElement("figure");
  const figR = document.createElement("figure");

  // Texto de escala y fuente del dato de este nivel.
  const li = levelInfo(body, lv);
  const refData = w.best_ref && REFS.get(w.best_ref)?.dem === "sldem" ? t("lm.sldemData") : li?.ref_data;
  const lines: string[] = [];
  if (li?.px_m != null) {
    lines.push(t("lm.cmpWindow", { w: fmt(W, 0), p: fmt(li.px_m, 0) }));
  }
  if (li?.earth_data || refData) {
    lines.push(t("lm.cmpData", { earth: tr(li?.earth_data ?? "—"), body: bodyName(body), ref: tr(refData ?? "—") }));
  }
  if (lv === "L2" && s.l2_scope) lines.push(t("lm.scope", { km: fmt(W, 0), s: scopeText(s.l2_scope) }));
  info.innerHTML = lines.map((x) => `<span>${esc(x)}</span>`).join("");
  // Píxel de la imagen de relieve, si no coincide con el de la medida (L0: 400 m de medida, imagen a 120/200 m).
  const imgPx = (p: number) => {
    if (!li?.px_m || mode !== "relief" || !info.firstElementChild) return;
    let sp = info.querySelector<HTMLElement>(".lm-imgpx");
    if (p === li.px_m) { sp?.remove(); return; }
    if (!sp) { sp = document.createElement("small"); sp.className = "lm-imgpx"; info.firstElementChild.append(sp); }
    sp.textContent = t("lm.cmpImgPx", { p: fmt(p, 0) });
  };
  imgPx(IMAGE_PX[body][lv]);

  if (mode === "relief") {
    const bk = [...NICE_KM].reverse().find((x) => x <= W / 2.5) ?? W / 4;
    scale.hidden = false;
    scale.querySelector("i")!.setAttribute("style", `width:calc((100% - 8px) / 2 * ${bk / W})`);
    scale.querySelector("span")!.textContent = t("lm.scaleKm", { bar: km(bk), w: fmt(W, 0) });
    // Respaldo v1 (e_<lat>_<lon>.png): 30 km a 100 m por píxel.
    figE.append(fallbackImg(earthUrls(w, lv), t("lm.altEarth"), (i) => { if (i > 0) imgPx(100); }), capE);
    figR.append(fallbackImg(refUrls(w, lv), t("lm.altRef", { name: refName })), capR);
    grid.append(figE, figR);
    return;
  }
  scale.hidden = true;
  const mE = document.createElement("div");
  mE.className = "lm-mini";
  figE.append(mE, capE);
  const mR = document.createElement("div");
  mR.className = "lm-mini";
  figR.append(mR, capR);
  grid.append(figE, figR);
  const opts: L.MapOptions = { zoomControl: false, attributionControl: false, zoomSnap: 0 };
  const earth = L.map(mE, opts);
  L.tileLayer(EARTH_TILES, { maxZoom: 17 }).addTo(earth);
  earth.fitBounds(boxBounds(w.lat, w.lon, EARTH_RADIUS_KM, W / 2));
  miniMaps.push(earth);
  const rid = lv === "L2" && w.hirise ? `hirise_${w.hirise}` : w.best_ref;
  const r = rid ? REFS.get(rid) ?? POINT_BY_ID.get(rid) ?? (w.best_ref ? REFS.get(w.best_ref) ?? POINT_BY_ID.get(w.best_ref) : undefined) : undefined;
  if (body === "mars" && r?.lat != null && r.lon != null) {
    const mars = L.map(mR, { ...opts, crs: L.CRS.EPSG4326 });
    L.tileLayer(MARS_TILES, { tileSize: 512, zoomOffset: -1, minZoom: 1, maxZoom: 18, maxNativeZoom: 18 }).addTo(mars);
    mars.fitBounds(boxBounds(r.lat, r.lon, MARS_RADIUS_KM, W / 2));
    miniMaps.push(mars);
  } else {
    mR.classList.add("lm-empty");
    mR.textContent = body === "moon" ? t("lm.noMoonMosaic") : t("lm.noImage");
  }
}

// ---- pestañas Luna / Marte -----------------------------------------------------------------------------
const tabs = document.querySelectorAll<HTMLButtonElement>("[data-body]");
function setBody(next: Body) {
  body = next;
  currentKey = null;
  refSel = null;
  openGroups.clear();
  for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.body === body));
  document.documentElement.dataset.body = body;
  render();
}
for (const tab of tabs) tab.addEventListener("click", () => setBody(tab.dataset.body as Body));
renderMapText();
setBody(new URLSearchParams(location.search).get("cuerpo") === "marte" ? "mars" : "moon");

// Cambio de idioma: se repinta todo lo generado y se reabre el mismo sitio sin mover el mapa.
onLangChange(() => {
  renderMapText();
  render();
});
