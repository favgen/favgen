import produceIconsImport from "./generator.js";
import favgenVitePluginImport from "./vite-plugin.js";

type CjsDefault<T> = T | { default: T };

function normalizeDefaultExport<T>(mod: CjsDefault<T>): T {
  return (
    typeof mod === "object" &&
    mod !== null &&
    "default" in mod
  )
    ? (mod as { default: T }).default
    : (mod as T);
}

export const produceIcons = normalizeDefaultExport(
  produceIconsImport as CjsDefault<typeof produceIconsImport>,
);

export const favgenVitePlugin = normalizeDefaultExport(
  favgenVitePluginImport as CjsDefault<typeof favgenVitePluginImport>,
);

export type { FavgenVitePluginOptions } from "./vite-plugin.js";
