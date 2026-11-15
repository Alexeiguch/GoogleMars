// Recorrido de una página para la prueba de pureza de idioma (C6): abre pestañas, plegables y selectores,
// pulsa filas de listas, conmutadores y botones, y recoge todo el texto que el usuario puede llegar a ver.
// No usa ids ni clases de la app: solo etiquetas HTML y roles (ver window.__e2e en apoyo.mjs).
import { BASE, quieto } from './apoyo.mjs';

/** Opciones de selector que se abren siempre (además de una muestra repartida): los sitios que pide el encargo. */
const OPCIONES_CLAVE = /apollo|chang|pit|foso|shackleton|im-2|athena|malla|grid|jezero|gale|gusev|arcadia|nili|polar/i;
const MAX_CLAVE = 26;
const MUESTRA = 16;
const TODAS_HASTA = 60;

/**
 * @param page página ya cargada y arrancada
 * @param nombre nombre de la página para el informe
 * @param tope milisegundos máximos de recorrido (se corta con lo recogido hasta entonces y se anota)
 * @returns {{cadenas: Array<{pagina:string, estado:string, tipo:string, texto:string}>, pasos:number, cortado:boolean}}
 */
export async function recorrer(page, nombre, { tope = 240_000 } = {}) {
  const inicio = Date.now();
  const cadenas = [];
  let pasos = 0;
  let cortado = false;
  const ruta = new URL(page.url()).pathname;
  // Cada pestaña tiene su parte del tiempo, para que la última (Marte) no se quede sin recorrer.
  let limite = inicio + tope;
  const hayTiempo = () => { if (Date.now() > limite) { cortado = true; return false; } return true; };
  // Sin mayúsculas forzadas por CSS: así el texto recogido conserva las mayúsculas reales (solo afecta al aspecto).
  const neutro = () => page.addStyleTag({ content: '*{text-transform:none !important}' }).catch(() => {});
  await neutro();
  const anotar = async (estado) => {
    pasos++;
    const nuevas = await page.evaluate(() => window.__e2e.recoger()).catch(() => []);
    for (const [tipo, texto] of nuevas) cadenas.push({ pagina: nombre, estado, tipo, texto });
  };
  const paso = async (estado, accion) => {
    if (!hayTiempo()) return;
    const hecho = await accion().catch(() => false);
    if (hecho === false) return;
    await quieto(page, 60, 1200);
    // Si un botón sacó de la página, se vuelve y se sigue.
    if (new URL(page.url()).pathname !== ruta) { await page.goto(BASE + ruta, { waitUntil: 'load' }); await neutro(); await quieto(page, 300, 5000); return; }
    await page.evaluate(() => window.__e2e.abrirPlegables()).catch(() => {});
    await anotar(estado);
  };

  const explorar = async (donde) => {
    await paso(`${donde} · plegables abiertos`, async () => true);
    // 1. Selectores: todas las opciones ya se recogen como texto; además se eligen para ver sus fichas.
    const selectores = await page.evaluate(() => window.__e2e.selectores());
    for (const s of selectores) {
      const idx = s.opciones.map((o, i) => i).filter((i) => !s.opciones[i].inactiva);
      let elegidas;
      if (idx.length <= TODAS_HASTA) elegidas = idx;
      else {
        const clave = idx.filter((i) => OPCIONES_CLAVE.test(s.opciones[i].texto)).slice(0, MAX_CLAVE);
        const salto = Math.max(1, Math.floor(idx.length / MUESTRA));
        elegidas = [...new Set([...clave, ...idx.filter((_, n) => n % salto === 0)])];
      }
      for (const i of elegidas) await paso(`${donde} · selector ${s.k + 1} «${s.opciones[i].texto.slice(0, 50)}»`, () => page.evaluate(([k, n]) => window.__e2e.elegir(k, n), [s.k, i]));
    }
    // 2. Conmutadores (modos de ranking, de comparación, escalas…): cada uno, y con él las tres primeras filas.
    const plan0 = await page.evaluate(() => window.__e2e.planBotones());
    for (let n = 0; n < plan0.conmutadores.length; n++) {
      const plan = await page.evaluate(() => window.__e2e.planBotones());
      const c = plan.conmutadores[n];
      if (!c) break;
      await paso(`${donde} · conmutador «${c[1]}»`, () => page.evaluate((i) => window.__e2e.pulsarBoton(i), c[0]));
      for (let f = 0; f < 3; f++) {
        const p2 = await page.evaluate(() => window.__e2e.planBotones());
        const fila = p2.primerasFilas[f];
        if (!fila) break;
        await paso(`${donde} · «${c[1]}» · fila «${fila[1]}»`, () => page.evaluate((i) => window.__e2e.pulsarBoton(i), fila[0]));
      }
    }
    // 3. Filas: todas las de las listas (ranking, análogos) y la primera de cada grupo plegable (gemelos por sitio).
    const nFilas = (await page.evaluate(() => window.__e2e.planBotones())).filas.length;
    for (let n = 0; n < nFilas; n++) {
      const fila = (await page.evaluate(() => window.__e2e.planBotones())).filas[n];
      if (!fila) break;
      await paso(`${donde} · fila «${fila[1]}»`, () => page.evaluate((i) => window.__e2e.pulsarBoton(i), fila[0]));
    }
    // 4. El resto de botones (historias, «ver la ficha de la referencia», leyenda, vistas…).
    const nOtros = Math.min(30,(await page.evaluate(() => window.__e2e.planBotones())).otros.length);
    for (let n = 0; n < nOtros; n++) {
      const b = (await page.evaluate(() => window.__e2e.planBotones())).otros[n];
      if (!b) break;
      await paso(`${donde} · botón «${b[1]}»`, () => page.evaluate((i) => window.__e2e.pulsarBoton(i), b[0]));
    }
  };

  await anotar('carga');
  const pestanas = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].filter((t) => window.__e2e.visible(t)).map((t) => window.__e2e.norm(t.textContent)));
  if (!pestanas.length) await explorar('página');
  for (let i = 0; i < pestanas.length; i++) {
    limite = inicio + (tope * (i + 1)) / pestanas.length;
    await paso(`pestaña «${pestanas[i]}»`, () => page.evaluate((n) => { const t = [...document.querySelectorAll('[role="tab"]')].filter((x) => window.__e2e.visible(x))[n]; if (!t) return false; t.click(); return true; }, i));
    await explorar(`pestaña «${pestanas[i]}»`);
  }
  await quieto(page, 500, 6000);
  await anotar('final');
  return { cadenas, pasos, cortado };
}
