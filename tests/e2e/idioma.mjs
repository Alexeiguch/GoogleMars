// Detectores de idioma para el contrato C6 («con la app en inglés no se ve ningún texto en español, y al revés»).
// Son heurísticas deliberadamente sencillas y explicables: cada cadena ofensora sale con su motivo.
//   espanolEnIngles(texto) → motivos por los que `texto` parece español (vacío si parece inglés o neutro).
//   inglesEnEspanol(texto) → motivos por los que `texto` parece inglés en la interfaz española.

// ---------------------------------------------------------------------------------------------------------
// Español dentro de la versión inglesa

/** Palabras funcionales españolas frecuentes. Dos o más en una cadena = español (una sola puede ser un topónimo: «Puna de Atacama»). */
const FUNCIONALES_ES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'que', 'con', 'para', 'por', 'una', 'unos', 'unas', 'sin', 'según', 'sobre', 'entre', 'como', 'está', 'están', 'son', 'es', 'al', 'lo', 'se', 'su', 'sus', 'muy', 'también', 'pero', 'hay', 'desde', 'hasta', 'ni', 'o', 'cuando', 'donde', 'más', 'menos', 'este', 'esta', 'estos', 'estas', 'otro', 'otra']);
/**
 * Palabras de contenido inequívocamente españolas en esta app (nombres de sitios lunares, notas, interfaz): basta una.
 * No incluye palabras que también existen en inglés («lava», «area», «mesa», «sierra», «salar»…).
 */
const CONTENIDO_ES = new Set(['cráter', 'cráteres', 'foso', 'fosos', 'cuenca', 'oculta', 'tierras', 'altas', 'posible', 'tubo', 'sitio', 'sitios', 'gemelo', 'gemelos', 'gemela', 'análogo', 'análogos', 'borde', 'centro', 'mosaico', 'límites', 'cotejado', 'cotejada', 'verificada', 'verificado', 'verificar', 'posición', 'misma', 'mismo', 'región', 'punto', 'puntos', 'latitud', 'longitud', 'tabla', 'fuente', 'fuentes', 'nota', 'ventana', 'ventanas', 'terreno', 'pendiente', 'llano', 'llanura', 'búsqueda', 'elige', 'cerrar', 'abrir', 'mapa', 'vista', 'mejor', 'mejores', 'nuevo', 'nuevos', 'nueva', 'conocido', 'conocida', 'apeninos', 'planetográfica', 'planetográfico', 'oeste', 'sur', 'norte', 'cara', 'polo', 'relieve', 'cifras', 'datos', 'estudios', 'estudiado', 'revisado', 'revisada', 'puntuación', 'similitud', 'superficie', 'clima', 'lluvia', 'temperatura', 'aquí', 'ficha', 'escala', 'isla', 'colinas', 'meseta', 'desierto', 'cordillera', 'altiplano', 'laguna', 'valle', 'cargando', 'leído', 'duplicada', 'compartido', 'compartida', 'genérico', 'existe', 'hacia', 'alrededor', 'cumbre', 'ladera', 'muestra', 'parecido', 'parecidos', 'parecida', 'idioma', 'tema', 'oscuro', 'claro', 'leyenda', 'ver', 'buscar', 'comparar']);
/** Palabras de CONTENIDO_ES que también forman topónimos propios: solo cuentan junto a otra señal. */
const DEBILES_ES = new Set(['sur', 'norte', 'oeste', 'centro', 'cara', 'polo', 'isla', 'valle', 'laguna', 'cordillera', 'altiplano', 'desierto', 'meseta', 'colinas', 'ver', 'tema', 'claro', 'muestra', 'nota', 'tabla', 'mapa']);
/**
 * Nombres propios que en inglés también se escriben con tilde u otro diacrítico: se aceptan.
 * Cada uno es un topónimo o un apellido que se escribe así en la literatura en inglés.
 */
export const TILDES_ACEPTADAS = new Set([
  'kármán', // cráter Von Kármán (IAU)
  'rümker', // Mons Rümker (IAU)
  'gêrzê', // condado de Gêrzê (Tíbet)
  'tarapacá', // región de Tarapacá (Chile)
  'potosí', // departamento de Potosí (Bolivia)
  'gläser', // Gläser et al., autor citado
  'daïra', 'mersoï', // toponimia francesa de Argelia y Níger
]);
const LETRAS_ES = /[ñÑ]/;
const TILDE_ES = /[áéíóúÁÉÍÓÚ]/;

