import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "./style.css";
import { bindUiText, type UiText } from "./prefs";
import {
  categoryLabel, cellSize, loadTerrain, marsClimate, metricDefinitions, patchWidth, rankEarthSites, sites, weights,
  type Match, type Site,
} from "./data";
import { createGlobes } from "./globes";
import { decimal, getLang, onLangChange, t, tr } from "./i18n";
import { createViewer, slopeBands, type Mode } from "./viewer";

const marsSites = sites.filter(({ planet }) => planet === "Mars");

// Franja de introducción y títulos de sección: textos propios de esta página (no están en i18n.ts)
// y cifras sacadas del catálogo que ya usa el visor.
const UI_TEXT: UiText = {
  es: {
    "intro.lede": "Elige un sitio de Marte con relieve de alta resolución y busca los lugares de la Tierra cuyo terreno, superficie y clima más se le parecen. Los dos terrenos se comparan en 3D al mismo tamaño y escala.",
    "intro.figMars": "sitios de Marte con relieve HiRISE",
    "intro.figEarth": "parches de la Tierra en el catálogo",
    "intro.figPatch": "por parche, en celdas de {cell} m",
    "step.pick": "Elige un sitio de Marte",
  },
  en: {
    "intro.lede": "Pick a Mars site with high-resolution relief and find the places on Earth whose terrain, surface and climate match it best. Both terrains are compared in 3D at the same size and scale.",
    "intro.figMars": "Mars sites with HiRISE relief",
    "intro.figEarth": "Earth patches in the catalog",
    "intro.figPatch": "per patch, in {cell} m cells",
    "step.pick": "Choose a Mars site",
  },
};
bindUiText(UI_TEXT, { cell: cellSize });
const patchKm = patchWidth / 1000;
document.querySelector("#fig-mars")!.textContent = String(marsSites.length);
document.querySelector("#fig-earth")!.textContent = String(sites.length - marsSites.length);
document.querySelector("#fig-patch")!.textContent = `${patchKm}×${patchKm} km`;
let target = marsSites.find(({ id }) => id === "jezero")!;
let pending: AbortController | undefined;
const picker = document.querySelector<HTMLSelectElement>("#mars-site")!;
const names = new Map<string, number>();
for (const { name } of marsSites) names.set(name, (names.get(name) ?? 0) + 1);

const num = (value: number, digits = 2) => decimal(value, digits);

function coordinate(value: number, positive: string, negative: string) {
  return `${num(Math.abs(value), 3)}° ${value < 0 ? negative : positive}`;
}

function siteCoordinates(site: Site) {
  return `${coordinate(site.latitude, "N", "S")} · ${coordinate(site.longitude, "E", getLang() === "es" ? "O" : "W")}`;
}

function siteLabel(site: Site) {
  return (names.get(site.name) ?? 0) > 1 ? `${site.name} (${siteCoordinates(site)})` : site.name;
}

function renderPicker() {
  const categories = new Map<string, HTMLOptGroupElement>();
  picker.replaceChildren();
  for (const site of marsSites) {
    let group = categories.get(site.category);
    if (!group) {
      group = document.createElement("optgroup");
      group.label = categoryLabel(site.category);
      categories.set(site.category, group);
      picker.append(group);
    }
    group.append(new Option(siteLabel(site), site.id));
  }
  picker.value = target.id;
}

const headings = document.querySelector("#site-headings")!;
const sourceList = document.querySelector("#source-list")!;
const gridScale = document.querySelector("#grid-scale")!;
const results = document.querySelector<HTMLElement>("#results")!;
const comparison = document.querySelector<HTMLElement>("#comparison")!;
const details = document.querySelector<HTMLElement>("#details")!;
const matchList = document.querySelector("#match-list")!;

const sources = [
  ["src.marsElev", "https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/"],
  ["src.earth3dep", sites.find(({ origin }) => origin === "curated")!.sourceUrl],
  ["src.earthGlo30", "https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30"],
  ["src.cover", "https://planetarycomputer.microsoft.com/dataset/esa-worldcover"],
  ["src.climate", "https://www.meteomatics.com/en/weather-api/"],
  ["src.marsImg", "https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m"],
  ["src.earthImg", "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/"],
];

