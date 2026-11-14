import { locale, onLangChange, t } from "./i18n";
import { renderPathComparison } from "./pathComparison";
import {
  importRouteFile, MARS_RADIUS_KM, MAX_ROUTE_POINTS, RouteFileError, routeDistanceKm, type RoutePoint,
} from "./pathRoute";
import {
  MAX_PLANNER_DISTANCE_KM, MIN_PLANNER_DISTANCE_KM, PathTerrainError, plannerDistanceRange, searchPathTerrain, type PathTerrainResult,
} from "./pathTerrain";

// No element has this id: opening the link must not scroll the page past the header.
const HASH = "#path-planner";
const STORAGE_KEY = "analogs-path-rehearsal-v1";
const MIN_WAYPOINT_GAP_KM = .001;
const EXAMPLE: RoutePoint[] = [
  { lat: 18.464, lon: 77.349 }, { lat: 18.4668, lon: 77.3556 },
  { lat: 18.4722, lon: 77.36 }, { lat: 18.4776, lon: 77.3688 },
];

type Draft = { points: RoutePoint[]; name?: string; example?: boolean; rehearsalId?: string };
type PathGlobe = {
  setActive(active: boolean): void;
  setDrawing(active: boolean): void;
  preview(mars: readonly RoutePoint[], earth: readonly RoutePoint[]): void;
  fit(mars: readonly RoutePoint[], earth: readonly RoutePoint[]): void;
  isAvailable(): boolean;
};

