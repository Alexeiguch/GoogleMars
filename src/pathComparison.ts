import "./pathComparison.css";
import { getLang, locale, t, tr } from "./i18n";
import { coord } from "./globosData";
import type { PathTerrainResult, TerrainProfile } from "./pathTerrain";

const labels = {
  en: {
    matches: "Proposed Earth traverses", similarity: "Terrain similarity", noMatches: "No comparable routes found in the Earth terrain catalog.",
    searched: (count: number) => `Searched ${number(count)} Earth terrain ${count === 1 ? "site" : "sites"}`,
    method: "Scoring and coverage",
    methodScore: "Similarity weighs distance (20%), elevation change (40%) and signed slope (40%). The charts align the routes by percentage completed.",
    methodCoverage: "The search tests the Mars route shape at different positions, orientations and lengths across cataloged land. Check access, trail conditions and hazards before a field rehearsal.",
    profiles: "Terrain profiles", choose: "Select for rehearsal", chosen: "Selected for rehearsal",
    progress: "Route progress", distance: "Distance", ascent: "Ascent", descent: "Descent", maxSlope: "Max. slope",
    elevation: "Elevation from start (m)", slope: "Slope (°)", grid: (value: string) => `${value} grid`,
    regional: "Regional scale", estimate: "Regional estimate", lowDetail: "Limited terrain detail",
    methodResolution: "The Mars elevation grid resolves only a few intervals along this route. The ranking uses broad elevation change and slope estimates.",
    current: (name: string, distance: string, elevation: string, slope: string) =>
      `${name} at ${distance}, elevation change ${elevation}, slope ${slope}`,
  },
  es: {
    matches: "Rutas propuestas en la Tierra", similarity: "Similitud del terreno", noMatches: "El catálogo de terrenos de la Tierra no contiene rutas comparables.",
    searched: (count: number) => `${number(count)} ${count === 1 ? "zona analizada" : "zonas analizadas"} en la Tierra`,
    method: "Puntuación y cobertura",
    methodScore: "La similitud pondera la distancia (20 %), el cambio de elevación (40 %) y la pendiente con signo (40 %). Los gráficos alinean las rutas por porcentaje recorrido.",
    methodCoverage: "La búsqueda prueba la forma de la ruta marciana en distintas ubicaciones, orientaciones y longitudes por tierra firme en las zonas del catálogo. Comprueba el acceso, el estado de los caminos y los peligros antes de un ensayo de campo.",
    profiles: "Perfiles del terreno", choose: "Elegir para el ensayo", chosen: "Elegida para el ensayo",
    progress: "Progreso de la ruta", distance: "Distancia", ascent: "Ascenso", descent: "Descenso", maxSlope: "Pendiente máx.",
    elevation: "Elevación desde el inicio (m)", slope: "Pendiente (°)", grid: (value: string) => `Malla de ${value}`,
    regional: "Escala regional", estimate: "Estimación a escala regional", lowDetail: "Detalle del terreno limitado",
    methodResolution: "La malla de elevación de Marte distingue pocos tramos en esta ruta. La clasificación usa estimaciones generales de desnivel y pendiente.",
    current: (name: string, distance: string, elevation: string, slope: string) =>
      `${name} a ${distance}, desnivel ${elevation}, pendiente ${slope}`,
  },
};

type Actions = { onSelect(siteId: string): void; onChoose(siteId: string): void };
type ChartKind = "elevation" | "slope";
type RouteSeries = { planet: "mars" | "earth"; profile: TerrainProfile };
type Values = { elevation: number; slope: number };
type Scale = { min: number; max: number; ticks: number[] };
const chartKinds = ["elevation", "slope"] as const;

const cursorState = new WeakMap<HTMLElement, { result: PathTerrainResult; percent: number }>();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);
const number = (value: number, digits = 0, signed = false) => value.toLocaleString(locale(), {
  maximumFractionDigits: digits, signDisplay: signed ? "exceptZero" : "auto",
});
const formatDistance = (km: number) => `${number(km, km < 0.1 ? 3 : 2)} km`;
const formatSlope = (degrees: number, signed = false) => `${number(degrees, 1, signed)}°`;
const formatElevation = (meters: number, signed = false) => `${number(meters, 1, signed)} m`;
const isRegional = (profile: TerrainProfile) => profile.resolutionM > 1000;

