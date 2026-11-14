import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-500.css";
import "@fontsource/barlow/latin-600.css";
import "./style.css";
import { cellSize, loadTerrain, metricDefinitions, patchWidth, rankEarthSites, sites, type Site } from "./data";
import { createGlobes } from "./globes";
import { createViewer, slopeBands, type Mode } from "./viewer";

const marsSites = sites.filter(({ planet }) => planet === "Mars");
let target = marsSites.find(({ id }) => id === "jezero")!;
let pending: AbortController | undefined;
const picker = document.querySelector<HTMLSelectElement>("#mars-site")!;
const categories = new Map<string, HTMLOptGroupElement>();
const names = new Map<string, number>();
for (const { name } of marsSites) names.set(name, (names.get(name) ?? 0) + 1);

function coordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(3)}° ${value < 0 ? negative : positive}`;
}

function siteCoordinates(site: Site) {
  return `${coordinate(site.latitude, "N", "S")} · ${coordinate(site.longitude, "E", "W")}`;
}

function siteLabel(site: Site) {
  return (names.get(site.name) ?? 0) > 1 ? `${site.name} (${siteCoordinates(site)})` : site.name;
}

for (const site of marsSites) {
  let group = categories.get(site.category);
  if (!group) {
    group = document.createElement("optgroup");
    group.label = site.category;
    categories.set(site.category, group);
    picker.append(group);
  }
  group.append(new Option(siteLabel(site), site.id));
}
picker.value = target.id;
const headings = document.querySelector("#site-headings")!;
const sourceList = document.querySelector("#source-list")!;
const gridScale = document.querySelector("#grid-scale")!;
const results = document.querySelector<HTMLElement>("#results")!;
const comparison = document.querySelector<HTMLElement>("#comparison")!;
const details = document.querySelector<HTMLElement>("#details")!;
const matchList = document.querySelector("#match-list")!;
gridScale.textContent = `${patchWidth / 1000} × ${patchWidth / 1000} km · ${cellSize} m cells · True vertical scale`;

const sources = [
  ["Mars elevation · USGS HiRISE catalog", "https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/"],
  ["Earth elevation · USGS 3DEP", sites.find(({ planet }) => planet === "Earth")!.sourceUrl],
  ["Mars imagery · Viking MDIM 2.1", "https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m"],
  ["Earth imagery · NASA Blue Marble", "https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/"],
];
for (const [label, url] of sources) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.href = url;
  link.textContent = label;
  item.append(link);
  sourceList.append(item);
}

const legend = document.querySelector<HTMLElement>("#legend")!;
legend.innerHTML = `<span>Slope</span>${slopeBands.map(({ label, color }) =>
  `<span><i style="background:${color}" aria-hidden="true"></i>${label}</span>`,
).join("")}`;

const canvas = document.querySelector<HTMLCanvasElement>("#terrain")!;
const terrainButtons = document.querySelectorAll<HTMLButtonElement>(".toolbar button");
let viewer: ReturnType<typeof createViewer> | undefined;
let viewerFailed = false;

function showTerrainError() {
  viewerFailed = true;
  const error = document.querySelector<HTMLElement>("#viewer-error")!;
  error.hidden = false;
  error.textContent = "The 3D view couldn’t load. Terrain measurements are available below.";
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
  button.title = siteLabel(site);
  button.setAttribute("aria-label", siteLabel(site));
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

const status = document.querySelector<HTMLElement>("#viewer-error")!;

async function selectMatch(candidate: Site) {
  pending?.abort();
  const request = new AbortController();
  pending = request;
  const pair = [target, candidate];
  document.querySelector("#earth-site")!.textContent = candidate.name;
  globes?.flyTo(candidate);

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
    `<tr><th scope="row">${label}</th>${pair.map((site) =>
      `<td>${site.metrics[key].toFixed(1)}${unit}</td>`).join("")}</tr>`,
  ).join("");

  comparison.hidden = false;
  details.hidden = false;
  for (const button of matchList.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.site === candidate.id));
  }
  if (viewerFailed) return;

  canvas.style.visibility = "hidden";
  status.textContent = "Loading terrain…";
  status.hidden = false;
  for (const button of terrainButtons) button.disabled = true;
  try {
    const grids = await Promise.all(pair.map((site) => loadTerrain(site, request.signal)));
    if (request.signal.aborted || viewerFailed) return;
    if (viewer) viewer.setSites(grids);
    else viewer = createViewer(canvas, grids);
    status.hidden = true;
    canvas.style.visibility = "visible";
    for (const button of terrainButtons) button.disabled = false;
  } catch (error) {
    if (request.signal.aborted || viewerFailed) return;
    console.error(error);
    status.textContent = "Couldn’t load these terrain grids. Select the match to retry.";
  }
}

function selectSite(site: Site) {
  target = site;
  picker.value = site.id;
  globes?.selectMars(site);
  for (const marker of markers) {
    marker.button.setAttribute("aria-pressed", String(marker.site === site));
  }
  const ranked = rankEarthSites(site);
  matchList.replaceChildren(...ranked.slice(0, 3).map(({ site: candidate, distance }, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.site = candidate.id;
    button.setAttribute("aria-pressed", "false");
    const name = document.createElement("span");
    name.className = "match-name";
    name.textContent = candidate.name;
    const score = document.createElement("span");
    score.className = "match-distance";
    score.textContent = `${index === 0 ? `Best of ${ranked.length} · ` : ""}Distance ${distance.toFixed(3)}`;
    button.append(name, score);
    button.addEventListener("click", () => void selectMatch(candidate));
    item.append(button);
    return item;
  }));
  results.hidden = false;
  document.querySelector<HTMLElement>("#ranking-method")!.hidden = false;
  if (ranked[0]) void selectMatch(ranked[0].site);
}

picker.addEventListener("change", () => {
  const site = marsSites.find(({ id }) => id === picker.value);
  if (site) selectSite(site);
});
document.querySelector("#find-matches")!.addEventListener("click", () => selectSite(target));
markers.find(({ site }) => site === target)?.button.setAttribute("aria-pressed", "true");
document.querySelector("#mars-count")!.textContent = `${marsSites.length} sites`;