function readSavedDraft(): Draft | null {
  try {
    const saved: Draft = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved.rehearsalId === "string" && Array.isArray(saved.points) &&
      saved.points.length >= 2 && saved.points.length <= MAX_ROUTE_POINTS &&
      saved.points.every((point) => point && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
        Number.isFinite(point.lon) && Math.abs(point.lon) <= 180)) {
      return { points: saved.points, rehearsalId: saved.rehearsalId,
        name: typeof saved.name === "string" ? saved.name : undefined, example: saved.example === true };
    }
  } catch { /* The planner also works with storage disabled. */ }
  return null;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function mountPathPlanner(globe: PathGlobe) {
  const planner = $("path-tools");
  const plannerLink = $<HTMLAnchorElement>("path-link");
  const browseLink = $<HTMLAnchorElement>("gl-browse-link");
  const sourcesLink = $<HTMLAnchorElement>("gl-sources-link");
  const sourcesHeading = $("sources").querySelector<HTMLElement>("h2")!;
  const comparison = $("path-comparison");
  const search = $<HTMLButtonElement>("path-search");
  const draw = $<HTMLButtonElement>("path-draw");
  const upload = $<HTMLButtonElement>("path-upload");
  const file = $<HTMLInputElement>("path-file");
  const example = $<HTMLButtonElement>("path-example");
  const undo = $<HTMLButtonElement>("path-undo");
  const fit = $<HTMLButtonElement>("path-fit");
  const clear = $<HTMLButtonElement>("path-clear");
  const status = $("path-status");
  const metadata = $("path-metadata");
  const lengthReadout = $("path-distance");
  const lengthValue = $("path-distance-value");
  const lengthRange = $("path-distance-range");
  const lengthAnnouncement = $("path-distance-announcement");
  const help = $("path-help");

  let active = false;
  let drawing = false;
  let importing = false;
  let importVersion = 0;
  let draft: Draft = readSavedDraft() ?? { points: [] };
  let restore = !!draft.rehearsalId;
  let distance = routeDistanceKm(draft.points, MARS_RADIUS_KM);
  let results: PathTerrainResult | null = null;
  let selectedId: string | null = null;
  let job: AbortController | null = null;
  let progress: number | null = null;
  let error: string | null = null;

  const selected = () => results?.matches.find((match) => match.site.id === selectedId) ?? results?.matches[0];
  const earthPoints = () => selected()?.profile.points ?? [];
  const localLimits = () => ({ min: MIN_PLANNER_DISTANCE_KM.toLocaleString(locale()), max: MAX_PLANNER_DISTANCE_KM.toLocaleString(locale()) });

  function paintDistance(projected: number | null) {
    const distanceKm = projected ?? distance;
    const isPreview = projected !== null;
    const range = !isPreview && draft.points.length < 2 ? "empty" : plannerDistanceRange(distanceKm);
    const limits = localLimits();
    const digits = distanceKm < 1 ? 3 : distanceKm < 10 ? 2 : 1;
    let value = distanceKm.toLocaleString(locale(), { maximumFractionDigits: digits });
    if (range === "short" && value === limits.min) value = `<${limits.min}`;
    if (range === "long" && value === limits.max) value = `>${limits.max}`;
    const distanceText = t(isPreview ? "path.distancePreview" : "path.distance", { distance: value });
    const rangeText = t(`path.range.${range}`, limits);
    lengthReadout.dataset.range = range;
    lengthReadout.dataset.preview = String(isPreview);
    if (lengthValue.textContent !== distanceText) lengthValue.textContent = distanceText;
    if (lengthRange.textContent !== rangeText) lengthRange.textContent = rangeText;
    if (!isPreview) {
      const announcement = `${distanceText}. ${rangeText}`;
      if (lengthAnnouncement.textContent !== announcement) lengthAnnouncement.textContent = announcement;
    }
  }

  function paintToolbar() {
    const available = globe.isAvailable();
    draw.disabled = !available;
    draw.setAttribute("aria-pressed", String(drawing && available));
    help.hidden = !drawing || !available;
    example.hidden = draft.points.length > 0;
    undo.hidden = !draft.points.length || (!drawing && (!!draft.name || draft.example === true));
    fit.hidden = !available || !draft.points.length;
    clear.hidden = !draft.points.length;
    search.disabled = !job && (plannerDistanceRange(distance) !== "ready" || importing);
    search.textContent = t(job ? "path.cancel" : "path.search");
    upload.disabled = importing;
    paintDistance(null);

    const details = document.createDocumentFragment();
    if (draft.points.length) {
      const name = draft.example ? t("path.exampleName") : draft.name;
      if (name) {
        const label = document.createElement("b");
        label.textContent = name;
        details.append(label, " · ");
      }
      const waypoints = draft.points.length === 1 ? t("path.waypoint") :
        t("path.waypoints", { n: draft.points.length.toLocaleString(locale()) });
      details.append(waypoints);
    }
    if (metadata.textContent !== details.textContent) metadata.replaceChildren(details);
    status.classList.toggle("is-error", !!error);
    status.textContent = error ? t(`path.error.${error}`, localLimits()) : importing ? t("path.importing") : job ?
      t("path.searching", { percent: progress === null ? "" : (progress / 100).toLocaleString(locale(), { style: "percent" }) }).trim() :
      available ? "" : t("path.drawUnavailable");
  }

  function paintComparison() {
    comparison.hidden = !active || !results;
    renderPathComparison(comparison, active ? results : null, selectedId, draft.rehearsalId ?? null, {
      onSelect(siteId) {
        if (siteId === selectedId) return;
        selectedId = siteId;
        globe.preview(draft.points, earthPoints());
        globe.fit(draft.points, earthPoints());
        paintComparison();
      },
      onChoose(siteId) {
        draft.rehearsalId = siteId;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch { /* Session-only selection. */ }
        paintComparison();
      },
    });
  }

  function setDrawing(next: boolean) {
    drawing = next && globe.isAvailable();
    globe.setDrawing(drawing);
    paintToolbar();
  }

  function cancelSearch() {
    job?.abort();
    job = null;
    progress = null;
  }

  function setRoute(next: Draft, frame: boolean) {
    cancelSearch();
    restore = false;
    draft = next;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
    distance = routeDistanceKm(draft.points, MARS_RADIUS_KM);
    results = null;
    selectedId = null;
    error = null;
    globe.preview(draft.points, []);
    if (frame) globe.fit(draft.points, []);
    paintToolbar();
    paintComparison();
  }

  async function findMatches(reveal: boolean) {
    if (job) {
      cancelSearch();
      paintToolbar();
      return;
    }
    if (plannerDistanceRange(distance) !== "ready" || importing) return;
    const controller = new AbortController();
    job = controller;
    progress = null;
    error = null;
    setDrawing(false);
    try {
      const found = await searchPathTerrain(draft.points, controller.signal, (done, total) => {
        if (job !== controller || total < 1) return;
        const next = Math.min(100, Math.floor(done / total * 10) * 10);
        if (next !== progress) {
          progress = next;
          paintToolbar();
        }
      }, draft.rehearsalId);
      if (job !== controller) return;
      results = found;
      selectedId = found.matches.find((match) => match.site.id === draft.rehearsalId)?.site.id ?? found.matches[0]?.site.id ?? null;
      globe.preview(draft.points, earthPoints());
      globe.fit(draft.points, earthPoints());
      paintComparison();
      if (reveal && active) {
        const heading = comparison.querySelector<HTMLElement>("h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
        if (comparison.getBoundingClientRect().top > window.innerHeight - 150) {
          comparison.scrollIntoView({ block: "start" });
        }
      }
    } catch (cause) {
      if (job === controller) error = cause instanceof PathTerrainError ? cause.code : "route";
    } finally {
      if (job === controller) {
        job = null;
        progress = null;
        paintToolbar();
      }
    }
  }

  function syncMode() {
    const next = location.hash === HASH;
    if (next === active) return;
    active = next;
    planner.hidden = !active;
    if (active) {
      plannerLink.setAttribute("aria-current", "page");
      browseLink.removeAttribute("aria-current");
    } else {
      browseLink.setAttribute("aria-current", "page");
      plannerLink.removeAttribute("aria-current");
      importVersion++;
      importing = false;
      cancelSearch();
      setDrawing(false);
    }
    document.title = t(active ? "path.docTitle" : "gl.docTitle");
    globe.setActive(active);
    if (active && draft.points.length) {
      globe.preview(draft.points, earthPoints());
      globe.fit(draft.points, earthPoints());
    }
    paintToolbar();
    paintComparison();
    if (active && restore) {
      restore = false;
      void findMatches(false);
    }
  }

  plannerLink.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (!active) {
      history.pushState(null, "", HASH);
      syncMode();
    }
    window.scrollTo(0, 0);
  });
  browseLink.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || !active) return;
    event.preventDefault();
    history.pushState(null, "", browseLink.href);
    syncMode();
    window.scrollTo(0, 0);
  });
  sourcesLink.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || !active) return;
    event.preventDefault();
    sourcesHeading.tabIndex = -1;
    sourcesHeading.focus({ preventScroll: true });
    sourcesHeading.scrollIntoView({ block: "start" });
  });
  window.addEventListener("hashchange", syncMode);
  draw.addEventListener("click", () => { error = null; setDrawing(!drawing); });
  upload.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const routeFile = file.files?.[0];
    file.value = "";
    if (!routeFile) return;
    cancelSearch();
    const started = ++importVersion;
    importing = true;
    error = null;
    paintToolbar();
    try {
      const imported = await importRouteFile(routeFile);
      if (started !== importVersion) return;
      setDrawing(false);
      setRoute(imported, true);
    } catch (cause) {
      if (started === importVersion) error = cause instanceof RouteFileError ? cause.code : "malformed-file";
    } finally {
      if (started === importVersion) {
        importing = false;
        paintToolbar();
      }
    }
  });
  example.addEventListener("click", () => {
    setRoute({ points: EXAMPLE, example: true }, true);
    void findMatches(true);
    search.focus({ preventScroll: true });
  });
  undo.addEventListener("click", () => setRoute({ points: draft.points.slice(0, -1) }, false));
  clear.addEventListener("click", () => {
    setRoute({ points: [] }, false);
    (drawing ? draw : example).focus();
  });
  fit.addEventListener("click", () => globe.fit(draft.points, earthPoints()));
  search.addEventListener("click", () => void findMatches(true));
  onLangChange(() => {
    if (!active) return;
    document.title = t("path.docTitle");
    paintToolbar();
    paintComparison();
  });
  syncMode();

  return {
    get active() { return active; },
    get drawing() { return active && drawing && globe.isAvailable(); },
    previewPoint(point: RoutePoint | null) {
      const end = draft.points.at(-1);
      const segment = drawing && !importing && draft.points.length < MAX_ROUTE_POINTS && end && point
        ? routeDistanceKm([end, point], MARS_RADIUS_KM) : 0;
      paintDistance(segment >= MIN_WAYPOINT_GAP_KM ? distance + segment : null);
    },
    addPoint(point: RoutePoint) {
      if (!drawing || importing) return;
      if (draft.points.length >= MAX_ROUTE_POINTS) {
        error = "too-many-points";
        paintToolbar();
        return;
      }
      const end = draft.points.at(-1);
      if (end && routeDistanceKm([end, point], MARS_RADIUS_KM) < MIN_WAYPOINT_GAP_KM) return;
      setRoute({ points: [...draft.points, point] }, false);
    },
    endDrawing() { setDrawing(false); },
    updateAvailability() {
      if (active) {
        globe.setDrawing(drawing && globe.isAvailable());
        paintToolbar();
      }
    },
  };
}