const legend = document.querySelector<HTMLElement>("#legend")!;

/** Textos generados por código que no dependen del sitio elegido. */
function renderChrome() {
  renderPicker();
  gridScale.textContent = t("v.gridScale", { w: patchWidth / 1000, c: cellSize });
  sourceList.replaceChildren(...sources.map(([key, url]) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = url;
    link.textContent = t(key);
    item.append(link);
    return item;
  }));
  legend.innerHTML = `<span>${t("v.slope")}</span>${slopeBands.map(({ label, color }) =>
    `<span><i style="background:${color}" aria-hidden="true"></i>${label}</span>`,
  ).join("")}`;
  document.querySelector("#mars-count")!.textContent = t("v.siteCount", { n: marsSites.length });
  for (const { site, button } of markers) {
    button.title = siteLabel(site);
    button.setAttribute("aria-label", siteLabel(site));
  }
}

const canvas = document.querySelector<HTMLCanvasElement>("#terrain")!;
const terrainButtons = document.querySelectorAll<HTMLButtonElement>(".toolbar button");
let viewer: ReturnType<typeof createViewer> | undefined;
let viewerFailed = false;

const status = document.querySelector<HTMLElement>("#viewer-error")!;
/** Clave del mensaje visible en #viewer-error, para traducirlo si cambia el idioma. */
let statusKey: string | null = null;
function setStatus(key: string | null) {
  statusKey = key;
  status.hidden = key === null;
  if (key) status.textContent = t(key);
}

function showTerrainError() {
  viewerFailed = true;
  setStatus("v.viewerError");
  canvas.hidden = true;
  for (const button of terrainButtons) button.disabled = true;
}

canvas.addEventListener("webglcontextlost", showTerrainError);
const modeButtons = document.querySelectorAll<HTMLButtonElement>("[data-mode]");
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode as Mode;
    viewer?.setMode(mode);
    legend.style.visibility = mode === "slope" ? "visible" : "hidden";
    for (const option of modeButtons) option.setAttribute("aria-pressed", String(option === button));
  });
}
document.querySelector("#top-view")!.addEventListener("click", () => viewer?.setView("top"));
document.querySelector("#reset-view")!.addEventListener("click", () => viewer?.setView("oblique"));

const globeCanvas = document.querySelector<HTMLCanvasElement>("#globes")!;
const pins = document.querySelector("#mars-pins")!;
const markers = marsSites.map((site) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "globe-pin";
  button.hidden = true;
  button.dataset.site = site.id;
  const label = document.createElement("span");
  label.textContent = site.id === "jezero" ? "Jezero" : site.name;
  button.append(label);
  button.addEventListener("click", () => selectSite(site));
  pins.append(button);
  return { site, button };
});
const earthPin = document.querySelector<HTMLElement>("#earth-pin")!;
let globes: ReturnType<typeof createGlobes> | undefined;

function showGlobeError() {
  document.querySelector<HTMLElement>("#globe-error")!.hidden = false;
  globeCanvas.hidden = true;
  document.querySelector<HTMLElement>("#mars-drag")!.hidden = true;
}

globeCanvas.addEventListener("webglcontextlost", showGlobeError);
try {
  globes = createGlobes(globeCanvas, target, markers, earthPin);
} catch {
  showGlobeError();
}

function percent(value: number) {
  return `${Math.round(value * 100)}${getLang() === "es" ? " %" : "%"}`;
}

function originLabel(site: Site) {
  if (site.origin === "curated") return t("v.origin.curated");
  return site.knownAnalog ? t("v.origin.near", { name: tr(site.knownAnalog) }) : t("v.origin.new");
}

