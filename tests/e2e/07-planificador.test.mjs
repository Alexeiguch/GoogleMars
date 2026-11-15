import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, abrirNavegador, nuevoContexto, PASO } from './apoyo.mjs';

let browser;
before(async () => { browser = await abrirNavegador(); });
after(async () => { await browser?.close(); });

test('Jezero: abre el planificador desde la portada, busca sin red y restaura la ruta elegida', { timeout: 5 * PASO }, async () => {
  const context = await nuevoContexto(browser, { sinRed: true, vista: '375x812' });
  try {
    const grids = [];
    context.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.includes('/terrain/')) grids.push(path);
    });
    const { page, vig } = await abrir(context, '/#path-planner');
    const results = page.getByRole('region', { name: 'Route comparison', exact: true });
    const compareTerrain = page.getByRole('heading', { name: 'Compare terrain', exact: true });
    const example = page.getByRole('button', { name: 'Try a route in Jezero', exact: true });
    await example.waitFor();
    assert.equal(new URL(page.url()).hash, '#path-planner');
    assert.equal(await compareTerrain.isVisible(), false);
    assert.deepEqual(grids, [], 'La entrada al planificador no debe cargar terreno hasta que se busque una ruta');

    await example.click();
    await results.getByRole('heading', { name: 'Terrain profiles' }).waitFor();
    assert.match(await results.innerText(), /Searched 256 Earth terrain sites/);
    const candidates = results.getByRole('list').getByRole('button');
    assert.equal(await candidates.count(), 8);
    await candidates.nth(1).click();
    const chosen = await candidates.nth(1).getAttribute('data-path-candidate');
    assert.equal(await candidates.nth(1).getAttribute('aria-pressed'), 'true');
    await results.getByRole('button', { name: /^Select for rehearsal/ }).click();
    await results.getByRole('button', { name: /^Selected for rehearsal/ }).waitFor();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await results.getByRole('button', { name: /^Selected for rehearsal/ }).waitFor();
    assert.equal(await candidates.nth(1).getAttribute('data-path-candidate'), chosen);
    assert.equal(await candidates.nth(1).getAttribute('aria-pressed'), 'true');
    const progress = results.getByRole('slider', { name: 'Route progress' });
    await progress.press('End');
    assert.equal(await progress.inputValue(), '100');
    assert.match(await progress.getAttribute('aria-valuetext'), /Mars.*Earth/);

    await page.getByRole('link', { name: /^3D globes$/i }).click();
    assert.equal(await results.isVisible(), false);
    await compareTerrain.waitFor();
    assert.equal(await example.isVisible(), false);
    assert.deepEqual(vig.excepciones, []);
    assert.deepEqual(vig.localesFallidas, []);
  } finally { await context.close(); }
});
