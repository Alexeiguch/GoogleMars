// Vista 2D global: análogos terrestres de la Luna (polo sur) y de Marte en ventanas de 30 km.
// Datos: src/data/results.json (pipeline/analogs/rank.py). Relieve: public/relieve/ (relief_images.py).
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./lunaMarte.css";
import "./prefs";
import L from "leaflet";
import { getLang, locale, onLangChange, t, tr, type Lang } from "./i18n";
import rawResults from "./data/results.json";

type Body = "moon" | "mars";
type Features = Record<string, number>;
type Reference = { id: string; body: Body; name: string; lat: number; lon: number; note: string; features: Features };
type EarthSite = {
  lat: number; lon: number; elev_mean: number; score: number;
  scores: { terrain: number; surface: number; climate: number };
  climate_parts: { cold: number; dry: number; swing: number };
  climate: { t_mean: number; t_min: number; t_max: number; diurnal_range: number; precip_year: number };
  best_ref: string; features: Features;
  cover: { bare: number; snow_ice: number } | null;
  surface_assumed: boolean; known_analog: string | null;
};
type Featured = { body: Body; ref: string; lat: number; lon: number; tag: string; title: string; story: string };
type Results = {
  references: Reference[];
  feature_labels: Record<string, string>;
  version?: number;
  groups?: Record<string, { name: string }>;
  bodies: Record<Body, { sites: EarthSite[]; twins: Record<string, EarthSite[]>; heat: [number, number, number][] }>;
  validation: { body: Body; name: string; percentile: number }[];
  featured: Featured[];
};

const DATA = rawResults as unknown as Results;
const BASE = import.meta.env.BASE_URL;
// Colores de los marcadores sobre la imagen de satélite: iguales en tema claro y oscuro.
const BODY_COLOR: Record<Body, string> = { moon: "#c9d1e0", mars: "#d69a70" };
const bodyName = (b: Body) => t(b === "moon" ? "planet.moon" : "planet.mars");
const EARTH_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
// Mosaico CTX global de Marte (~5 m/píxel), Caltech Murray Lab vía Esri. Va en EPSG:4326 con teselas de 512 px.
const MARS_TILES = "https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/{z}/{y}/{x}";
const EARTH_RADIUS_KM = 6371;
const MARS_RADIUS_KM = 3389.5;
const HALF_KM = 15;

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

const fmt = (v: number | null | undefined, d = 1) =>
  v == null ? "—" : Number(v).toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number) => Math.round(v * 100);
