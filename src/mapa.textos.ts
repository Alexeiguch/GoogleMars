// Textos de interfaz propios del mapa (luna-marte.html) que no están en i18n.ts. Siempre en español e inglés.
// Mismo patrón que UI_TEXT + bindUiText de globos.ts: los elementos con data-mt="clave" se pintan aquí
// y se repintan al cambiar de idioma. Los textos que deben verse antes de que cargue el script
// (frase de entrada y aviso de carga) viven en luna-marte.html (window.LM_EARLY) y se repintan con lmEarly().
import { getLang, onLangChange, type Lang } from "./i18n";

type Params = Record<string, string | number>;

const TEXTOS: Record<Lang, Record<string, string>> = {
  es: {
    "pick.moon": "Elige un sitio de la Luna y verás sus lugares más parecidos en la Tierra.",
    "pick.mars": "Elige un sitio de Marte y verás sus lugares más parecidos en la Tierra.",
    showAll: "Ver los {n} sitios",
    showFewer: "Ver menos sitios",
    fichaHead: "Su gemelo en la Tierra",
    story: "Historia destacada",
    storyFold: "Por qué destaca este lugar",
    near: "Cerca de {name}",
    place: "Lugar: {name}",
    alike: "Se parece en {list}",
    notAlike: "No se parece en {list}",
    "axis.terrain": "terreno",
    "axis.surface": "superficie",
    "axis.climate": "clima",
    "axisHead.terrain": "Terreno",
    "axisHead.surface": "Superficie",
    "axisHead.climate": "Clima",
    whyHead: "Los datos de cada veredicto",
    verdictOk: "Se parece",
    verdictNo: "No se parece",
    slope: "Pendiente típica en {km} km: {a}° aquí · {b}° en {body}.",
    relief: "Relieve local en {km} km: {a} m aquí · {b} m en {body}.",
    "on.moon": "la Luna",
    "on.mars": "Marte",
    open3d: "Abrir en los globos 3D",
    open3dNote: "La Luna, la Tierra y Marte al mismo tamaño, y el terreno en 3D.",
    noImage: "No hay imagen de relieve para este sitio.",
    imgLoading: "Cargando relieve…",
    sourceNote: "Nota de la fuente",
    offline: "Las imágenes de satélite no cargan (sin conexión o muy lentas). Se muestra el mapa local de baja resolución; los gemelos y los relieves siguen funcionando.",
    miniOffline: "Las imágenes reales necesitan conexión y no cargan. Usa la vista de relieve, que es local.",
    localAttribution: "Mapa local: imagen global de la Tierra incluida en la app",
    fineFair: "{k1} km (justo)",
    noReal: "No hay imagen real de esta referencia.",
    newNote: "Solo candidatos lejos de los análogos conocidos y para los que no encontramos estudios que los usen como análogo. «Sin revisar» = bibliografía pendiente.",
    validationNote: "Percentil global del mejor punto a menos de 50 km de cada análogo ya conocido: cuanto más alto, mejor detecta el método los lugares que la ciencia ya usa. Antes: método v1 (ventanas de {k0} km). Después: referencias v2 a {k0} km. {k1} km (justo): la mejor ventana de {k1} km a menos de 50 km del análogo, ordenada frente a la mejor ventana a menos de 50 km de cada punto de control elegido al azar (se compara lo mejor de una zona con lo mejor de otra). Compararla con ventanas sueltas inflaba la cifra; por eso se muestra esta. «—»: no hay ventana de {k1} km cerca.",
  },
  en: {
    "pick.moon": "Pick a Moon site to see its closest places on Earth.",
    "pick.mars": "Pick a Mars site to see its closest places on Earth.",
    showAll: "Show all {n} sites",
    showFewer: "Show fewer sites",
    fichaHead: "Its twin on Earth",
    story: "Featured story",
    storyFold: "Why this place stands out",
    near: "Near {name}",
    place: "Place: {name}",
    alike: "Alike in {list}",
    notAlike: "Not alike in {list}",
    "axis.terrain": "terrain",
    "axis.surface": "surface",
    "axis.climate": "climate",
    "axisHead.terrain": "Terrain",
    "axisHead.surface": "Surface",
    "axisHead.climate": "Climate",
    whyHead: "The data behind each verdict",
    verdictOk: "Alike",
    verdictNo: "Not alike",
    slope: "Typical slope over {km} km: {a}° here · {b}° on {body}.",
    relief: "Local relief over {km} km: {a} m here · {b} m on {body}.",
    "on.moon": "the Moon",
    "on.mars": "Mars",
    open3d: "Open in the 3D globes",
    open3dNote: "The Moon, Earth and Mars at the same size, and the terrain in 3D.",
    noImage: "Relief image not available for this site.",
    imgLoading: "Loading relief…",
    sourceNote: "Source note",
    offline: "The satellite imagery is not loading (offline or too slow). Showing the built-in low-resolution map; the twins and the relief images still work.",
    miniOffline: "Real imagery needs a connection and is not loading. Use the relief view, which is local.",
    localAttribution: "Local map: global Earth image bundled with the app",
    fineFair: "{k1} km (fair)",
    noReal: "No real imagery for this reference.",
    newNote: "Only candidates far from known analogs and for which we found no studies that use them as analogs. “Not reviewed” = literature check pending.",
    validationNote: "Global percentile of the best point within 50 km of each known analog: the higher it is, the better the method detects the places science already uses. Before: v1 method ({k0} km windows). After: v2 references at {k0} km. {k1} km (fair): the best {k1} km window within 50 km of the analog, ranked against the best window within 50 km of each randomly chosen control point (the best of one area against the best of another). Ranking it against single windows inflated the figure, so this is the one shown. “—”: there is no {k1} km window nearby.",
  },
};

/** Texto propio del mapa en el idioma actual; {nombre} se sustituye por params[nombre]. */
export function m(key: string, params?: Params): string {
  const text = TEXTOS[getLang()][key] ?? TEXTOS.es[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? "")) : text;
}

/** Pinta los textos fijos del HTML (data-mt y los "tempranos" de LM_EARLY) y los repinta al cambiar de idioma. */
export function bindMapaTextos() {
  const apply = () => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-mt]")) el.textContent = m(el.dataset.mt!);
    (window as unknown as { lmEarly?: () => void }).lmEarly?.();
  };
  apply();
  onLangChange(apply);
}

/**
 * Notas largas que vienen de los datos en español (fuente, calidad…): si la app está en inglés y la nota
 * no tiene traducción, no se muestra (antes que enseñar español dentro de la interfaz inglesa).
 * `translated` es el resultado de tr(original).
 */
export function noteOrNull(original: string | null | undefined, translated: string | null | undefined): string | null {
  if (!original || !translated) return null;
  if (getLang() === "es" || translated !== original) return translated;
  const spanish = /[áéíóúñ¿¡]|\b(el|la|los|las|del|que|con|para|por|una|según|sin|cerca|misma|mismo|centro|tesela|teselas|región|dentro)\b/i;
  return spanish.test(original) ? null : translated;
}
