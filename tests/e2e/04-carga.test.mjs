// (e) Cada página, en los dos idiomas y a 1920x1080 y 375x812: carga sin errores de consola, sin excepciones y
// sin peticiones locales fallidas; sin desborde horizontal; y con la frase de entrada [data-intro] (C5) visible
// sin desplazarse.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, nuevoContexto, abrir, esperarArranque, PAGINAS, IDIOMAS, VISTAS, PASO } from './apoyo.mjs';
import { espanolEnIngles, inglesEnEspanol } from './idioma.mjs';

let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

for (const lang of IDIOMAS) {
  for (const vista of Object.keys(VISTAS)) {
    for (const ruta of Object.values(PAGINAS)) {
      test(`[${lang}, ${vista}] ${ruta} carga limpia`, { timeout: 4 * PASO }, async (t) => {
        const ctx = await nuevoContexto(navegador, { lang, vista });
        try {
          const { page, vig } = await abrir(ctx, ruta);
          await esperarArranque(page, lang);
          const m = await page.evaluate(() => {
            const { norm, visible, enVentana } = window.__e2e;
            const de = document.documentElement;
            const fuera = [...document.querySelectorAll('body *')].filter((e) => {
              const r = e.getBoundingClientRect();
              return r.width > 0 && r.right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.leaflet-container');
            }).slice(0, 6).map((e) => `<${e.tagName.toLowerCase()}> «${norm(e.textContent).slice(0, 40)}» right=${Math.round(e.getBoundingClientRect().right)}`);
            return {
              lang: de.lang, scrollY: Math.round(scrollY), scrollWidth: de.scrollWidth, innerWidth, innerHeight, fuera,
              intro: [...document.querySelectorAll('[data-intro]')].map((e) => {
                const r = e.getBoundingClientRect();
                return { texto: norm(e.textContent), visible: visible(e), enVentana: enVentana(e), caja: [r.left, r.top, r.right, r.bottom].map(Math.round) };
              }),
            };
          });
          if (vig.externasFallidas.length) t.diagnostic(`${vig.externasFallidas.length} recursos externos no cargaron (red de la sala; no hace fallar): ${[...new Set(vig.externasFallidas)].slice(0, 3).join(' ')}`);
          if (vig.avisos.length) t.diagnostic(`${vig.avisos.length} avisos de consola (no hacen fallar): ${[...new Set(vig.avisos)].slice(0, 3).join(' | ')}`);

          await t.test('sin errores de consola', () => assert.deepEqual(vig.consola, []));
          await t.test('sin excepciones no capturadas', () => assert.deepEqual(vig.excepciones, []));
          await t.test('sin peticiones locales fallidas (404…)', () => assert.deepEqual(vig.localesFallidas, []));
          await t.test('sin desborde horizontal', () =>
            assert.ok(m.scrollWidth <= m.innerWidth, `scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}. Elementos que se salen: ${m.fuera.join(' ; ')}`));
          await t.test('la frase de entrada [data-intro] se ve sin desplazarse', () => {
            assert.ok(m.intro.length > 0, `C5: ${ruta} no tiene ningún elemento con el atributo data-intro`);
            const ok = m.intro.find((i) => i.visible && i.enVentana && i.texto.length >= 20);
            assert.ok(ok, `C5: [data-intro] no está entero y visible dentro de ${m.innerWidth}x${m.innerHeight} sin desplazarse (scrollY=${m.scrollY}): ${JSON.stringify(m.intro)}`);
            const fugas = (lang === 'en' ? espanolEnIngles : inglesEnEspanol)(ok.texto);
            assert.deepEqual(fugas, [], `C5/C6: la frase de entrada «${ok.texto}» no está en ${lang === 'en' ? 'inglés' : 'español'}`);
          });
        } finally { await ctx.close(); }
      });
    }
  }
}
