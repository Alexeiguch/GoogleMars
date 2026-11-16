// (d) Marca (contrato C1): «GeoTwin» en la cabecera y en el título; ninguna imagen de la NASA;
// no aparecen «Google Mars», «Earth Analogs» ni «Análogos terrestres».
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, nuevoContexto, abrir, esperarArranque, BASE, PAGINAS, IDIOMAS, PASO } from './apoyo.mjs';

const MARCA = 'GeoTwin';
const NOMBRES_ANTIGUOS = ['Google Mars', 'GoogleMars', 'Earth Analogs', 'Análogos terrestres'];

let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

for (const lang of IDIOMAS) {
  for (const [nombre, ruta] of Object.entries(PAGINAS)) {
    test(`[${lang}] marca en ${ruta}`, { timeout: 4 * PASO }, async (t) => {
      const ctx = await nuevoContexto(navegador, { lang });
      try {
        const { page } = await abrir(ctx, ruta);
        await esperarArranque(page, lang);
        await page.addStyleTag({ content: '*{text-transform:none !important}' });
        const d = await page.evaluate(() => {
          const { norm } = window.__e2e;
          const cab = document.querySelector('header, [role="banner"]');
          const ruta = (u) => { try { return new URL(u, location.href).pathname; } catch { return String(u); } };
          const imagenes = [];
          for (const el of document.querySelectorAll('img, svg image, input[type="image"], source, object, embed, link[rel~="icon"]')) {
            const src = el.currentSrc || el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('xlink:href') || el.getAttribute('data') || el.getAttribute('srcset') || '';
            const alt = el.getAttribute('alt') || el.getAttribute('aria-label') || '';
            // «nasa» en la ruta del archivo, o un texto alternativo que nombra el logo («NASA», «NASA logo»,
            // «Logo de la NASA», «NASA meatball»…). El dominio no cuenta: los mosaicos de trek.nasa.gov son datos de
            // imagen. Un crédito como «LRO image, NASA/GSFC» tampoco: es atribución, no el logo.
            const altLogo = /^\s*(?:(?:the\s+)?nasa(?:\s+(?:logo(?:type)?|insignia|meatball|emblem|worm))?|(?:logo(?:tipo)?|insignia|emblema)\s+(?:de\s+(?:la\s+)?)?nasa)\s*$/i;
            if (/nasa/i.test(ruta(src)) || altLogo.test(alt)) imagenes.push(`<${el.tagName.toLowerCase()}> src=${String(src).slice(0, 120)} alt=${alt}`);
          }
          for (const el of cab ? cab.querySelectorAll('*') : []) {
            const fondo = getComputedStyle(el).backgroundImage;
            if (/nasa/i.test(fondo)) imagenes.push(`fondo CSS en la cabecera: ${fondo.slice(0, 120)}`);
          }
          return { titulo: document.title, cabecera: norm(cab?.textContent), imagenes, cadenas: window.__e2e.recoger() };
        });
        await t.test(`la cabecera muestra «${MARCA}»`, () =>
          assert.ok(d.cabecera.includes(MARCA), `C1: la cabecera no contiene «${MARCA}». Texto de la cabecera: «${d.cabecera.slice(0, 200)}»`));
        await t.test(`el título del documento contiene «${MARCA}»`, () =>
          assert.ok(d.titulo.includes(MARCA), `C1: el título del documento es «${d.titulo}»`));
        await t.test('ninguna imagen del logo de la NASA (ruta con «nasa» o texto alternativo que nombra el logo)', () =>
          assert.deepEqual(d.imagenes, [], 'C1: las reglas de Space Apps prohíben el logo de la NASA'));
        await t.test('no aparecen los nombres antiguos del sitio', () => {
          const vistos = d.cadenas.filter(([, s]) => NOMBRES_ANTIGUOS.some((n) => s.includes(n))).map(([tipo, s]) => `${tipo}: ${s.slice(0, 120)}`);
          assert.deepEqual(vistos, [], `C1: ${ruta} (${nombre}) muestra un nombre antiguo del sitio`);
        });
      } finally { await ctx.close(); }
    });
  }
}

test('la portada «/» (redirección) no usa los nombres antiguos del sitio', { timeout: PASO }, async () => {
  const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(PASO) });
  assert.equal(r.status, 200, `GET / devolvió ${r.status}`);
  const html = await r.text();
  const vistos = NOMBRES_ANTIGUOS.filter((n) => html.includes(n));
  assert.deepEqual(vistos, [], 'C1: el HTML de «/» (lo que se ve un instante y en la pestaña) contiene un nombre antiguo');
});