function breakdownRows(match: Match) {
  const { site } = match;
  const cover = site.cover;
  const climate = site.climate;
  const row = (label: string, mars: string, earth: string) =>
    `<tr><th scope="row">${label}</th><td>${mars}</td><td>${earth}</td></tr>`;
  const group = (label: string) => `<tr class="group"><th scope="rowgroup" colspan="3">${label}</th></tr>`;
  const polar = target.category === "Ice & polar terrain";
  return [
    group(t("v.group.surface")),
    row(t("v.bare"), polar ? t("v.dustRock") : percent(1),
      cover ? `${percent(cover.bare)}${cover.assumed ? t("v.assumed") : ""}` : "—"),
    row(t("v.snowIce"), polar ? t("v.iceRich") : "—", cover ? percent(cover.snow_ice) : "—"),
    row(t("v.vegetation"), percent(0), cover ? percent(cover.vegetation) : "—"),
    group(t("v.group.climate")),
    row(t("v.tMean"), `${marsClimate.t_mean} °C`, climate ? `${num(climate.t_mean, 1)} °C` : "—"),
    row(t("v.diurnal"), `~${marsClimate.diurnal_range} °C`, climate ? `${num(climate.diurnal_range, 1)} °C` : "—"),
    row(t("v.precip"), `${marsClimate.precip_year} mm`, climate ? `${Math.round(climate.precip_year)} mm` : "—"),
    group(t("v.group.score")),
    row(t("v.terrainSim", { p: percent(weights.terrain) }), "", num(match.terrain)),
    row(t("v.surfaceW", { p: percent(weights.surface) }), "", num(match.surface)),
    row(t("v.climateW", { p: percent(weights.climate) }), "", num(match.climate)),
    row(t("v.total"), "", `<strong>${num(match.total)}</strong>`),
  ].join("");
}

let currentMatch: Match | undefined;
let shownMatches: Match[] = [];
let rankedCount = 0;

/** Cabeceras y tabla de medidas del par elegido (sin volver a cargar el terreno 3D). */
function renderDetails(match: Match) {
  const pair = [target, match.site];
  headings.replaceChildren(...pair.map((site) => {
    const panel = document.createElement("div");
    panel.className = "site";
    const name = document.createElement("h2");
    name.textContent = site.name;
    const source = document.createElement("a");
    source.href = site.raster || site.sourceUrl;
    source.textContent = siteCoordinates(site);
    source.title = site.source;
    panel.append(name, source);
    return panel;
  }));

  document.querySelector("#metrics")!.innerHTML = metricDefinitions.map(({ key, label, unit }) =>
    `<tr><th scope="row">${t(label)}</th>${pair.map((site) =>
      `<td>${num(site.metrics[key], 1)}${unit}</td>`).join("")}</tr>`,
  ).join("") + breakdownRows(match);
}

async function selectMatch(match: Match) {
  const candidate = match.site;
  currentMatch = match;
  pending?.abort();
  const request = new AbortController();
  pending = request;
  const pair = [target, candidate];
  document.querySelector("#earth-site")!.textContent = candidate.name;
  globes?.flyTo(candidate);
  renderDetails(match);

  comparison.hidden = false;
  details.hidden = false;
  for (const button of matchList.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.site === candidate.id));
  }
  if (viewerFailed) return;

  canvas.style.visibility = "hidden";
  setStatus("v.loading");
  for (const button of terrainButtons) button.disabled = true;
  try {
    const grids = await Promise.all(pair.map((site) => loadTerrain(site, request.signal)));
    if (request.signal.aborted || viewerFailed) return;
    if (viewer) viewer.setSites(grids);
    else viewer = createViewer(canvas, grids);
    setStatus(null);
    canvas.style.visibility = "visible";
    for (const button of terrainButtons) button.disabled = false;
  } catch (error) {
    if (request.signal.aborted || viewerFailed) return;
    console.error(error);
    setStatus("v.loadError");
  }
}

