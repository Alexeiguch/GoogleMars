// Apoyo común de las pruebas de extremo a extremo de TerraTwin.
// Las pruebas se escriben contra los CONTRATOS C1-C6 (texto visible, roles, data-intro, data-aviso="sin-red"),
// no contra clases CSS ni ids de la app: aquí no hay ningún selector por id o clase propia de la app
// (la única clase usada es `.leaflet-container`, de la biblioteca Leaflet, para separar las teselas del mapa).
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const BASE = (process.env.BASE_URL || 'http://localhost:5183').replace(/\/+$/, '');
/** Tiempo máximo por paso (la máquina puede ir cargada): 60 s salvo que se indique otro. */
export const PASO = Number(process.env.E2E_PASO_MS || 60_000);
/** Espera corta para algo que, con la página ya lista, existe o no existe (un botón, un atributo). */
export const CORTA = Math.min(PASO, Number(process.env.E2E_CORTA_MS || 15_000));
export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const INFORMES = join(RAIZ, 'tests', 'e2e', 'informes');
export const VISTAS = { '1920x1080': { width: 1920, height: 1080 }, '375x812': { width: 375, height: 812 } };
export const PAGINAS = { mapa: '/luna-marte.html', globos: '/globos.html' };
export const IDIOMAS = ['en', 'es'];

/** C2: textos visibles exactos del guion de la demo. */
export const GUION = {
  en: { grupo: 'Shackleton crater (center according to the IAU)', gemelo: '1 · 29.50° S · 69.51° W', buscar: 'Find analogs', comparar: 'Compare terrain ↓' },
  es: { grupo: 'Cráter Shackleton (centro según la IAU)', gemelo: '1 · 29,50° S · 69,51° O', buscar: 'Buscar análogos', comparar: 'Comparar terreno ↓' },
};

export const leerJson = (rel) => JSON.parse(readFileSync(join(RAIZ, rel), 'utf8'));
export function guardarInforme(nombre, texto) {
  mkdirSync(INFORMES, { recursive: true });
  const ruta = join(INFORMES, nombre);
  writeFileSync(ruta, texto, 'utf8');
  return ruta;
}

const base = new URL(BASE);
/** Una URL es local si es del mismo origen que BASE_URL o de localhost; todo lo demás es «red externa». */
export function esLocal(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return true; // data:, blob:, about:
    return u.origin === base.origin || ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch { return true; }
}

/** Chrome del sistema (no se descarga ningún navegador). WebGL por software: igual en cualquier máquina. */
export async function abrirNavegador() {
  const gpu = process.env.E2E_GPU || 'sw';
  const args = gpu === 'sw'
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : ['--use-angle=d3d11', '--ignore-gpu-blocklist'];
  return chromium.launch({ channel: process.env.E2E_CANAL || 'chrome', headless: process.env.E2E_VER !== '1', args });
}

/**
 * Contexto nuevo con el idioma fijado por el contrato C4 (localStorage["analogs-lang"]).
 * sinRed: aborta todo lo que no sea local (C3).
 */
export async function nuevoContexto(browser, { lang = 'en', vista = '1920x1080', sinRed = false } = {}) {
  const movil = VISTAS[vista].width < 600;
  const ctx = await browser.newContext({
    viewport: VISTAS[vista], deviceScaleFactor: 1, colorScheme: 'dark',
    locale: lang === 'es' ? 'es-ES' : 'en-US',
    ...(movil ? { isMobile: true, hasTouch: true } : {}),
  });
  ctx.setDefaultTimeout(PASO);
  ctx.setDefaultNavigationTimeout(PASO);
  await ctx.addInitScript((l) => { try { localStorage.setItem('analogs-lang', l); } catch { /* sin almacenamiento */ } }, lang);
  await ctx.addInitScript(enPagina);
  // Contra el servidor de desarrollo: sin recarga en caliente, para que una edición ajena no recargue la página a media prueba.
  await ctx.routeWebSocket(/.*/, () => {});
  if (sinRed) await ctx.route((url) => !esLocal(url.href), (ruta) => ruta.abort('internetdisconnected'));
  return ctx;
}

