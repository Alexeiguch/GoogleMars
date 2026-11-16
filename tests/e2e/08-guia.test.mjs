// (h) Guía de uso: en la primera visita a la portada se abre sola una guía paso a paso (diálogo), en el idioma de la
// app; cada paso cabe en la pantalla; al terminarla o saltarla no vuelve a abrirse sola, y el botón «Guía» / «Guide»
// de la cabecera la abre otra vez (también en el mapa). Al entrar directo al planificador no se abre sola.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, nuevoContexto, abrir, ir, esperarArranque, BASE, PASO, CORTA } from './apoyo.mjs';

const TEXTOS = {
  es: { bienvenida: 'Bienvenido a TerraTwin', boton: 'Cómo se usa TerraTwin', saltar: 'Saltar guía', listo: 'Listo', mapa: 'Mapa Luna y Marte' },
  en: { bienvenida: 'Welcome to TerraTwin', boton: 'How to use TerraTwin', saltar: 'Skip guide', listo: 'Done', mapa: 'Moon & Mars map' },
};
const PASOS_PORTADA = 7;

let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

/** Recorre la guía abierta con «Siguiente» hasta cerrarla; devuelve los títulos y si cada tarjeta cabía en pantalla. */
async function recorrer(page) {
  const dialogo = page.getByRole('dialog');
  const pasos = [];
  for (let i = 0; i < 12 && await dialogo.isVisible(); i++) {
    const caja = await dialogo.boundingBox();
    const vista = page.viewportSize();
    pasos.push({
      titulo: (await dialogo.getByRole('heading').textContent()).trim(),
      cabe: !!caja && caja.x >= 0 && caja.y >= 0 && caja.x + caja.width <= vista.width + 1 && caja.y + caja.height <= vista.height + 1,
    });
    // El botón principal es el último de la tarjeta (Empezar / Siguiente / Listo).
    await dialogo.getByRole('button').last().click();
  }
  return pasos;
}

for (const [lang, vista] of [['es', '1920x1080'], ['en', '1920x1080'], ['es', '375x812']]) {
  const tx = TEXTOS[lang];
  test(`[${lang} ${vista}] la portada abre la guía en la primera visita y no la repite`, { timeout: 5 * PASO }, async (t) => {
    const ctx = await nuevoContexto(navegador, { lang, vista, guia: true });
    try {
      const { page } = await abrir(ctx, '/globos.html');
      await esperarArranque(page, lang);
      const dialogo = page.getByRole('dialog');
      await dialogo.waitFor({ state: 'visible', timeout: PASO });

      await t.test('el primer paso da la bienvenida en el idioma de la app', async () =>
        assert.equal((await dialogo.getByRole('heading').textContent()).trim(), tx.bienvenida));

      const pasos = await recorrer(page);
      await t.test(`tiene ${PASOS_PORTADA} pasos y cada tarjeta cabe en la pantalla`, () => {
        assert.equal(pasos.length, PASOS_PORTADA, `pasos vistos: ${pasos.map((p) => p.titulo).join(' / ')}`);
        const fuera = pasos.filter((p) => !p.cabe).map((p) => p.titulo);
        assert.deepEqual(fuera, [], 'pasos cuya tarjeta se sale de la pantalla');
      });
      await t.test('al terminar se cierra', async () => assert.equal(await dialogo.count(), 0));

      await ir(page, page.url(), true);
      await esperarArranque(page, lang);
      await t.test('al volver no se abre sola', async () => {
        await page.waitForTimeout(1500);
        assert.equal(await dialogo.count(), 0);
      });

      await t.test(`el botón «${tx.boton}» la abre otra vez y Escape la cierra`, async () => {
        await page.getByRole('button', { name: tx.boton }).click();
        await dialogo.waitFor({ state: 'visible', timeout: CORTA });
        await page.keyboard.press('Escape');
        await dialogo.waitFor({ state: 'detached', timeout: CORTA });
      });
    } finally { await ctx.close(); }
  });
}

test('[es] saltar la guía también cuenta como vista; el planificador y el mapa no la abren solos', { timeout: 5 * PASO }, async (t) => {
  const tx = TEXTOS.es;
  const ctx = await nuevoContexto(navegador, { lang: 'es', guia: true });
  try {
    const { page } = await abrir(ctx, '/globos.html#path-planner');
    await esperarArranque(page, 'es');
    const dialogo = page.getByRole('dialog');
    await t.test('entrando directo al planificador no se abre sola', async () => {
      await page.waitForTimeout(1500);
      assert.equal(await dialogo.count(), 0);
    });

    await ir(page, `${BASE}/luna-marte.html`);
    await esperarArranque(page, 'es');
    await t.test('el mapa no la abre solo', async () => {
      await page.waitForTimeout(1500);
      assert.equal(await dialogo.count(), 0);
    });
    await t.test('en el mapa, el botón abre la guía del mapa', async () => {
      await page.getByRole('button', { name: tx.boton }).click();
      await dialogo.waitFor({ state: 'visible', timeout: CORTA });
      assert.equal((await dialogo.getByRole('heading').textContent()).trim(), tx.mapa);
      await dialogo.getByRole('button', { name: tx.saltar }).click();
      await dialogo.waitFor({ state: 'detached', timeout: CORTA });
    });

    await ir(page, `${BASE}/globos.html`);
    await esperarArranque(page, 'es');
    await t.test('después de saltarla, la portada ya no la abre sola', async () => {
      await page.waitForTimeout(1500);
      assert.equal(await dialogo.count(), 0);
    });
  } finally { await ctx.close(); }
});