function chartValues(profile: TerrainProfile, kind: ChartKind) {
  const start = profile.samples[0].elevationM;
  return profile.samples.map((sample) => ({
    percent: sample.distanceKm / profile.distanceKm * 100,
    value: kind === "elevation" ? sample.elevationM - start : sample.slopeDeg,
  }));
}

function sharedScale(series: RouteSeries[], kind: ChartKind): Scale {
  let low = 0;
  let high = 0;
  for (const { profile } of series) {
    for (const { value } of chartValues(profile, kind)) {
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  }
  const span = Math.max(high - low, kind === "slope" ? 2 : 4);
  const targetStep = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const step = magnitude * ([1, 2, 2.5, 5, 10].find((value) => value * magnitude >= targetStep) ?? 10);
  const min = Math.floor((low - span * 0.06) / step) * step;
  const max = Math.ceil((high + span * 0.06) / step) * step;
  const count = Math.round((max - min) / step);
  const ticks = Array.from({ length: count + 1 }, (_, index) => Number((min + index * step).toPrecision(9)));
  return { min, max, ticks };
}

const plotY = (value: number, scale: Scale) => (scale.max - value) / (scale.max - scale.min) * 100;

function chart(series: RouteSeries, kind: ChartKind, scale: Scale) {
  const coordinates = chartValues(series.profile, kind)
    .map(({ percent, value }) => `${(percent * 10).toFixed(2)},${plotY(value, scale).toFixed(2)}`).join(" ");
  const ticks = scale.ticks.map((tick) => `
    <span class="path-profile-tick${tick === 0 ? " is-zero" : ""}" style="--y:${plotY(tick, scale)}%">
      <span>${number(tick, 2)}</span>
    </span>`).join("");
  const progressTicks = [0, 25, 50, 75, 100].map((tick) => `<span style="--x:${tick}%">${tick}%</span>`).join("");
  return `<div class="path-profile-chart" data-planet="${series.planet}" data-kind="${kind}" aria-hidden="true">
    <div class="path-profile-value"><span data-value="${kind}"></span>${kind === "elevation" ? '<span data-value="distance"></span>' : ""}</div>
    <div class="path-profile-plane">
      ${ticks}
      <div class="path-profile-plot">
        <svg aria-hidden="true" viewBox="0 0 1000 100" preserveAspectRatio="none"><polyline points="${coordinates}" vector-effect="non-scaling-stroke"/></svg>
        <span class="path-profile-crosshair" aria-hidden="true"><i></i></span>
      </div>
    </div>
    <div class="path-profile-x">${progressTicks}</div>
  </div>`;
}

function stats({ planet, profile }: RouteSeries) {
  const l = labels[getLang()];
  return `<div class="path-profile-stats" data-planet="${planet}">
    <h3>${t(`planet.${planet}`)}</h3>
    <dl>
      <div><dt>${l.distance}</dt><dd>${formatDistance(profile.distanceKm)}</dd></div>
      <div><dt>${l.ascent}</dt><dd>${formatElevation(profile.ascentM)}</dd></div>
      <div><dt>${l.descent}</dt><dd>${formatElevation(profile.descentM)}</dd></div>
      <div><dt>${l.maxSlope}</dt><dd>${formatSlope(profile.maxSlopeDeg)}</dd></div>
    </dl>
  </div>`;
}

function source({ profile }: RouteSeries) {
  const l = labels[getLang()];
  const name = escapeHtml(profile.source);
  const attribution = profile.sourceUrl?.startsWith("https://")
    ? `<a href="${escapeHtml(profile.sourceUrl)}" target="_blank" rel="noopener noreferrer">${name}</a>` : name;
  const regional = isRegional(profile);
  const size = regional ? formatDistance(profile.resolutionM / 1000) : formatElevation(profile.resolutionM);
  return `<p>${attribution} · ${l.grid(size)}${regional ? ` · ${l.regional}` : ""}</p>`;
}

function profilePosition(profile: TerrainProfile, position: number): Values {
  const distance = profile.distanceKm * position / 100;
  const samples = profile.samples;
  const after = samples.findIndex((sample) => sample.distanceKm >= distance);
  const end = samples[after < 0 ? samples.length - 1 : after];
  const start = samples[after < 0 ? samples.length - 1 : Math.max(0, after - 1)];
  const segment = end.distanceKm - start.distanceKm;
  const ratio = segment > 0 ? (distance - start.distanceKm) / segment : 0;
  return {
    elevation: start.elevationM + (end.elevationM - start.elevationM) * ratio - samples[0].elevationM,
    slope: start.slopeDeg + (end.slopeDeg - start.slopeDeg) * ratio,
  };
}

function attachCursor(host: HTMLElement, series: RouteSeries[], scales: Record<ChartKind, Scale>, state: { percent: number }) {
  const l = labels[getLang()];
  const charts = Array.from(host.querySelectorAll<HTMLElement>(".path-profile-chart")).map((element) => ({
    element,
    planet: element.dataset.planet,
    kind: element.dataset.kind as ChartKind,
    plot: element.querySelector<HTMLElement>(".path-profile-plot")!,
    crosshair: element.querySelector<HTMLElement>(".path-profile-crosshair")!,
    value: element.querySelector<HTMLElement>(`[data-value="${element.dataset.kind}"]`)!,
    distance: element.querySelector<HTMLElement>('[data-value="distance"]'),
  }));
  const slider = host.querySelector<HTMLInputElement>("#path-progress")!;
  const progress = host.querySelector<HTMLElement>(".path-profile-percent")!;
  let displayed = -1;

  function update(position: number) {
    if (position === displayed) return;
    displayed = position;
    state.percent = position;
    slider.value = String(position);
    progress.textContent = `${position}%`;
    const readable = [`${position}%`];
    for (const { profile, planet } of series) {
      const sample = profilePosition(profile, position);
      const distance = formatDistance(profile.distanceKm * position / 100);
      const elevation = formatElevation(sample.elevation, true);
      const slope = formatSlope(sample.slope, true);
      readable.push(l.current(t(`planet.${planet}`), distance, elevation, slope));
      for (const { element, planet: chartPlanet, kind, crosshair, value, distance: distanceLabel } of charts) {
        if (chartPlanet !== planet) continue;
        element.style.setProperty("--progress", `${position}%`);
        crosshair.style.setProperty("--marker-y", `${plotY(sample[kind], scales[kind])}%`);
        value.textContent = kind === "elevation" ? elevation : slope;
        if (distanceLabel) distanceLabel.textContent = distance;
      }
    }
    slider.setAttribute("aria-valuetext", readable.join(". "));
  }

  const pointToProgress = (event: PointerEvent) => {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (bounds.width > 0) update(Math.round(Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100))));
  };
  for (const { plot } of charts) {
    plot.addEventListener("pointerdown", pointToProgress);
    plot.addEventListener("pointermove", pointToProgress);
  }
  slider.addEventListener("input", () => update(slider.valueAsNumber));
  update(state.percent);
}