/** Anota errores de consola, excepciones y peticiones locales fallidas de una página. */
export function vigilar(page) {
  const v = { consola: [], avisos: [], excepciones: [], localesFallidas: [], externasFallidas: [] };
  page.on('console', (m) => {
    const url = m.location()?.url || '';
    const texto = m.text();
    if (m.type() === 'error') {
      // Un mosaico externo que no carga depende de la red de la sala, no de la app: se anota aparte y no hace fallar.
      const externa = (url && !esLocal(url)) || [...texto.matchAll(/https?:\/\/[^\s'")]+/g)].some((x) => !esLocal(x[0]));
      if (externa && /Failed to load resource|net::ERR|CORS/i.test(texto)) { v.externasFallidas.push(url || texto.slice(0, 160)); return; }
      v.consola.push(`${texto.slice(0, 300)}${url ? ` [${url}]` : ''}`);
    } else if (m.type() === 'warning') v.avisos.push(texto.slice(0, 200));
  });
  page.on('pageerror', (e) => v.excepciones.push(String(e?.stack || e).slice(0, 400)));
  page.on('response', (r) => { if (r.status() >= 400 && esLocal(r.url())) v.localesFallidas.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => {
    const motivo = r.failure()?.errorText || '';
    if (esLocal(r.url()) && !/ERR_ABORTED/.test(motivo)) v.localesFallidas.push(`${motivo} ${r.url()}`);
  });
  return v;
}

/** Abre una ruta y devuelve la página con su vigilancia. No espera a la red: cada prueba espera su condición. */
export async function abrir(ctx, ruta) {
  const page = await ctx.newPage();
  const vig = vigilar(page);
  await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded' });
  return { page, vig };
}

/** Espera a que la página termine de arrancar: evento load, red en calma (con tope) y DOM quieto. */
export async function esperarArranque(page, lang) {
  await page.waitForLoadState('load');
  if (lang) await page.waitForFunction((l) => document.documentElement.lang === l, lang);
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  await quieto(page, 400, 8000);
}

/** Espera a que el DOM deje de cambiar durante `calma` ms (con tope `max`). */
export const quieto = (page, calma = 80, max = 1500) =>
  page.evaluate(([c, m]) => window.__e2e.quieto(c, m), [calma, max]).catch(() => {});

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Expresión para un texto visible exacto, tolerante con espacios (incluidos los de no separación). */
export const reTexto = (s) => new RegExp(s.trim().split(/\s+/).map(escapar).join('\\s+'));
/**
 * Expresión para el gemelo «1 · 29.50° S · 69.51° W»: el número de orden al principio y después las coordenadas.
 * Entre ambos se admite el separador «·» o solo un espacio (hoy el número va en su propia etiqueta).
 */
export function reGemelo(s) {
  const [n, ...resto] = s.split(' · ');
  return new RegExp(`^\\s*${escapar(n)}[\\s·]*${resto.map(escapar).join('\\s*·\\s*').replace(/ /g, '\\s*')}`);
}

/**
 * Busca un elemento pulsable y visible cuyo texto cumple la expresión (por texto y rol, nunca por id o clase)
 * y espera hasta `timeout`. Devuelve el ElementHandle o null.
 */
export async function esperarPulsable(page, re, { timeout = PASO } = {}) {
  const fin = Date.now() + timeout;
  for (;;) {
    const h = await page.evaluateHandle(([s, f]) => window.__e2e.pulsable(s, f), [re.source, re.flags]).catch(() => null);
    const el = h?.asElement();
    if (el) return el;
    await h?.dispose();
    if (Date.now() > fin) return null;
    await page.waitForTimeout(250);
  }
}

/** Sondea una función asíncrona hasta que devuelve algo que cumple `listo` o vence el tiempo. Devuelve el último valor. */
export async function sondear(fn, listo, { timeout = PASO, cada = 300, page } = {}) {
  const fin = Date.now() + timeout;
  let ultimo;
  for (;;) {
    ultimo = await fn().catch((e) => ({ error: String(e).slice(0, 200) }));
    if (ultimo && !ultimo.error && listo(ultimo)) return ultimo;
    if (Date.now() > fin) return ultimo;
    if (page) await page.waitForTimeout(cada); else await new Promise((r) => setTimeout(r, cada));
  }
}

/**
 * Recorre el guion del mapa: pulsa el grupo y luego el gemelo, y espera la ficha con sus dos imágenes de relieve.
 * Devuelve { grupo, gemelo, ficha } (null en lo que no se encontró).
 */
export async function guionMapa(page, lang) {
  const g = GUION[lang];
  const grupo = await esperarPulsable(page, reTexto(g.grupo));
  if (!grupo) return { grupo: null, gemelo: null, ficha: null };
  await grupo.click();
  const gemelo = await esperarPulsable(page, reGemelo(g.gemelo));
  if (!gemelo) return { grupo, gemelo: null, ficha: null };
  await gemelo.click();
  // La ficha: el bloque con título que contiene las imágenes, nombra a Shackleton y la longitud del gemelo.
  const lon = g.gemelo.split(' · ')[2].replace(/°.*$/, '');
  const ficha = await sondear(
    () => page.evaluate(([el, claves]) => window.__e2e.ficha(el, claves), [grupo, ['Shackleton', lon]]),
    (f) => f.imagenes.length >= 2 && f.imagenes.every((i) => i.completa && i.ancho > 0),
    { page },
  );
  return { grupo, gemelo, ficha };
}

/** Estadísticas de color de un PNG (captura de un elemento), calculadas en una página en blanco del mismo contexto. */
export async function estadisticasImagen(ctx, png) {
  const p = await ctx.newPage();
  try {
    return await p.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const cuenta = new Map();
      let n = 0;
      for (let i = 0; i < d.length; i += 4 * 5) {
        const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
        cuenta.set(k, (cuenta.get(k) || 0) + 1); n++;
      }
      return { ancho: c.width, alto: c.height, colores: cuenta.size, dominante: Math.max(...cuenta.values()) / n };
    }, png.toString('base64'));
  } finally { await p.close(); }
}
/** Un lienzo «con dibujo»: varios colores y ninguno ocupa casi todo. */
export const conDibujo = (e) => !!e && e.ancho > 50 && e.alto > 50 && e.colores >= 12 && e.dominante < 0.97;

/** Captura un lienzo tal como lo ve el usuario y mide si tiene dibujo; reintenta hasta `timeout`. */
export async function esperarDibujo(ctx, page, lienzo, { timeout = PASO } = {}) {
  return sondear(async () => estadisticasImagen(ctx, await lienzo.screenshot({ type: 'png' })), conDibujo, { timeout, cada: 700, page });
}

// ---------------------------------------------------------------------------------------------------------
// Código que se ejecuta dentro de la página (se instala como window.__e2e antes de los scripts de la app).
function enPagina() {
  const norm = (s) => String(s ?? '').replace(/[\s  ]+/g, ' ').replace(/−/g, '-').trim();
  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const PULSABLES = 'summary, button, a, [role="button"], [role="tab"], [role="link"], [role="option"], [role="row"], [role="menuitem"], [tabindex]';
  const vistos = new Set();
  window.__e2e = {
    norm, visible,
    /** Elemento pulsable visible cuyo texto cumple la expresión; si hay varios, el de texto más corto (el más concreto). */
    pulsable(fuente, banderas) {
      const re = new RegExp(fuente, banderas);
      let mejor = null, largo = Infinity;
      for (const el of document.querySelectorAll(PULSABLES)) {
        if (el.tagName === 'OPTION' || !visible(el)) continue;
        const tx = norm(el.textContent);
        if (re.test(tx) && tx.length < largo) { mejor = el; largo = tx.length; }
      }
      return mejor;
    },
    quieto(calma, max) {
      return new Promise((ok) => {
        let t = setTimeout(fin, calma);
        const tope = setTimeout(fin, max);
        const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(fin, calma); });
        mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
        function fin() { clearTimeout(t); clearTimeout(tope); mo.disconnect(); ok(true); }
      });
    },
    /**
     * La ficha: el bloque más pequeño que contiene al menos dos imágenes que no son teselas del mapa, tiene un
     * título, su texto incluye todas las `claves` y no contiene a `excluir` (la lista desde la que se pulsó).
     */
    ficha(excluir, claves) {
      const imgs = [...document.images].filter((i) => !i.closest('.leaflet-container') && visible(i));
      for (const img of imgs) {
        for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
          if (excluir && el.contains(excluir)) break;
          const dentro = imgs.filter((i) => el.contains(i));
          if (dentro.length < 2 || !el.querySelector('h1,h2,h3,h4,h5,[role="heading"]')) continue;
          const texto = norm(el.textContent);
          if (!claves.every((c) => texto.includes(c))) continue;
          return {
            titulo: norm(el.querySelector('h1,h2,h3,h4,h5,[role="heading"]').textContent),
            lineas: el.innerText.split('\n').map(norm).filter(Boolean),
            imagenes: dentro.map((i) => ({ src: i.currentSrc || i.src, completa: i.complete, ancho: i.naturalWidth, alt: i.alt })),
            // Elementos hoja cuyo texto es un entero de 0 a 100: las puntuaciones.
            enteros: [...el.querySelectorAll('*')].filter((e) => !e.children.length && /^\d{1,3}$/.test(norm(e.textContent)) && +norm(e.textContent) <= 100 && visible(e)).map((e) => +norm(e.textContent)),
            filas: [...el.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => norm(c.textContent))),
          };
        }
      }
      return { imagenes: imgs.slice(0, 6).map((i) => ({ src: i.currentSrc || i.src, completa: i.complete, ancho: i.naturalWidth })), sinFicha: true };
    },
    /** Lienzo de la comparación: el que está dentro del destino del enlace pulsado o, si no, el más visible. */
    lienzo(enlace) {
      const href = enlace?.getAttribute?.('href') || '';
      const destino = href.startsWith('#') && href.length > 1 ? document.getElementById(decodeURIComponent(href.slice(1))) : null;
      const dentro = destino?.querySelector('canvas');
      if (dentro) return dentro;
      let mejor = null, area = 0;
      for (const c of document.querySelectorAll('canvas')) {
        const r = c.getBoundingClientRect();
        const a = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        if (a > area) { area = a; mejor = c; }
      }
      return mejor;
    },
    /** ¿Está el elemento entero dentro de la ventana sin desplazarse? */
    enVentana(el) {
      if (!visible(el)) return false;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5;
    },
    /** Todo el texto que puede ver o leer el usuario ahora; devuelve solo las cadenas que no se habían visto. */
    recoger() {
      const out = [];
      const add = (tipo, s) => { const v = norm(s); if (v.length < 2) return; const k = tipo + '\u0001' + v; if (vistos.has(k)) return; vistos.add(k); out.push([tipo, v]); };
      for (const l of document.body.innerText.split('\n')) add('texto', l);
      for (const o of document.querySelectorAll('option')) add('opción', o.textContent);
      for (const e of document.querySelectorAll('[aria-label],[title],[alt],[placeholder]')) {
        for (const a of ['aria-label', 'title', 'alt', 'placeholder']) if (e.hasAttribute(a)) add(a, e.getAttribute(a));
      }
      for (const e of document.querySelectorAll('svg title, svg desc')) add('svg', e.textContent);
      add('título', document.title);
      return out;
    },
    abrirPlegables() {
      let n = 0;
      for (const d of document.querySelectorAll('details:not([open])')) { d.open = true; n++; }
      return n;
    },
    /** Botones que el recorrido de idioma puede pulsar: visibles, activos y fuera de la cabecera (idioma y tema). */
    botones() {
      return [...document.querySelectorAll('button, [role="button"]')].filter((b) => {
        if (!visible(b) || b.disabled || b.closest('header, [role="banner"], nav')) return false;
        const tx = norm(b.textContent);
        return !/^(es|en|español|english)$/i.test(tx) && !b.hasAttribute('lang') && !b.hasAttribute('hreflang');
      });
    },
    /** Clasifica los botones: filas de listas, conmutadores (aria-pressed) y el resto. Devuelve índices sobre botones(). */
    planBotones() {
      const bs = this.botones();
      const plan = { conmutadores: [], filas: [], primerasFilas: [], otros: [] };
      const vistosEn = new Set();
      bs.forEach((b, i) => {
        const tx = norm(b.textContent).slice(0, 60);
        if (b.hasAttribute('aria-pressed') && b.closest('[role="group"]')) plan.conmutadores.push([i, tx]);
        else if (b.closest('li')) {
          const plegable = b.closest('details');
          if (!plegable) { plan.filas.push([i, tx]); if (plan.primerasFilas.length < 3) plan.primerasFilas.push([i, tx]); }
          else if (!vistosEn.has(plegable)) { vistosEn.add(plegable); plan.filas.push([i, tx]); }
        } else plan.otros.push([i, tx]);
      });
      return plan;
    },
    pulsarBoton(i) { const b = this.botones()[i]; if (!b) return false; b.click(); return true; },
    selectores() {
      return [...document.querySelectorAll('select')].map((s, k) => ({ k, visible: visible(s), opciones: [...s.options].map((o) => ({ texto: norm(o.textContent), inactiva: o.disabled })) }));
    },
    elegir(k, i) {
      const s = document.querySelectorAll('select')[k];
      if (!s || !s.options[i] || s.options[i].disabled) return false;
      s.selectedIndex = i;
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
  };
}
