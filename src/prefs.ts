// Botones de idioma (ES/EN) y tema (claro/oscuro) en la cabecera de las dos páginas.
// El tema y el idioma iniciales los fija el script en línea del <head> para que no haya parpadeo.
import "@fontsource/fira-sans/latin-400.css";
import "@fontsource/fira-sans/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import { applyStatic, getLang, onLangChange, setLang, t, type Lang } from "./i18n";

type Theme = "light" | "dark";
const THEME_KEY = "analogs-theme";

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

const langButtons = box.querySelectorAll<HTMLButtonElement>("[data-lang]");
const themeButton = box.querySelector<HTMLButtonElement>(".theme-toggle")!;

function syncLang() {
  for (const button of langButtons) button.setAttribute("aria-pressed", String(button.dataset.lang === getLang()));
}

function syncTheme() {
  const label = t(currentTheme() === "dark" ? "prefs.toLight" : "prefs.toDark");
  themeButton.setAttribute("aria-label", label);
  themeButton.title = label;
}

for (const button of langButtons) button.addEventListener("click", () => setLang(button.dataset.lang as Lang));
themeButton.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
onLangChange(() => { syncLang(); syncTheme(); });

applyStatic();
syncLang();
syncTheme();
