// Guía de uso paso a paso («Cómo se usa»).
// Cada página registra sus pasos con mountTutorial(): un paso resalta una parte real de la página y explica qué hacer
// con ella. La guía se abre sola en la primera visita a la portada (globos.html) y siempre desde el botón «Guía» de la
// cabecera. ?tutorial=1 la fuerza; ?tutorial=0 la evita (enlaces directos, pruebas).
import "./tutorial.css";
import { getLang, onLangChange, type Lang } from "./i18n";

export type TutorialStep = {
  /** Selector del elemento que se resalta. Sin él (o si no se ve), la tarjeta va centrada. */
  target?: string;
  title: Record<Lang, string>;
  body: Record<Lang, string>;
};

const SEEN_KEY = "geotwin-tutorial";
const UI: Record<Lang, Record<string, string>> = {
  es: {
    button: "Guía", buttonLabel: "Cómo se usa GeoTwin", dialog: "Cómo se usa GeoTwin",
    skip: "Saltar guía", back: "Atrás", next: "Siguiente", start: "Empezar", done: "Listo", of: "de",
  },
  en: {
    button: "Guide", buttonLabel: "How to use GeoTwin", dialog: "How to use GeoTwin",
    skip: "Skip guide", back: "Back", next: "Next", start: "Start", done: "Done", of: "of",
  },
};

const storage = {
  seen() { try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } },
  markSeen() { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* almacenamiento bloqueado */ } },
};
const narrow = () => matchMedia("(max-width: 600px)").matches;
const GAP = 14; // px entre el elemento resaltado y la tarjeta
const EDGE = 16; // margen mínimo con el borde de la ventana

let steps: (() => TutorialStep[]) | null = null;
let index = 0;
let root: HTMLDivElement | null = null;
let returnFocus: HTMLElement | null = null;
let frame = 0;
let lastMode = "";

