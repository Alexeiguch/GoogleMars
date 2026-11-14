import { resolve } from "node:path";
import { defineConfig } from "vite";

// Tres páginas: el visor 3D de Marte (index.html), el mapa global Luna/Marte (luna-marte.html)
// y los globos 3D de la Luna, la Tierra y Marte (globos.html).
export default defineConfig({
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