/** Coordenadas en el formato del idioma: "29,50° S · 69,51° O" / "29.50° S · 69.51° W". */
const coord = (lat: number, lon: number, d = 2) =>
  `${fmt(Math.abs(lat), d)}° ${lat < 0 ? "S" : "N"} · ${fmt(Math.abs(lon), d)}° ${lon < 0 ? (getLang() === "es" ? "O" : "W") : "E"}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const refsById = new Map(DATA.references.map((ref) => [ref.id, ref]));
const refById = (id: string) => refsById.get(id)!;
const refName = (ref: Reference) => tr(ref.name);
const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// ---- mapa principal ---------------------------------------------------------
let body: Body = "moon";
let layer: L.LayerGroup | undefined;
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
  legendBox.innerHTML = t("lm.legend");
  const next = t("lm.attribution");
  if (next !== attribution) {
    map.attributionControl.removeAttribution(attribution).addAttribution(next);
    attribution = next;
  }
}
renderMapText();

let selectedEl: HTMLElement | null = null;
function markActive(el: HTMLElement | null) {
  selectedEl?.setAttribute("aria-pressed", "false");
  selectedEl = el;
  el?.setAttribute("aria-pressed", "true");
}

const pill = (s: EarthSite) => s.known_analog
  ? `<span class="lm-pill known">${t("lm.pill.known")}</span>`
  : `<span class="lm-pill new">${t("lm.pill.new")}</span>`;

function featuredSite(f: Featured) {
  const twins = DATA.bodies[f.body].twins[f.ref] ?? [];
  let best: EarthSite | null = null;
  for (const s of twins) {
    if (!best || Math.hypot(s.lat - f.lat, s.lon - f.lon) < Math.hypot(best.lat - f.lat, best.lon - f.lon)) best = s;
  }
  return best;
}

function listItem(s: EarthSite, badge: string, subtitle: string) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-pressed", "false");
  button.innerHTML = `${badge}
    <span class="lm-name">${coord(s.lat, s.lon)}<small>${esc(subtitle)}</small></span>
    <span class="lm-score"><b>${pct(s.score)}</b>${pill(s)}</span>`;
  li.append(button);
  return { li, button };
}

/** Elemento abierto en el detalle (p. ej. "rank-0", "twin-shackleton-1", "feat-jezero"). Se conserva al cambiar de idioma. */
let currentKey: string | null = null;

const rankBadge = (n: number | string, color: string, outline = false) => outline
  ? `<span class="lm-rank" style="border:2px solid ${color};color:${color}">${n}</span>`
  : `<span class="lm-rank" style="background:${color}">${n}</span>`;

function render() {
  if (layer) map.removeLayer(layer);
  layer = L.layerGroup().addTo(map);
  const color = BODY_COLOR[body];
  const B = DATA.bodies[body];
  if (heatBody !== body) {
    if (heatLayer) map.removeLayer(heatLayer);
    heatLayer = L.layerGroup().addTo(map);
    heatBody = body;
    for (const [la, lo, s] of B.heat) {
      L.circleMarker([la, lo], {
        radius: 2.5, stroke: false, fillColor: color, fillOpacity: 0.15 + 0.5 * s, interactive: false,
      }).addTo(heatLayer);
    }
  }

  // Cada elemento abrible se registra con una clave estable para poder reabrirlo tras cambiar de idioma.
  const openers = new Map<string, (fly?: boolean) => void>();
  const register = (key: string, el: HTMLElement, open: (fly: boolean) => void) => {
    const go = (fly = true) => { markActive(el); currentKey = key; open(fly); };
    el.addEventListener("click", () => go());
    openers.set(key, go);
    return go;
  };

  // ranking general
  const ranking = $("#ranking");
  ranking.replaceChildren();
  B.sites.forEach((s, i) => {
    const title = t("lm.rankTitle", { n: i + 1 });
    const { li, button } = listItem(s, rankBadge(i + 1, color), t("lm.similarTo", { name: refName(refById(s.best_ref)) }));
    const go = register(`rank-${i}`, button, (fly) => select(s, title, null, fly));
    const icon = L.divIcon({ className: "", iconSize: [24, 24], html: rankBadge(i + 1, color) });
    L.marker([s.lat, s.lon], { icon, title: `${title} · ${coord(s.lat, s.lon)}` }).addTo(layer!)
      .on("click", () => go());
    ranking.append(li);
  });

  // gemelos: los 3 mejores lugares de la Tierra para cada sitio de referencia
  const twins = $("#twins");
  twins.replaceChildren();
  for (const [rid, list] of Object.entries(B.twins)) {
    const name = DATA.groups?.[rid]?.name ?? refById(rid).name;
    const head = document.createElement("h3");
    head.className = "lm-refname";
    head.textContent = tr(name);
    const ol = document.createElement("ol");
    ol.className = "lm-list";
    list.forEach((s, k) => {
      const { li, button } = listItem(s, rankBadge(k + 1, color, true), tr(s.known_analog) ?? t("lm.noStudies"));
      register(`twin-${rid}-${k}`, button, (fly) => select(s, t("lm.twinTitle", { k: k + 1, name: tr(name) }), null, fly));
      ol.append(li);
    });
    twins.append(head, ol);
  }

  // historias destacadas
  const featured = $("#featured");
  featured.replaceChildren();
  const stories = DATA.featured.filter((f) => f.body === body);
  let firstKey: string | null = null;
  for (const f of stories) {
    const s = featuredSite(f);
    if (!s) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lm-card";
    btn.setAttribute("aria-pressed", "false");
    btn.innerHTML = `${f.tag === "nuevo" ? `<span class="lm-pill new">${t("lm.pill.new")}</span>` : `<span class="lm-pill val">${t("lm.pill.val")}</span>`}
      <b>${esc(tr(f.title))}</b><span class="lm-note">${t("lm.cardNote", { s: pct(s.score), t: pct(s.scores.terrain) })}</span>`;
    const key = `feat-${f.ref}`;
    const go = register(key, btn, (fly) => select(s, tr(f.title), tr(f.story), fly));
    const icon = L.divIcon({ className: "", iconSize: [30, 30],
      html: `<span class="lm-rank lm-star" style="box-shadow:0 0 0 3px ${color}">★</span>` });
    L.marker([s.lat, s.lon], { icon, zIndexOffset: 1000, title: tr(f.title) }).addTo(layer).on("click", () => go());
    featured.append(btn);
    firstKey ??= key;
  }

  const v = DATA.validation.filter((x) => x.body === body);
  $("#validation").innerHTML = `<thead><tr><th scope="col">${t("lm.knownAnalog")}</th><th scope="col">${t("lm.percentile")}</th></tr></thead><tbody>` +
    v.map((x) => `<tr><td>${esc(tr(x.name))}</td><td>${fmt(x.percentile, 0)}</td></tr>`).join("") + "</tbody>";

  // Reabre lo que estaba abierto (cambio de idioma) o, si no, la primera historia destacada / el n.º 1.
  const open = (currentKey && openers.get(currentKey)) || (firstKey && openers.get(firstKey)) || openers.get("rank-0");
  open?.(false);
  $("#lm-results").hidden = false;
}

function bar(label: string, v: number, color: string) {
  return `<div class="lm-bar"><span>${label}</span><i style="--v:${Math.max(0, v)};--c:${color}"></i><b>${pct(v)}</b></div>`;
}

/** Último modo de la comparación lado a lado; se mantiene entre sitios. */
let cmpMode: "relief" | "real" = "relief";

function select(s: EarthSite, title: string, story: string | null = null, fly = true) {
  const ref = refById(s.best_ref);
  const name = refName(ref);
  if (fly) {
    map.flyTo([s.lat, s.lon], 8, { duration: 1.2 });
    $("#panel").scrollTo({ top: $("#detail").offsetTop - $("#panel").offsetTop - 8, behavior: "smooth" });
  }
  const labels = DATA.feature_labels;
  const rows = Object.keys(labels).map((k) => {
    const d = k.startsWith("frac") ? 2 : (k === "relief" || k === "rough_1km" ? 0 : 1);
    return `<tr><th scope="row">${esc(tr(labels[k]))}</th><td>${fmt(s.features[k], d)}</td><td>${fmt(ref.features[k], d)}</td></tr>`;
  }).join("");
  const c = s.climate;
  const cov = s.cover;
  const ok: string[] = [];
  const no: string[] = [];
  if (s.scores.terrain >= 0.5) ok.push(t("lm.ok.terrain", { name: esc(name), v: pct(s.scores.terrain) }));
  else no.push(t("lm.no.terrain", { name: esc(name), v: pct(s.scores.terrain) }));
  if (cov) {
    (cov.bare + cov.snow_ice >= 0.8 ? ok : no).push(t("lm.cover", { bare: pct(cov.bare), ice: pct(cov.snow_ice) }));
  } else if (s.surface_assumed) no.push(t("lm.noCover"));
  (s.climate_parts.cold >= 0.5 ? ok : no).push(t("lm.temp", { m: fmt(c.t_mean), min: fmt(c.t_min) }));
  (s.climate_parts.dry >= 0.5 ? ok : no).push(t("lm.rain", { v: fmt(c.precip_year, 0) }));
  (s.climate_parts.swing >= 0.5 ? ok : no).push(t("lm.swing", { v: fmt(c.diurnal_range) }));

  $("#detail").innerHTML = `
    <h2>${esc(title)}</h2>
    <p class="lm-note">${coord(s.lat, s.lon, 3)} · ${t("lm.altitude", { v: fmt(s.elev_mean, 0) })} ·
      ${s.known_analog ? t("lm.nearKnown", { name: esc(tr(s.known_analog)) }) : t("lm.notStudied")}</p>
    ${story ? `<p class="lm-story">${esc(story)}</p>` : ""}
    <div class="lm-bars">
      ${bar(t("lm.bar.total"), s.score, "var(--body)")}
      ${bar(t("lm.bar.terrain"), s.scores.terrain, "var(--info)")}
      ${bar(t("lm.bar.surface"), s.scores.surface, "var(--warn)")}
      ${bar(t("lm.bar.climate"), s.scores.climate, "var(--ok)")}
    </div>
    <div class="lm-compare">
      <div class="lm-cmp-modes" role="group" aria-label="${t("lm.cmpLabel")}">
        <button type="button" data-cmp="relief" aria-pressed="${cmpMode === "relief"}">${t("lm.cmpRelief")}</button>
        <button type="button" data-cmp="real" aria-pressed="${cmpMode === "real"}">${t("lm.cmpReal")}</button>
      </div>
      <div class="lm-cmp-grid" id="cmp"></div>
      <div class="lm-scale" id="cmp-scale"><i></i><span>${t("lm.scale")}</span></div>
    </div>
    <ul class="lm-why">${ok.map((x) => `<li class="ok">${x}</li>`).join("")}${no.map((x) => `<li class="no">${x}</li>`).join("")}</ul>
    <table class="lm-table">
      <thead><tr><th scope="col">${t("lm.terrainWindow")}</th><th scope="col">${t("lm.here")}</th><th scope="col">${bodyName(ref.body)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="lm-note"><b>${esc(name)}</b>: ${esc(tr(ref.note))}</p>
    <h3 class="lm-subtitle">${t("lm.breaks")}</h3>
    <ul class="lm-why">${LIMITS[getLang()][body].map((x) => `<li class="no">${x}</li>`).join("")}</ul>`;

  const modes = document.querySelectorAll<HTMLButtonElement>("[data-cmp]");
  for (const b of modes) {
    b.addEventListener("click", () => {
      for (const x of modes) x.setAttribute("aria-pressed", String(x === b));
      cmpMode = b.dataset.cmp as "relief" | "real";
      showCompare(s, ref, cmpMode);
    });
  }
  showCompare(s, ref, cmpMode);
}

// ---- comparación lado a lado -------------------------------------------------
let miniMaps: L.Map[] = [];
const earthImg = (s: EarthSite, body: Body) => {
  const scale = DATA.version === 2 ? `_L0_${body === "moon" ? 120 : 200}m` : "";
  return `${BASE}relieve/e_${s.lat.toFixed(4)}_${s.lon.toFixed(4)}${scale}.png`;
};

const refImg = (ref: Reference) => `${BASE}relieve/ref_${ref.id}${DATA.version === 2 ? "_L0" : ""}.png`;

function boxBounds(lat: number, lon: number, radiusKm: number): L.LatLngBoundsExpression {
  const dLat = HALF_KM / (Math.PI * radiusKm / 180);
  const dLon = dLat / Math.max(Math.cos(lat * Math.PI / 180), 0.01);
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]];
}

function showCompare(s: EarthSite, ref: Reference, mode: "relief" | "real") {
  for (const m of miniMaps) m.remove();
  miniMaps = [];
  const grid = $("#cmp");
  const capE = `<figcaption><b>${t("planet.earth")}</b> · ${coord(s.lat, s.lon)}</figcaption>`;
  const capR = `<figcaption><b>${bodyName(ref.body)}</b> · ${esc(refName(ref))}</figcaption>`;
  const scale = $("#cmp-scale");
  if (mode === "relief") {
    scale.hidden = false;
    grid.innerHTML = `<figure><img src="${earthImg(s, ref.body)}" alt="${t("lm.altEarth")}">${capE}</figure>
      <figure><img src="${refImg(ref)}" alt="${esc(t("lm.altRef", { name: refName(ref) }))}">${capR}</figure>`;
    for (const img of grid.querySelectorAll("img")) {
      img.addEventListener("error", () => {
        const d = document.createElement("div");
        d.className = "lm-mini lm-empty";
        d.textContent = t("lm.noImage");
        img.replaceWith(d);
      }, { once: true });
    }
    return;
  }
  scale.hidden = true;
  grid.innerHTML = `<figure><div class="lm-mini" id="mini-earth"></div>${capE}</figure>
    <figure><div class="lm-mini" id="mini-ref"></div>${capR}</figure>`;
  const opts: L.MapOptions = { zoomControl: false, attributionControl: false, zoomSnap: 0 };
  const earth = L.map("mini-earth", opts);
  L.tileLayer(EARTH_TILES, { maxZoom: 17 }).addTo(earth);
  earth.fitBounds(boxBounds(s.lat, s.lon, EARTH_RADIUS_KM));
  miniMaps.push(earth);
  if (ref.body === "mars") {
    const mars = L.map("mini-ref", { ...opts, crs: L.CRS.EPSG4326 });
    L.tileLayer(MARS_TILES, { tileSize: 512, zoomOffset: -1, minZoom: 1, maxZoom: 18, maxNativeZoom: 18 }).addTo(mars);
    mars.fitBounds(boxBounds(ref.lat, ref.lon, MARS_RADIUS_KM));
    miniMaps.push(mars);
  } else {
    $("#mini-ref").outerHTML = `<div class="lm-mini lm-empty">${t("lm.noMoonMosaic")}</div>`;
  }
}

// ---- pestañas Luna / Marte ---------------------------------------------------
const tabs = document.querySelectorAll<HTMLButtonElement>("[data-body]");
function setBody(next: Body) {
  body = next;
  currentKey = null;
  for (const tab of tabs) tab.setAttribute("aria-selected", String(tab.dataset.body === body));
  document.documentElement.dataset.body = body;
  render();
}
for (const tab of tabs) tab.addEventListener("click", () => setBody(tab.dataset.body as Body));
setBody(new URLSearchParams(location.search).get("cuerpo") === "marte" ? "mars" : "moon");

// Cambio de idioma: se repinta todo lo generado y se reabre el mismo sitio sin mover el mapa.
onLangChange(() => {
  renderMapText();
  render();
});
