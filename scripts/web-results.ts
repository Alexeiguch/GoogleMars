import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { normalizePath, type Plugin } from "vite";

const source = normalizePath(fileURLToPath(new URL("../src/data/results.json", import.meta.url)));
const prefix = "virtual:terratwin-results/";
type Row = Record<string, unknown>;
type BodyData = {
  sites: Row[];
  twins: Record<string, Row[]>;
  heat: unknown;
  fine?: Partial<Record<"sites" | "final" | "final_new", Row[]>> & {
    twins?: Record<string, Row[]>;
  };
};
type Results = Row & { references: Row[]; references_fine?: Row[]; bodies: Record<string, BodyData> };

const pick = (row: Row, fields: string[]) =>
  Object.fromEntries(fields.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]));
const mapValues = <T, U>(record: Record<string, T>, project: (value: T) => U) =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [key, project(value)]));
const globeReferenceFields = ["id", "body", "name", "lat", "lon", "note", "kind", "twin_key", "region", "group",
  "usable", "usable_note", "source_url", "window_km"];
const globeSiteFields = ["lat", "lon", "score", "scores", "climate", "best_ref", "surface_assumed", "known_analog"];

function globeResults(results: Results) {
  const site = (row: Row) => pick(row, globeSiteFields);
  return {
    ...pick(results, ["featured", "validation"]),
    references: results.references.map((row) => pick(row, globeReferenceFields)),
    bodies: mapValues(results.bodies, ({ sites, twins, heat }) => ({
      sites: sites.map(site),
      twins: mapValues(twins, (rows) => rows.map(site)),
      heat,
    })),
  };
}

function mapResults(results: Results) {
  const reference = (row: Row) => pick(row, [...globeReferenceFields, "level", "features", "shape", "quality",
    "source_note", "coord_quality", "dem", "group_only"]);
  const site = (row: Row) => pick(row, [...globeSiteFields, "elev_mean", "climate_parts", "best_ref_L0",
    "best_ref_L1", "best_ref_L2", "twin_key", "level", "hirise", "l2_scope", "levels", "l2", "parent_L0",
    "features", "shape", "cover", "literature", "robust"]);
  return {
    ...pick(results, ["feature_labels", "validation", "validation_no_window", "featured", "groups", "levels",
      "reference_points", "weight_sensitivity"]),
    references: results.references.map(reference),
    references_fine: results.references_fine?.map(reference),
    bodies: mapValues(results.bodies, ({ sites, twins, heat, fine }) => ({
      sites: sites.map(site),
      twins: mapValues(twins, (rows) => rows.map(site)),
      heat,
      fine: fine && {
        sites: fine.sites?.map(site),
        twins: fine.twins && mapValues(fine.twins, (rows) => rows.map(site)),
        final: fine.final?.map(site),
        final_new: fine.final_new?.map(site),
      },
    })),
  };
}

/** Ship only the fields each page reads, leaving the pipeline output and its diagnostics intact. */
export function webResults(): Plugin {
  const projections = new Map([
    [prefix + "globes", globeResults],
    [prefix + "map", mapResults],
  ]);
  return {
    name: "terratwin-web-results",
    resolveId(id) {
      if (projections.has(id)) return "\0" + id;
    },
    async load(id) {
      if (!id.startsWith("\0" + prefix)) return;
      const project = projections.get(id.slice(1));
      if (!project) return;
      this.addWatchFile(source);
      const data = project(JSON.parse(await readFile(source, "utf8")) as Results);
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(data))});`;
    },
    hotUpdate({ file, server }) {
      if (file !== source) return;
      for (const name of projections.keys()) {
        const module = this.environment.moduleGraph.getModuleById("\0" + name);
        if (module) this.environment.moduleGraph.invalidateModule(module);
      }
      if (this.environment.name === "client") server.ws.send({ type: "full-reload" });
      return [];
    },
  };
}