const palabras = (s) => s.toLowerCase().normalize('NFC').match(/[\p{L}][\p{L}'’-]*/gu) || [];
/** Quita lo que no es lenguaje: URLs, correos, «et al.», nombres de productos de datos y de archivos. */
const limpiar = (s) => String(s)
  .replace(/https?:\/\/\S+/g, ' ')
  .replace(/\S+@\S+\.\S+/g, ' ')
  .replace(/\bet al\.?/g, ' ')
  .replace(/\bde Gerlache\b/g, 'Gerlache') // apellido (cráter de Gerlache, IAU)
  .replace(/\b[A-Z0-9]+(?:_[A-Z0-9]+)+\b/g, ' ') // LDEM_80S_40MPP_ADJ, NAC_ROI_…
  .replace(/\b\S+\.(?:png|jpg|tif|tiff|img|zip|json|csv)\b/gi, ' ');

/** Ids internos en minúsculas con guiones bajos (p. ej. «centro_mosaico_lroc_compartido_lon_no_verificada»). */
const ID_INTERNO = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}\b/;

/** El nombre de un idioma en su propia lengua (selector de idioma): «Español» en la versión inglesa es correcto. */
const NOMBRE_IDIOMA = /^(español|english|es|en)$/i;
/**
 * Topónimos: palabras con mayúscula unidas por artículos o preposiciones («Puna de Atacama», «Valle del Cura»,
 * «Antofagasta de la Sierra», «El Loa»). Sus palabras funcionales no cuentan como español.
 */
const TOPONIMO = /\p{Lu}[\p{L}'’-]*(?:\s+(?:de|del|de la|de los|de las|la|el|los|las|y)\s+\p{Lu}[\p{L}'’-]*)+|\b(?:El|La|Los|Las)\s+(?=\p{Lu})/gu;
/** Palabra con mayúscula inicial (nombre propio): su tilde o su eñe no delatan español («Río Tinto», «Chañaral», «Ténéré»). */
const propio = (p, s) => {
  const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const m of s.matchAll(new RegExp(`(?<![\\p{L}])${esc}(?![\\p{L}])`, 'giu'))) if (/\p{Lu}/u.test(m[0].charAt(0))) return true;
  return false;
};

export function espanolEnIngles(texto) {
  const motivos = [];
  const bruto = String(texto ?? '');
  if (NOMBRE_IDIOMA.test(bruto.trim())) return motivos;
  const id = bruto.match(ID_INTERNO);
  if (id) motivos.push(`id interno «${id[0]}»`);
  const s = limpiar(bruto);
  const ps = palabras(s);
  const contenido = [...new Set(ps.filter((p) => CONTENIDO_ES.has(p)))];
  const fuertes = contenido.filter((p) => !DEBILES_ES.has(p));
  const funcionales = palabras(s.replace(TOPONIMO, (t) => t.replace(/\s+(?:de|del|la|el|los|las|y)(?=\s)/g, ' ').replace(/^(?:El|La|Los|Las)\s+$/, ' '))).filter((p) => FUNCIONALES_ES.has(p));
  // Una tilde o una eñe en un nombre propio solo cuenta si la cadena ya tiene otra señal de español.
  const otraSenal = fuertes.length > 0 || funcionales.length >= 2;
  const raras = [...new Set(ps.filter((p) => LETRAS_ES.test(p) && !TILDES_ACEPTADAS.has(p) && (otraSenal || !propio(p, s))))];
  if (/[¿¡]/.test(s)) motivos.push(`signo «${s.match(/[¿¡]/)[0]}»`);
  if (raras.length) motivos.push(`eñe en «${raras.slice(0, 3).join('», «')}»`);
  const conTilde = [...new Set(ps.filter((p) => TILDE_ES.test(p) && !TILDES_ACEPTADAS.has(p) && (otraSenal || !propio(p, s))))];
  if (conTilde.length) motivos.push(`tilde en «${conTilde.slice(0, 3).join('», «')}»`);
  if (fuertes.length) motivos.push(`palabra española «${fuertes.slice(0, 3).join('», «')}»`);
  if (funcionales.length >= 2 && (new Set(funcionales).size >= 2 || funcionales.length >= 3)) {
    motivos.push(`palabras funcionales españolas «${[...new Set(funcionales)].slice(0, 4).join('», «')}»`);
  } else if (funcionales.length >= 1 && contenido.length >= 1 && !fuertes.length) {
    motivos.push(`«${funcionales[0]}» + «${contenido[0]}»`);
  }
  return motivos;
}

