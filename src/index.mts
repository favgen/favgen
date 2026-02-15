import produceIconsImport from "./generator.js";
import favgenVitePluginImport from "./vite-plugin.js";
import FavgenWebpackPluginImport from "./webpack-plugin.js";

type CjsDefault<T> = T | { default: T };

function normalizeDefaultExport<T>(mod: CjsDefault<T>): T {
  let current: unknown = mod;

  while (
    typeof current === "object" &&
    current !== null &&
    "default" in current
  ) {
    current = (current as { default: unknown }).default;
  }

  return current as T;
}

export const produceIcons = normalizeDefaultExport(
  produceIconsImport as CjsDefault<typeof produceIconsImport>,
);

export const favgenVitePlugin = normalizeDefaultExport(
  favgenVitePluginImport as CjsDefault<typeof favgenVitePluginImport>,
);

export const FavgenWebpackPlugin = normalizeDefaultExport(
  FavgenWebpackPluginImport as CjsDefault<typeof FavgenWebpackPluginImport>,
);

export type { FavgenVitePluginOptions } from "./vite-plugin.js";
export type { FavgenWebpackPluginOptions } from "./webpack-plugin.js";
