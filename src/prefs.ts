// Botones de idioma (ES/EN) y tema (claro/oscuro), lema de TerraTwin e insignia del reto en la cabecera de las páginas.
// El tema y el idioma iniciales los fija el script en línea del <head> para que no haya parpadeo.
import { applyStatic, getLang, onLangChange, setLang, t, type Lang } from "./i18n";

type Theme = "light" | "dark";
const THEME_KEY = "analogs-theme";
const THEME_COLOR: Record<Theme, string> = { dark: "#151517", light: "#f4f1ec" };

/**
 * Textos de interfaz nuevos de cada página (introducción, títulos de sección…) que no están en i18n.ts.
 * Rellena los elementos con data-ui="clave" y los vuelve a pintar al cambiar de idioma.
 * {nombre} se sustituye por params[nombre].
 */
export type UiText = Record<Lang, Record<string, string>>;
export function bindUiText(dict: UiText, params: Record<string, string | number> = {}) {
  const apply = () => {
    const strings = dict[getLang()];
    for (const el of document.querySelectorAll<HTMLElement>("[data-ui]")) {
      const text = strings[el.dataset.ui!];
      if (text != null) el.textContent = text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ""));
    }
  };
  apply();
  onLangChange(apply);
}

const root = document.documentElement;
const currentTheme = (): Theme => (root.dataset.theme === "light" ? "light" : "dark");

const sun = `<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const moon = `<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>`;

function setTheme(theme: Theme) {
  root.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* almacenamiento bloqueado */ }
  syncTheme();
}

const box = document.createElement("div");
box.className = "prefs";
box.setAttribute("role", "group");
box.dataset.i18nAttr = "aria-label:prefs.label";
box.innerHTML = `
  <div class="lang-switch" role="group" data-i18n-attr="aria-label:prefs.lang">
    <button type="button" data-lang="es" lang="es" aria-label="Español">ES</button>
    <button type="button" data-lang="en" lang="en" aria-label="English">EN</button>
  </div>
  <button type="button" class="theme-toggle">${sun}${moon}</button>`;
document.querySelector(".masthead")?.append(box);

// Marca TerraTwin: lema junto al título e insignia del reto, solo con texto.
// No se usa ninguna imagen de la NASA (las reglas de Space Apps prohíben su logotipo); el nombre del reto sí puede citarse.
// Estos textos viven aquí y no en i18n.ts para no tocar el diccionario compartido.
const BRAND_TEXT: Record<Lang, { tagline: string; lead: string; event: string; description: string }> = {
  es: {
    tagline: "La Luna y Marte, en la Tierra.",
    lead: "Proyecto para",
    event: "NASA Space Apps Challenge 2026",
    description: "TerraTwin busca en toda la tierra firme lugares parecidos a las zonas candidatas para una base lunar y a sitios de Marte, y dice en qué se parecen y en qué no.",
  },
  en: {
    tagline: "Find the Moon and Mars on Earth.",
    lead: "Built for",
    event: "NASA Space Apps Challenge 2026",
    description: "TerraTwin searches all of Earth's land for places that resemble the candidate zones for a Moon base and sites on Mars, and tells you where they match and where they do not.",
  },
};
const brand = document.createElement("div");
brand.className = "brand-line";
brand.innerHTML = `
  <p class="brand-tagline"></p>
  <p class="brand-event"><span class="brand-event__lead"></span> <span class="brand-event__name"></span></p>`;
document.querySelector(".masthead h1")?.after(brand);

// Icono de la página y descripción: se añaden aquí si el HTML no los trae, para que las dos páginas los compartan.
function ensureHead<T extends HTMLElement>(selector: string, create: () => T): T {
  const found = document.head.querySelector<T>(selector);
  if (found) return found;
  const el = create();
  document.head.append(el);
  return el;
}
ensureHead<HTMLLinkElement>('link[rel~="icon"]', () => {
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/svg+xml";
  link.href = `${import.meta.env.BASE_URL}favicon.svg`;
  return link;
});
const description = ensureHead<HTMLMetaElement>('meta[name="description"]', () => {
  const meta = document.createElement("meta");
  meta.name = "description";
  return meta;
});

function syncBrand() {
  const text = BRAND_TEXT[getLang()];
  brand.querySelector(".brand-tagline")!.textContent = text.tagline;
  brand.querySelector(".brand-event__lead")!.textContent = text.lead;
  brand.querySelector(".brand-event__name")!.textContent = text.event;
  description.content = text.description;
}

const langButtons = box.querySelectorAll<HTMLButtonElement>("[data-lang]");
const themeButton = box.querySelector<HTMLButtonElement>(".theme-toggle")!;

function syncLang() {
  for (const button of langButtons) button.setAttribute("aria-pressed", String(button.dataset.lang === getLang()));
}

function syncTheme() {
  const label = t(currentTheme() === "dark" ? "prefs.toLight" : "prefs.toDark");
  themeButton.setAttribute("aria-label", label);
  themeButton.title = label;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[currentTheme()]);
}

for (const button of langButtons) button.addEventListener("click", () => setLang(button.dataset.lang as Lang));
themeButton.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
onLangChange(() => { syncLang(); syncTheme(); syncBrand(); });

applyStatic();
syncLang();
syncTheme();
syncBrand();
