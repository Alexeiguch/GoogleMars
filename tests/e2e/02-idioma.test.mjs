// (c) Pureza de idioma (contrato C6). Con la app en inglés se recorren las dos páginas (pestañas, plegables,
// selectores con el texto de todas sus opciones, sitios lunares —Apollo, Chang'e, fosos—, sitios de Marte, filas del
// ranking y fichas), se recoge todo el texto visible o legible (incluidos aria-label, title, alt y placeholder) y la
// prueba falla si alguna cadena parece española. La prueba inversa hace lo mismo en español buscando inglés en los
// textos de interfaz (las referencias bibliográficas del pie se citan en su idioma y no cuentan).
// Cada cadena ofensora se informa con su página y el estado en que apareció; el informe completo queda en
// tests/e2e/informes/idioma-<lang>-<página>.txt.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador, nuevoContexto, abrir, esperarArranque, guardarInforme, PAGINAS, PASO } from './apoyo.mjs';
import { recorrer } from './recorrido.mjs';
import { espanolEnIngles, inglesEnEspanol } from './idioma.mjs';

/** Tiempo máximo del recorrido de una página (si se agota, se analiza lo recogido y se anota). */
const TOPE = Number(process.env.E2E_TOPE_IDIOMA_MS || 300_000);
const MAX_LISTA = 60;

let navegador;
before(async () => { navegador = await abrirNavegador(); });
after(async () => { await navegador?.close(); });

const casos = [
  { lang: 'en', detector: espanolEnIngles, otro: 'español', ignorar: () => false },
  { lang: 'es', detector: inglesEnEspanol, otro: 'inglés', ignorar: (c) => c.tipo === 'fuente citada' },
];

for (const { lang, detector, otro, ignorar } of casos) {
  for (const [nombre, ruta] of Object.entries(PAGINAS)) {
    test(`[${lang}] ${ruta}: ningún texto en ${otro}`, { timeout: TOPE + 4 * PASO }, async (t) => {
      const ctx = await nuevoContexto(navegador, { lang });
      try {
        const { page, vig } = await abrir(ctx, ruta);
        await esperarArranque(page, lang);
        const r = await recorrer(page, nombre, { tope: TOPE });
        const ofensoras = new Map();
        for (const c of r.cadenas) {
          if (ignorar(c)) continue;
          const motivos = detector(c.texto);
          if (!motivos.length || ofensoras.has(c.texto)) continue;
          ofensoras.set(c.texto, { ...c, motivos });
        }
        const lista = [...ofensoras.values()];
        const informe = guardarInforme(`idioma-${lang}-${nombre}.txt`, [
          `${ruta} con la app en ${lang === 'en' ? 'inglés' : 'español'}: ${r.cadenas.length} cadenas recogidas en ${r.pasos} estados${r.cortado ? ' (recorrido cortado por tiempo)' : ''}; ${lista.length} parecen en ${otro}.`,
          '',
          ...lista.map((o) => `[${o.pagina} · ${o.estado} · ${o.tipo}] «${o.texto}» → ${o.motivos.join('; ')}`),
          '', '--- Todas las cadenas recogidas ---',
          ...r.cadenas.map((c) => `[${c.estado} · ${c.tipo}] ${c.texto}`),
        ].join('\n'));
        t.diagnostic(`${r.cadenas.length} cadenas en ${r.pasos} estados${r.cortado ? ' (cortado por tiempo)' : ''}; informe: ${informe}`);
        assert.ok(r.cadenas.length > 50, `El recorrido casi no recogió texto (${r.cadenas.length} cadenas): la página no cargó`);
        assert.deepEqual(vig.excepciones, [], 'Excepciones no capturadas durante el recorrido');
        if (lista.length) {
          const muestra = lista.slice(0, MAX_LISTA).map((o) => `  - [${nombre} · ${o.estado} · ${o.tipo}] «${o.texto.slice(0, 160)}» → ${o.motivos.join('; ')}`);
          assert.fail(`C6: ${lista.length} cadenas en ${otro} con la app en ${lang === 'en' ? 'inglés' : 'español'} en ${ruta}${lista.length > MAX_LISTA ? ` (se muestran ${MAX_LISTA}; todas en ${informe})` : ''}:\n${muestra.join('\n')}`);
        }
      } finally { await ctx.close(); }
    });
  }
}
