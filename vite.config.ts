import { resolve } from "node:path";
import { defineConfig } from "vite";

// Dos páginas: el mapa global Luna/Marte (luna-marte.html) y los globos 3D de la Luna, la Tierra y Marte
// (globos.html), que incluyen la comparación 3D de terreno del antiguo visor. index.html solo redirige a globos.html.
export default defineConfig({
  base: "./",
  build: {
    rolldownOptions: {
      input: {
        visor: resolve(import.meta.dirname, "index.html"),
        lunaMarte: resolve(import.meta.dirname, "luna-marte.html"),
        globos: resolve(import.meta.dirname, "globos.html"),
      },
    },
  },
});
