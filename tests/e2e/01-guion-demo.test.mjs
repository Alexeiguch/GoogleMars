// (a) y (b) Guion de la demo ante el jurado, en inglés y en español (contrato C2: textos visibles exactos).
//   Mapa:   luna-marte.html → grupo Shackleton → gemelo 1 → ficha con puntuación y dos imágenes de relieve cargadas.
//   Globos: globos.html y «/» → «Find analogs» → «Compare terrain ↓» → lienzo de la comparación 3D con dibujo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, nuevoContexto, abrir, GUION, IDIOMAS, PASO, CORTA, guionMapa, esperarPulsable, esperarDibujo, conDibujo } from './apoyo.mjs';

let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** «Compare terrain ↓»: el texto y la flecha pueden ir en etiquetas distintas, con o sin espacio entre ambos. */
const reConFlecha = (s) => new RegExp(s.replace(/\s*↓$/, '').trim().split(/\s+/).map(escapar).join('\\s+') + '\\s*↓');

for (const lang of IDIOMAS) {
  const g = GUION[lang];

  test(`[${lang}] guion del mapa: «${g.grupo}» → «${g.gemelo}» → ficha con puntuación y relieve`, { timeout: 5 * PASO }, async () => {
    const ctx = await nuevoContexto(navegador, { lang });
    try {
      const { page, vig } = await abrir(ctx, '/luna-marte.html');
      const r = await guionMapa(page, lang);
      assert.ok(r.grupo, `C2: no hay ningún elemento pulsable y visible con el texto «${g.grupo}» en luna-marte.html`);
      assert.ok(r.gemelo, `C2: tras pulsar el grupo no aparece un gemelo pulsable «${g.gemelo}»`);
      assert.ok(r.ficha && !r.ficha.sinFicha, `Tras pulsar el gemelo no aparece su ficha (un bloque con título que nombre a Shackleton, la longitud del gemelo y dos imágenes). Imágenes vistas: ${JSON.stringify(r.ficha?.imagenes ?? r.ficha)}`);
      assert.ok(r.ficha.enteros.length > 0, `La ficha «${r.ficha.titulo}» no muestra ninguna puntuación numérica de 0 a 100`);
      const rotas = r.ficha.imagenes.filter((i) => !(i.completa && i.ancho > 0));
      assert.ok(r.ficha.imagenes.length >= 2 && rotas.length === 0, `Las imágenes de relieve de la ficha no están todas cargadas (naturalWidth > 0): ${JSON.stringify(r.ficha.imagenes)}`);
      assert.deepEqual(vig.excepciones, [], 'Excepciones no capturadas durante el guion del mapa');
    } finally { await ctx.close(); }
  });

  for (const ruta of ['/globos.html', '/']) {
    test(`[${lang}] guion de los globos desde ${ruta}: «${g.buscar}» → «${g.comparar}» → comparación 3D`, { timeout: 6 * PASO }, async (t) => {
      const ctx = await nuevoContexto(navegador, { lang });
      try {
        const { page, vig } = await abrir(ctx, ruta);
        // La página está lista cuando se puede pulsar «Compare terrain ↓» (con «/» incluye la redirección).
        const lista = await esperarPulsable(page, reConFlecha(g.comparar));

        await t.test(`hay un botón «${g.buscar}» y se puede pulsar`, async () => {
          const boton = page.getByRole('button', { name: g.buscar, exact: true }).first();
          const hay = await boton.waitFor({ state: 'visible', timeout: lista ? CORTA : PASO }).then(() => true, () => false);
          if (!hay) {
            const botones = await page.evaluate(() => window.__e2e.botones().map((b) => window.__e2e.norm(b.textContent)).filter(Boolean).slice(0, 30)).catch(() => []);
            assert.fail(`C2: no hay ningún botón visible llamado «${g.buscar}» en ${new URL(page.url()).pathname}. Botones visibles: ${botones.join(' | ')}`);
          }
          await boton.click();
        });

        await t.test(`«${g.comparar}» lleva a un lienzo 3D con dibujo`, async () => {
          const enlace = await esperarPulsable(page, reConFlecha(g.comparar), { timeout: lista ? CORTA : PASO });
          assert.ok(enlace, `C2: no hay ningún enlace o botón visible con el texto «${g.comparar}» en ${new URL(page.url()).pathname}`);
          await enlace.click();
          const h = await page.evaluateHandle((a) => window.__e2e.lienzo(a), enlace);
          const lienzo = h.asElement();
          assert.ok(lienzo, 'No existe ningún <canvas> para la comparación 3D');
          const e = await esperarDibujo(ctx, page, lienzo);
          assert.ok(conDibujo(e), `El lienzo de la comparación 3D está vacío o de un solo color: ${JSON.stringify(e)}`);
        });

        await t.test('sin excepciones no capturadas', () => assert.deepEqual(vig.excepciones, []));
      } finally { await ctx.close(); }
    });
  }
}