function visibleTarget(step: TutorialStep) {
  if (!step.target) return null;
  const el = document.querySelector<HTMLElement>(step.target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

function build() {
  const el = document.createElement("div");
  el.className = "tut";
  el.innerHTML = `
    <div class="tut-shade" aria-hidden="true"></div>
    <div class="tut-spot" aria-hidden="true"></div>
    <section class="tut-card" role="dialog" aria-modal="true" aria-labelledby="tut-title" aria-describedby="tut-body" tabindex="-1">
      <p class="tut-count" aria-live="polite"></p>
      <h2 class="tut-title" id="tut-title"></h2>
      <p class="tut-body" id="tut-body"></p>
      <div class="tut-actions">
        <button type="button" class="tut-skip" data-tut="skip"></button>
        <span class="tut-nav">
          <button type="button" class="tut-back" data-tut="back"></button>
          <button type="button" class="tut-next" data-tut="next"></button>
        </span>
      </div>
    </section>`;
  el.addEventListener("click", (event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>("[data-tut]")?.dataset.tut;
    if (action === "skip") close();
    else if (action === "back") go(index - 1);
    else if (action === "next") go(index + 1);
  });
  el.addEventListener("keydown", onKey);
  return el;
}

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") { event.preventDefault(); close(); return; }
  if (event.key === "ArrowRight") { event.preventDefault(); go(index + 1); return; }
  if (event.key === "ArrowLeft") { event.preventDefault(); go(index - 1); return; }
  if (event.key !== "Tab" || !root) return;
  // El foco no sale de la tarjeta mientras la guía está abierta.
  const focusable = [...root.querySelectorAll<HTMLElement>(".tut-card button:not([hidden])")];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === root.querySelector(".tut-card"))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function render() {
  if (!root || !steps) return;
  const list = steps();
  const step = list[index];
  const ui = UI[getLang()];
  const last = index === list.length - 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  root.querySelector(".tut-count")!.textContent = `${pad(index + 1)} ${ui.of} ${pad(list.length)}`;
  root.querySelector(".tut-title")!.textContent = step.title[getLang()];
  root.querySelector(".tut-body")!.textContent = step.body[getLang()];
  root.querySelector(".tut-skip")!.textContent = ui.skip;
  root.querySelector<HTMLElement>(".tut-skip")!.hidden = last;
  const back = root.querySelector<HTMLButtonElement>(".tut-back")!;
  back.textContent = ui.back;
  back.hidden = index === 0;
  root.querySelector(".tut-next")!.textContent = index === 0 ? ui.start : last ? ui.done : ui.next;
}

/** Coloca el resaltado sobre el elemento del paso y la tarjeta al lado (debajo, encima o, en móvil, abajo del todo). */
function place() {
  if (!root || !steps) return;
  const step = steps()[index];
  const spot = root.querySelector<HTMLElement>(".tut-spot")!;
  const card = root.querySelector<HTMLElement>(".tut-card")!;
  const target = visibleTarget(step);
  // Al cambiar de forma de colocar la tarjeta (centrada, abajo en móvil o junto al elemento) se salta sin transición:
  // animar left/top entre formas distintas la haría pasar un instante fuera de la pantalla.
  const mode = !target ? "centered" : narrow() ? "docked" : "placed";
  if (mode !== lastMode) {
    root.classList.add("tut-jump");
    lastMode = mode;
    try { position(spot, card, target); } finally {
      void card.offsetWidth; // aplica las posiciones nuevas antes de volver a activar las transiciones
      root.classList.remove("tut-jump");
    }
    return;
  }
  position(spot, card, target);
}

function position(spot: HTMLElement, card: HTMLElement, target: HTMLElement | null) {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  root!.classList.toggle("is-centered", !target);
  root!.classList.toggle("is-docked", !!target && narrow());
  if (!target) {
    spot.hidden = true;
    card.style.left = card.style.top = "";
    return;
  }
  const r = target.getBoundingClientRect();
  const p = 6;
  spot.hidden = false;
  Object.assign(spot.style, {
    left: `${r.left - p}px`, top: `${r.top - p}px`, width: `${r.width + 2 * p}px`, height: `${r.height + 2 * p}px`,
  });
  if (narrow()) { card.style.left = card.style.top = ""; return; }
  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const below = r.bottom + p + GAP;
  const above = r.top - p - GAP - h;
  const clampTop = (y: number) => Math.min(Math.max(EDGE, y), vh - h - EDGE);
  let top: number;
  let left = Math.min(Math.max(EDGE, r.left), vw - w - EDGE);
  if (below + h <= vh - EDGE) top = below;
  else if (above >= EDGE) top = above;
  else if (r.right + p + GAP + w <= vw - EDGE) { left = r.right + p + GAP; top = clampTop(r.top); }
  else if (r.left - p - GAP - w >= EDGE) { left = r.left - p - GAP - w; top = clampTop(r.top); }
  else { left = vw - w - EDGE; top = vh - h - EDGE; } // el elemento ocupa casi toda la ventana: abajo a la derecha
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

function schedulePlace() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(place);
}

function go(next: number) {
  if (!root || !steps) return;
  const list = steps();
  if (next >= list.length) { close(); return; }
  index = Math.max(0, next);
  render();
  const target = visibleTarget(list[index]);
  if (target) {
    const r = target.getBoundingClientRect();
    // En móvil la tarjeta ocupa la parte de abajo: el elemento sube arriba. En escritorio, solo si no se ve entero.
    const outOfView = r.top < 72 || r.bottom > window.innerHeight - 24;
    if (narrow() || outOfView) {
      const y = window.scrollY + r.top - (narrow() ? 72 : Math.max(72, (window.innerHeight - r.height) / 3));
      // Instantáneo: con los globos 3D dibujando, el desplazamiento suave puede tardar segundos en empezar en un
      // equipo lento. El resaltado y la tarjeta ya se deslizan a su sitio y guían la vista.
      window.scrollTo({ top: Math.max(0, y), behavior: "instant" });
    }
  }
  place();
  // Por si la página cambia de tamaño justo después (fuentes, mosaicos): se vuelve a colocar un par de veces.
  for (const delay of [150, 500]) setTimeout(place, delay);
  root.querySelector<HTMLElement>(".tut-card")!.focus({ preventScroll: true });
}

function close() {
  if (!root) return;
  storage.markSeen();
  root.remove();
  root = null;
  window.removeEventListener("resize", schedulePlace);
  window.removeEventListener("scroll", schedulePlace, true);
  window.removeEventListener("scrollend", schedulePlace, true);
  document.documentElement.classList.remove("tut-open");
  returnFocus?.focus({ preventScroll: true });
  returnFocus = null;
}

export function openTutorial() {
  if (!steps || root) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  root = build();
  lastMode = "";
  document.body.append(root);
  document.documentElement.classList.add("tut-open");
  window.addEventListener("resize", schedulePlace);
  window.addEventListener("scroll", schedulePlace, true);
  window.addEventListener("scrollend", schedulePlace, true);
  go(0);
}

/**
 * Registra los pasos de la página y pone el botón «Guía» en la cabecera, junto a idioma y tema.
 * steps es una función para que cada página pueda elegir pasos según su estado (p. ej. el planificador de rutas).
 */
export function mountTutorial(pageSteps: () => TutorialStep[], { auto = false } = {}) {
  steps = pageSteps;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "tut-open-button";
  button.id = "tut-open";
  button.innerHTML = `<span class="tut-q" aria-hidden="true">?</span><span class="tut-open-text"></span>`;
  const label = () => {
    const ui = UI[getLang()];
    button.querySelector(".tut-open-text")!.textContent = ui.button;
    button.setAttribute("aria-label", ui.buttonLabel);
    button.title = ui.buttonLabel;
  };
  label();
  button.addEventListener("click", openTutorial);
  const prefs = document.querySelector(".masthead .prefs");
  if (prefs) prefs.prepend(button);
  else document.querySelector(".masthead")?.append(button);

  onLangChange(() => { label(); render(); schedulePlace(); });

  const param = new URLSearchParams(location.search).get("tutorial");
  if (param === "1" || (auto && param !== "0" && !storage.seen())) {
    // Después del primer pintado, cuando la página ya tiene su tamaño.
    requestAnimationFrame(() => setTimeout(openTutorial, 350));
  }
}
