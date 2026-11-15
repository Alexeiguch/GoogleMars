// (f) Sin red externa (contrato C3): se aborta todo lo que no sea local (Esri, trek.nasa.gov, fuentes…).
// Las dos páginas siguen mostrando su contenido, usan las imágenes locales de public/imagery/ y enseñan un
// aviso visible con role="status" y data-aviso="sin-red".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, nuevoContexto, abrir, esLocal, GUION, PASO, esperarPulsable, reTexto, esperarDibujo, conDibujo, sondear } from './apoyo.mjs';
import { espanolEnIngles } from './idioma.mjs';

const lang = 'en';
/** Margen para que la app decida que la red externa «tarda demasiado» y saque el aviso. */
const ESPERA_AVISO = Math.min(PASO, 45_000);

let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

async function abrirSinRed(ruta) {
  const ctx = await nuevoContexto(navegador, { lang, sinRed: true });
  const { page, vig } = await abrir(ctx, ruta);
  const red = { imagery: [], externasPedidas: 0 };
  page.on('request', (r) => { if (!esLocal(r.url())) red.externasPedidas++; });
  page.on('response', (r) => { if (esLocal(r.url()) && /\/imagery\//.test(new URL(r.url()).pathname) && r.status() < 400) red.imagery.push(new URL(r.url()).pathname); });
  await page.reload({ waitUntil: 'domcontentloaded' }); // con los contadores ya puestos
  return { ctx, page, vig, red };
}

async function comprobarAviso(page) {
  const aviso = await sondear(
    () => page.evaluate(() => [...document.querySelectorAll('[data-aviso="sin-red"]')].map((e) => ({
      visible: window.__e2e.visible(e), texto: window.__e2e.norm(e.textContent),
      estado: e.getAttribute('role') === 'status' || e.tagName === 'OUTPUT' || !!e.closest('[role="status"]'),
    }))),
    (lista) => lista.some((a) => a.visible),
    { timeout: ESPERA_AVISO, page },
  );
  assert.ok(Array.isArray(aviso) && aviso.length > 0, 'C3: sin red externa no aparece ningún elemento [data-aviso="sin-red"]');
  const visible = aviso.find((a) => a.visible);
  assert.ok(visible, `C3: el aviso [data-aviso="sin-red"] existe pero no es visible: ${JSON.stringify(aviso)}`);
  assert.ok(visible.estado, 'C3: el aviso sin red no tiene role="status"');
  assert.ok(visible.texto.length >= 10, `C3: el aviso sin red no tiene texto: «${visible.texto}»`);
  assert.deepEqual(espanolEnIngles(visible.texto), [], `C6: el aviso sin red «${visible.texto}» no está en inglés`);
}

test('[en] sin red externa: luna-marte.html sigue siendo usable y avisa', { timeout: 6 * PASO }, async (t) => {
  const { ctx, page, vig, red } = await abrirSinRed('/luna-marte.html');
  try {
    await t.test('muestra su contenido: el guion del mapa sigue funcionando', async () => {
      const grupo = await esperarPulsable(page, reTexto(GUION[lang].grupo));
      assert.ok(grupo, `Sin red externa no aparece «${GUION[lang].grupo}»`);
      const texto = await page.evaluate(() => document.body.innerText.length);
      assert.ok(texto > 1000, `Sin red externa la página casi no tiene texto (${texto} caracteres)`);
    });
    await t.test('aviso visible [data-aviso="sin-red"] con role="status"', () => comprobarAviso(page));
    await t.test('el mapa usa una imagen local de public/imagery/', () =>
      assert.ok(red.imagery.length > 0, `C3: no se cargó ninguna imagen de /imagery/ (el mapa base se queda sin fondo). Peticiones externas abortadas: ${red.externasPedidas}`));
    await t.test('sin excepciones no capturadas', () => assert.deepEqual(vig.excepciones, []));
  } finally { await ctx.close(); }
});

test('[en] sin red externa: globos.html sigue siendo usable y avisa', { timeout: 6 * PASO }, async (t) => {
  const { ctx, page, vig, red } = await abrirSinRed('/globos.html');
  try {
    await t.test('muestra su contenido: globos con dibujo y lista de análogos', async () => {
      const lienzo = await sondear(async () => (await page.evaluateHandle(() => window.__e2e.lienzo(null))).asElement(), (el) => !!el, { page });
      assert.ok(lienzo && !lienzo.error, 'Sin red externa no hay ningún <canvas> visible para los globos');
      const e = await esperarDibujo(ctx, page, lienzo);
      assert.ok(conDibujo(e), `Sin red externa el lienzo de los globos está vacío: ${JSON.stringify(e)}`);
      const texto = await page.evaluate(() => document.body.innerText.length);
      assert.ok(texto > 1000, `Sin red externa la página casi no tiene texto (${texto} caracteres)`);
    });
    await t.test('aviso visible [data-aviso="sin-red"] con role="status"', () => comprobarAviso(page));
    await t.test('los globos usan las imágenes locales de public/imagery/', () =>
      assert.ok(red.imagery.length > 0, `C3: no se cargó ninguna imagen de /imagery/. Peticiones externas abortadas: ${red.externasPedidas}`));
    await t.test('sin excepciones no capturadas', () => assert.deepEqual(vig.excepciones, []));
  } finally { await ctx.close(); }
});