function renderMatchList() {
  matchList.replaceChildren(...shownMatches.map((match, index) => {
    const { site: candidate } = match;
    const item = document.createElement("li");
    item.style.setProperty("--i", String(index)); // retardo de la entrada escalonada (style.css)
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.site = candidate.id;
    button.setAttribute("aria-pressed", String(currentMatch?.site === candidate));
    // Tarjeta: posición y puntuación grande arriba (decorativas: la frase completa va en .match-distance).
    const rank = document.createElement("span");
    rank.className = "match-rank";
    rank.setAttribute("aria-hidden", "true");
    rank.textContent = String(index + 1).padStart(2, "0");
    const big = document.createElement("span");
    big.className = "match-score";
    big.setAttribute("aria-hidden", "true");
    big.textContent = num(match.total);
    const meta = document.createElement("span");
    meta.className = "match-meta";
    meta.setAttribute("aria-hidden", "true");
    meta.textContent = index === 0 ? t("v.bestOf", { n: rankedCount }).replace(/[\s·]+$/u, "") : "";
    const name = document.createElement("span");
    name.className = "match-name";
    name.textContent = candidate.name;
    const origin = document.createElement("span");
    origin.className = `match-origin ${candidate.origin ?? ""}`;
    origin.textContent = originLabel(candidate);
    const score = document.createElement("span");
    score.className = "match-distance";
    score.textContent = `${index === 0 ? t("v.bestOf", { n: rankedCount }) : ""}${t("v.score", { v: num(match.total) })}`;
    const bars = document.createElement("span");
    bars.className = "match-bars";
    bars.setAttribute("aria-label",
      t("v.barsLabel", { t: num(match.terrain), s: num(match.surface), c: num(match.climate) }));
    bars.innerHTML = ([["v.bar.terrain", match.terrain], ["v.bar.surface", match.surface], ["v.bar.climate", match.climate]] as const)
      .map(([key, value]) => {
        const label = t(key);
        return `<span title="${label} ${num(value)}"><b>${label}</b><i style="--v:${Math.max(0, value)}"></i><em>${num(value)}</em></span>`;
      })
      .join("");
    button.append(rank, big, name, origin, meta, score, bars);
    button.addEventListener("click", () => void selectMatch(match));
    item.append(button);
    return item;
  }));
}

function selectSite(site: Site) {
  target = site;
  picker.value = site.id;
  globes?.selectMars(site);
  for (const marker of markers) {
    marker.button.setAttribute("aria-pressed", String(marker.site === site));
  }
  const ranked = rankEarthSites(site);
  // El conjunto mundial es mucho mayor: se deja visible el mejor sitio curado (3DEP, más resolución).
  // Un parche por región escaneada (ids como "g012-34"), para que la lista muestre lugares distintos.
  const regions = new Set<string>();
  const shown = ranked.filter(({ site: s }) => {
    const region = s.origin === "global" ? s.id.split("-")[0] : s.id;
    if (regions.has(region)) return false;
    regions.add(region);
    return true;
  }).slice(0, 5);
  const bestCurated = ranked.find(({ site: s }) => s.origin === "curated");
  if (bestCurated && !shown.includes(bestCurated)) shown[shown.length - 1] = bestCurated;
  shownMatches = shown;
  rankedCount = ranked.length;
  currentMatch = undefined;
  renderMatchList();
  results.hidden = false;
  document.querySelector<HTMLElement>("#ranking-method")!.hidden = false;
  if (ranked[0]) void selectMatch(ranked[0]);
}

picker.addEventListener("change", () => {
  const site = marsSites.find(({ id }) => id === picker.value);
  if (site) selectSite(site);
});
document.querySelector("#find-matches")!.addEventListener("click", () => selectSite(target));
markers.find(({ site }) => site === target)?.button.setAttribute("aria-pressed", "true");
renderChrome();

// Cambio de idioma: se vuelven a pintar los textos generados sin perder la selección ni recargar el 3D.
onLangChange(() => {
  renderChrome();
  if (shownMatches.length) renderMatchList();
  if (currentMatch) renderDetails(currentMatch);
  if (statusKey) setStatus(statusKey);
});
