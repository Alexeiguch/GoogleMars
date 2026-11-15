// (g) Las cifras de la ficha del gemelo 1 de Shackleton coinciden con src/data/results.json.
// Nada escrito a mano: el grupo se localiza en el JSON por su nombre (el del contrato C2), el gemelo es el primero de
// su lista y cada número esperado se calcula del JSON con el redondeo de la app (puntuaciones: Math.round(v·100);
// coordenadas, altitud y rasgos: toLocaleString con los decimales de la app, formateado en el propio navegador con el
// locale de la app: "en-US" en inglés y "es" en español).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, nuevoContexto, abrir, guionMapa, leerJson, GUION, IDIOMAS, PASO } from './apoyo.mjs';

const DATOS = leerJson('src/data/results.json');
const LOCALE = { en: 'en-US', es: 'es' };
const pct = (v) => String(Math.round(v * 100));

/** Grupo de gemelos lunares cuyo nombre (en el JSON, en español) es el del guion. */
function grupoShackleton() {
  const luna = DATOS.bodies.moon;
  const clave = Object.keys(luna.twins ?? {}).find((k) => DATOS.groups?.[k]?.name === GUION.es.grupo)
    ?? Object.keys(luna.twins ?? {}).find((k) => /shackleton/i.test(DATOS.groups?.[k]?.name ?? '') && /IAU/.test(DATOS.groups?.[k]?.name ?? ''));
  assert.ok(clave, `results.json no tiene un grupo de gemelos lunares llamado «${GUION.es.grupo}»`);
  const lista = [...(luna.twins[clave] ?? []), ...(luna.fine?.twins?.[clave] ?? [])];
  return { clave, gemelo: luna.twins[clave][0], mejor: Math.max(...lista.map((s) => s.score ?? -1)) };
}

/** Lo mismo que featText() de la app: decimales por rasgo, exponencial para curvaturas y valores diminutos. */
function rasgoEsperado(k, v) {
  if (k === 'curv_p90' || (Math.abs(v) > 0 && Math.abs(v) < 0.01)) return { exp: v.toExponential(1) };
  const d = k.startsWith('frac') || k === 'pit_frac' || k === 'hypso' ? 2 : k === 'relief' || k === 'rough_1km' ? 0 : 1;
  return { v, d };
}

let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

for (const lang of IDIOMAS) {
  test(`[${lang}] las cifras de la ficha del gemelo 1 de Shackleton salen de results.json`, { timeout: 5 * PASO }, async (t) => {
    const { gemelo: s, mejor } = grupoShackleton();
    const ctx = await nuevoContexto(navegador, { lang });
    try {
      const { page } = await abrir(ctx, '/luna-marte.html');
      const r = await guionMapa(page, lang);
      assert.ok(r.grupo && r.gemelo && r.ficha && !r.ficha.sinFicha, 'No se pudo recorrer el guion del mapa hasta la ficha (ver la prueba 01)');

      // Formateo con el mismo motor y el mismo locale que la app.
      const fmt = (v, d) => page.evaluate(([x, n, loc]) => x.toLocaleString(loc, { minimumFractionDigits: n, maximumFractionDigits: n }), [v, d, LOCALE[lang]]);
      const oeste = lang === 'es' ? 'O' : 'W';
      const coord = async (d) => `${await fmt(Math.abs(s.lat), d)}° ${s.lat < 0 ? 'S' : 'N'} · ${await fmt(Math.abs(s.lon), d)}° ${s.lon < 0 ? oeste : 'E'}`;

      await t.test('el texto del gemelo del guion (C2) son las coordenadas del JSON redondeadas a 2 decimales', async () => {
        const esperado = await coord(2);
        assert.equal(GUION[lang].gemelo.split(' · ').slice(1).join(' · '), esperado);
      });
      const textoGemelo = await r.gemelo.evaluate((el) => window.__e2e.norm(el.innerText));
      const textoGrupo = await r.grupo.evaluate((el) => window.__e2e.norm(el.innerText));
      await t.test(`la fila del gemelo muestra su puntuación (${pct(s.score)})`, () =>
        assert.ok(textoGemelo.split(/\s+/).includes(pct(s.score)), `Fila del gemelo: «${textoGemelo}»`));
      await t.test(`el grupo muestra la mejor puntuación de sus gemelos (${pct(mejor)})`, () =>
        assert.ok(textoGrupo.split(/\s+/).includes(pct(mejor)), `Grupo: «${textoGrupo}»`));

      const texto = r.ficha.lineas.join(' ');
      await t.test('la ficha muestra las coordenadas del JSON (3 decimales)', async () => {
        const c = await coord(3);
        assert.ok(texto.includes(c), `Se esperaba «${c}» en la ficha «${r.ficha.titulo}». Primeras líneas: ${r.ficha.lineas.slice(0, 3).join(' | ')}`);
      });
      if (s.elev_mean != null) {
        await t.test('la ficha muestra la altitud media del JSON', async () => {
          const a = await fmt(s.elev_mean, 0);
          assert.ok(new RegExp(`(^|[^\\d.,])${a.replace(/[.,]/g, '[.,\\s\\u00a0\\u202f]?')}\\s*m\\b`).test(texto), `Se esperaba la altitud «${a} m» en la ficha. Texto: ${texto.slice(0, 300)}`);
        });
      }
      await t.test('las barras muestran total, terreno, superficie y clima del JSON, en ese orden', () => {
        const esperadas = [s.score, s.scores?.terrain, s.scores?.surface, s.scores?.climate].filter((v) => v != null).map((v) => +pct(v));
        let i = 0;
        for (const n of r.ficha.enteros) if (n === esperadas[i]) i++;
        assert.equal(i, esperadas.length, `Puntuaciones esperadas ${esperadas.join(', ')}; enteros visibles en la ficha: ${r.ficha.enteros.join(', ')}`);
      });
      await t.test('la columna «aquí» de la tabla de rasgos coincide con los rasgos del JSON', async () => {
        const etiquetas = DATOS.levels?.[s.level ?? 'L0']?.moon?.feature_labels ?? DATOS.feature_labels;
        const aqui = { ...(s.features ?? {}), ...(s.shape ?? {}) };
        const esperados = [];
        for (const k of Object.keys(etiquetas)) {
          if (aqui[k] == null || !Number.isFinite(aqui[k])) continue;
          const e = rasgoEsperado(k, aqui[k]);
          esperados.push([k, e.exp ? (lang === 'es' ? e.exp.replace('.', ',') : e.exp) : await fmt(e.v, e.d)]);
        }
        const filas = r.ficha.filas.filter((f) => f.length >= 3);
        assert.ok(filas.length > 0, 'La ficha no tiene tabla de rasgos');
        const columna = filas.map((f) => f[1]);
        const faltan = esperados.filter(([, v]) => !columna.includes(v));
        assert.deepEqual(faltan, [], `Valores de la columna del gemelo en pantalla: ${columna.join(' | ')}`);
      });
    } finally { await ctx.close(); }
  });
}
