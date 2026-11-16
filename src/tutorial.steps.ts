// Pasos de la guía de uso de cada página (ver src/tutorial.ts). Mismo registro que la interfaz: «elige», «toca».
import type { TutorialStep } from "./tutorial";

const again: TutorialStep = {
  target: "#tut-open",
  title: { es: "Vuelve cuando quieras", en: "Come back any time" },
  body: {
    es: "Este botón abre la guía otra vez. Al lado puedes cambiar el idioma y pasar a tema claro u oscuro.",
    en: "This button opens the guide again. Next to it you can switch the language and choose a light or dark theme.",
  },
};

/** Portada: los globos 3D. */
export const globesSteps: TutorialStep[] = [
  {
    title: { es: "Bienvenido a TerraTwin", en: "Welcome to TerraTwin" },
    body: {
      es: "TerraTwin busca en toda la tierra firme los lugares que más se parecen a sitios de la Luna y de Marte, y explica en qué se parecen y en qué no. En un minuto te mostramos cómo usarlo.",
      en: "TerraTwin searches all of Earth's land for the places most like sites on the Moon and Mars, and explains where they match and where they don't. Here is how to use it in a minute.",
    },
  },
  {
    target: "#gl-stage",
    title: { es: "Tres globos, una escala", en: "Three globes, one scale" },
    body: {
      es: "Arrastra un globo para girarlo y usa la rueda o pellizca para acercar. Toca un punto para abrir su ficha: los globos vuelan a la vez al sitio y a su gemelo, a la misma escala.",
      en: "Drag a globe to turn it; use the wheel or pinch to zoom. Tap a point to open its card: the globes fly to the site and its twin together, at the same scale.",
    },
  },
  {
    target: ".gl-mode",
    title: { es: "Qué puntos ver", en: "Which points to show" },
    body: {
      es: "«Mejores» deja solo los candidatos más fuertes; «Todos» muestra cada sitio, análogo y parche HiRISE. La leyenda explica cada forma y color.",
      en: "“Best” keeps only the strongest candidates; “All” shows every site, analog and HiRISE patch. The legend explains each shape and color.",
    },
  },
  {
    target: ".gl-pickers",
    title: { es: "Busca un sitio", en: "Find a site" },
    body: {
      es: "Elige un sitio de la Luna o de Marte para ver solo sus gemelos, o ve directo a cualquier punto, incluidos los análogos que estudió la NASA.",
      en: "Pick a Moon or Mars site to see only its twins, or jump straight to any point, including the analogs NASA has studied.",
    },
  },
  {
    target: ".gl-jump",
    title: { es: "Compara el terreno en 3D", en: "Compare the terrain in 3D" },
    body: {
      es: "Más abajo eliges un sitio y uno de sus análogos de la Tierra, y ves los dos terrenos lado a lado, con la misma escala y la cámara compartida.",
      en: "Further down you pick a site and one of its Earth analogs, and see both terrains side by side, at the same scale with a shared camera.",
    },
  },
  {
    target: ".masthead .views",
    title: { es: "Otras vistas", en: "Other views" },
    body: {
      es: "El Mapa Luna y Marte tiene el ranking, la ficha de cada gemelo y la comparación de relieve. El Planificador de rutas compara una ruta en Marte con recorridos de la Tierra.",
      en: "The Moon & Mars map has the ranking, each twin's card and the relief comparison. The Path Planner compares a route on Mars with routes on Earth.",
    },
  },
  again,
];

/** Globos en modo planificador de rutas (globos.html#path-planner). */
export const plannerSteps: TutorialStep[] = [
  {
    title: { es: "Planificador de rutas", en: "Path Planner" },
    body: {
      es: "Traza una ruta en Marte y busca en la Tierra recorridos con la misma forma, distancia y desniveles, para ensayarla en el campo.",
      en: "Draw a route on Mars and find routes on Earth with the same shape, distance and elevation changes, to rehearse it in the field.",
    },
  },
  {
    target: "#path-tools .path-actions",
    title: { es: "1 · Tu ruta en Marte", en: "1 · Your route on Mars" },
    body: {
      es: "Dibuja la ruta punto a punto sobre el globo de Marte, sube un archivo GeoJSON, GPX o KML, o prueba la ruta de ejemplo en Jezero.",
      en: "Draw the route point by point on the Mars globe, upload a GeoJSON, GPX or KML file, or try the example route in Jezero.",
    },
  },
  {
    target: "#path-search",
    title: { es: "2 · Busca en la Tierra", en: "2 · Search on Earth" },
    body: {
      es: "Con la ruta lista, busca: abajo aparecen los recorridos terrestres más parecidos, con sus perfiles de elevación comparados.",
      en: "With the route ready, search: the closest Earth routes appear below, with their elevation profiles compared.",
    },
  },
  {
    target: "#gl-browse-link",
    title: { es: "Volver a los globos", en: "Back to the globes" },
    body: {
      es: "Esta pestaña te devuelve a los sitios y sus gemelos.",
      en: "This tab takes you back to the sites and their twins.",
    },
  },
  again,
];

/** Mapa Luna y Marte (luna-marte.html). */
export const mapSteps: TutorialStep[] = [
  {
    title: { es: "Mapa Luna y Marte", en: "Moon & Mars map" },
    body: {
      es: "Aquí ves en el mapa de la Tierra dónde están los mejores gemelos de cada sitio de la Luna y de Marte, con su ficha y su ranking.",
      en: "Here you see on a map of Earth where the best twins of each Moon and Mars site are, with their card and ranking.",
    },
  },
  {
    target: ".lm-tabs",
    title: { es: "Luna o Marte", en: "Moon or Mars" },
    body: {
      es: "Cambia de cuerpo con estas pestañas. Todo lo demás se actualiza.",
      en: "Switch bodies with these tabs. Everything else updates.",
    },
  },
  {
    target: "#twins-h",
    title: { es: "1 · Elige un sitio", en: "1 · Pick a site" },
    body: {
      es: "Cada grupo es una región o un sitio de la Luna o de Marte. Ábrelo y elige uno de sus tres gemelos de la Tierra.",
      en: "Each group is a region or site on the Moon or Mars. Open it and pick one of its three Earth twins.",
    },
  },
  {
    target: "#ficha",
    title: { es: "2 · Su gemelo en la Tierra", en: "2 · Its twin on Earth" },
    body: {
      es: "La ficha explica en qué se parecen y en qué no (terreno, superficie y clima) y compara el relieve lado a lado, a la misma escala.",
      en: "The card explains where they match and where they don't (terrain, surface and climate) and compares the relief side by side, at the same scale.",
    },
  },
  {
    target: ".lm-map-wrap",
    title: { es: "El mapa", en: "The map" },
    body: {
      es: "Los números son el ranking general y las estrellas, las historias destacadas. Toca cualquiera para abrir su ficha.",
      en: "Numbers are the overall ranking and stars are featured stories. Tap any of them to open its card.",
    },
  },
  {
    target: "#nasa-analogs",
    title: { es: "Más listas", en: "More lists" },
    body: {
      es: "Plegados bajo los gemelos: los análogos que estudió la NASA, las historias destacadas, el ranking, las referencias y la validación del método.",
      en: "Folded below the twins: the analogs NASA has studied, featured stories, the ranking, the references and the method's validation.",
    },
  },
  again,
];