export function renderPathComparison(
  host: HTMLElement, results: PathTerrainResult | null, selectedId: string | null, rehearsalId: string | null, actions: Actions,
) {
  if (!results) {
    host.replaceChildren();
    cursorState.delete(host);
    return;
  }
  const l = labels[getLang()];
  const focused = host.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.pathFocus : undefined;
  const previous = cursorState.get(host);
  const methodOpen = host.querySelector<HTMLDetailsElement>(".path-match-method")?.open;
  const preview = results.matches.find((match) => match.site.id === selectedId) ?? results.matches[0];
  const chosen = preview ? preview.site.id === rehearsalId : false;
  const rehearsalAction = chosen ? l.chosen : l.choose;
  const series: RouteSeries[] = [{ planet: "mars", profile: results.mars }];
  if (preview) series.push({ planet: "earth", profile: preview.profile });
  const scales = { elevation: sharedScale(series, "elevation"), slope: sharedScale(series, "slope") };
  const compared = series.length > 1;
  const lowDetail = results.mars.samples.length < 4;
  const estimate = isRegional(results.mars) ? l.estimate : lowDetail ? l.lowDetail : "";
  const rank = results.matches.map(({ site, profile, score }, index) => {
    const start = profile.points[0];
    const selected = site.id === preview?.site.id;
    const isRehearsal = site.id === rehearsalId;
    return `<li><button type="button" data-path-candidate="${escapeHtml(site.id)}" data-path-focus="candidate-${index}"
        aria-pressed="${selected}">
      <span class="path-match-rank" aria-hidden="true">${index + 1}</span>
      <span class="path-match-name"><strong>${escapeHtml(tr(site.name))}</strong>
        <small>${coord(start.lat, start.lon, 3)}${isRehearsal ? ` <span class="path-match-chosen">${l.chosen}</span>` : ""}</small></span>
      <b class="path-match-score">${number(score, 1)}%</b>
    </button></li>`;
  }).join("");

  host.innerHTML = `<div class="path-comparison">
    <section class="path-matches" aria-labelledby="path-match-title">
      <h2 id="path-match-title" tabindex="-1" data-path-focus="results">${l.matches}</h2>
      ${rank ? `<div class="path-match-heading">${estimate ? `<span class="path-match-estimate">${estimate}</span>` : ""}
        <span>${l.similarity}</span></div><ol class="path-match-list" role="list">${rank}</ol>`
        : `<p class="path-match-empty">${l.noMatches}</p>`}
      <p class="path-match-search">${l.searched(results.sitesSearched)}</p>
      <details class="path-match-method"${methodOpen ? " open" : ""}>
        <summary data-path-focus="method">${l.method}</summary>
        <p>${l.methodScore}</p>${lowDetail ? `<p>${l.methodResolution}</p>` : ""}<p>${l.methodCoverage}</p>
      </details>
    </section>
    <section class="path-profiles" aria-labelledby="path-profiles-title">
      <div class="path-profile-header">
        <h2 id="path-profiles-title">${l.profiles}</h2>
        ${preview ? `<button class="path-rehearse" type="button" data-path-focus="rehearse" aria-disabled="${chosen}"
          aria-label="${rehearsalAction} (${escapeHtml(tr(preview.site.name))})">
          ${rehearsalAction}</button>` : ""}
      </div>
      <div class="path-profile-grid${compared ? " is-paired" : ""}">${series.map(stats).join("")}</div>
      <div class="path-profile-scrubber">
        <label for="path-progress">${l.progress}</label>
        <input type="range" id="path-progress" data-path-focus="progress" min="0" max="100" step="1">
        <span class="path-profile-percent" aria-hidden="true"></span>
      </div>
      ${chartKinds.map((kind) => `<div class="path-profile-compare">
          <p class="path-profile-channel">${l[kind]}</p>
          <div class="path-profile-grid${compared ? " is-paired" : ""}">${series.map((route) => chart(route, kind, scales[kind])).join("")}</div>
        </div>`).join("")}
      <div class="path-profile-sources path-profile-grid${compared ? " is-paired" : ""}">${series.map(source).join("")}</div>
    </section>
  </div>`;

  for (const button of host.querySelectorAll<HTMLButtonElement>("[data-path-candidate]")) {
    button.addEventListener("click", () => actions.onSelect(button.dataset.pathCandidate!));
  }
  host.querySelector<HTMLButtonElement>(".path-rehearse")?.addEventListener("click", () => {
    if (preview && !chosen) actions.onChoose(preview.site.id);
  });
  const state = previous && previous.result === results ? previous : { result: results, percent: 0 };
  cursorState.set(host, state);
  attachCursor(host, series, scales, state);
  if (focused) [...host.querySelectorAll<HTMLElement>("[data-path-focus]")]
    .find((element) => element.dataset.pathFocus === focused)?.focus({ preventScroll: true });
}