// ---------------------------------------------------------------------------------------------------------
// Inglés dentro de la versión española

const FUNCIONALES_EN = new Set(['the', 'and', 'of', 'with', 'from', 'for', 'to', 'is', 'are', 'this', 'that', 'these', 'those', 'in', 'on', 'at', 'by', 'or', 'not', 'only', 'it', 'its', 'which', 'where', 'when', 'than', 'into', 'near', 'inside', 'below', 'above', 'between', 'has', 'have', 'was', 'were', 'be', 'been', 'an']);
/** Palabras de interfaz o de nombres de sitio inequívocamente inglesas: basta una. */
const INTERFAZ_EN = new Set(['show', 'select', 'choose', 'twin', 'twins', 'analog', 'analogs', 'score', 'best', 'known', 'reviewed', 'terrain', 'relief', 'slope', 'view', 'reset', 'legend', 'compare', 'find', 'loading', 'close', 'open', 'search', 'sources', 'source', 'switch', 'theme', 'dark', 'light', 'globes', 'globe', 'map', 'imagery', 'window', 'windows', 'study', 'studies', 'found', 'similar', 'climate', 'surface', 'scale', 'new', 'all', 'candidate', 'scan', 'crater', 'craters', 'plains', 'gullies', 'fresh', 'impact', 'layered', 'deposits', 'dunes', 'valley', 'fans', 'ridge', 'unnamed', 'landing', 'site', 'sites', 'hills', 'island', 'peak', 'rim', 'plain', 'massif', 'plateau', 'basin', 'highlands']);
/**
 * Nombres oficiales en inglés que se dejan tal cual en español: regiones candidatas de Artemis III (NASA) y lugares
 * conocidos internacionalmente por ese nombre. Se quitan del texto antes de analizarlo.
 */
export const NOMBRES_INGLESES_ACEPTADOS = [
  'Peak near Cabeus B', 'Peak near Shackleton', 'Connecting Ridge Extension', 'Connecting Ridge', 'Mons Mouton Plateau',
  'Mouton Plateau', 'Malapert Massif', 'Gerlache-Kocher Massif', 'Gerlache Rim', 'Nobile Rim', 'Faustini Rim A', 'Slater Plain', 'Amundsen Rim',
  'Leibnitz Beta Plateau', 'Marius Hills', 'Meteor Crater', 'Bradbury Landing', 'Octavia E. Butler Landing',
];
const quitarAceptados = (s) => NOMBRES_INGLESES_ACEPTADOS.reduce((acc, n) => acc.split(n).join(' '), s);

export function inglesEnEspanol(texto) {
  const motivos = [];
  // Los títulos citados entre comillas (artículos, páginas HiRISE) van en su idioma original y no cuentan.
  const s = quitarAceptados(limpiar(String(texto ?? ''))).replace(/'[^']{3,}'|"[^"]{3,}"|“[^”]{3,}”|«[^»]{3,}»/g, ' ');
  const ps = palabras(s);
  // Una cadena con señales claras de español no se toma por inglesa (p. ej. «LOLA DEM de 40 m»).
  const funcES = ps.filter((p) => FUNCIONALES_ES.has(p)).length;
  const interfaz = [...new Set(ps.filter((p) => INTERFAZ_EN.has(p)))];
  const funcionales = ps.filter((p) => FUNCIONALES_EN.has(p));
  if (interfaz.length && funcES === 0 && !TILDE_ES.test(s)) motivos.push(`palabra inglesa «${interfaz.slice(0, 3).join('», «')}»`);
  if (funcionales.length >= 2 && funcionales.length > funcES) motivos.push(`palabras funcionales inglesas «${[...new Set(funcionales)].slice(0, 4).join('», «')}»`);
  return motivos;
}
