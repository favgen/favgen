import fs from "fs/promises";
import os from "os";
import path from "path";
import produceIcons from "./generator";

export type FavgenVitePluginOptions = {
  source: string;
  colors?: number;
  assetsPath?: string;
};

type HtmlTagDescriptor = {
  tag: string;
  attrs: Record<string, string>;
  injectTo?: "head" | "body";
};

type ResolvedConfig = {
  root: string;
  base: string;
};

type EmitAsset = {
  type: "asset";
  fileName: string;
  source: Buffer;
};

type PluginContext = {
  emitFile: (asset: EmitAsset) => void;
};

type Plugin = {
  name: string;
  apply?: "build";
  configResolved?: (resolvedConfig: ResolvedConfig) => void;
  buildStart?: () => Promise<void>;
  generateBundle?: (this: PluginContext) => void;
  transformIndexHtml?: () => HtmlTagDescriptor[];
  closeBundle?: () => Promise<void>;
};

type GeneratedAsset = {
  filename: string;
  source: Buffer;
};

function normalizeAssetsPath(rawPath: string | undefined): string {
  if (!rawPath) {
    return "";
  }

  return rawPath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function getAssetUrl(
  base: string,
  assetsPath: string,
  filename: string,
): string {
  const relativePath = assetsPath
    ? path.posix.join(assetsPath, filename)
    : filename;
  const normalizedBase = base.trim();

  if (normalizedBase === "." || normalizedBase === "./") {
    return relativePath;
  }

  if (/^https?:\/\//.test(normalizedBase)) {
    return new URL(relativePath, normalizedBase).toString();
  }

  const baseWithSlash = normalizedBase.endsWith("/")
    ? normalizedBase
    : `${normalizedBase}/`;

  return `${baseWithSlash}${relativePath}`;
}

function isValidPaletteSize(size: number): boolean {
  return Number.isInteger(size) && size >= 2 && size <= 256;
}

function rewriteManifest(
  manifestBuffer: Buffer,
  base: string,
  assetsPath: string,
): Buffer {
  const manifest = JSON.parse(manifestBuffer.toString("utf8")) as {
    icons?: Array<Record<string, unknown>>;
  };

  if (Array.isArray(manifest.icons)) {
    manifest.icons = manifest.icons.map((icon) => {
      const sourcePath = icon.src;
      const iconFilename =
        typeof sourcePath === "string" ? path.posix.basename(sourcePath) : "";
      return {
        ...icon,
        src: getAssetUrl(base, assetsPath, iconFilename),
      };
    });
  }

  return Buffer.from(JSON.stringify(manifest, null, 2));
}

function getHtmlTags(
  base: string,
  assetsPath: string,
  hasSvgIcon: boolean,
): HtmlTagDescriptor[] {
  const tags: HtmlTagDescriptor[] = [
    {
      tag: "link",
      attrs: {
        rel: "icon",
        href: getAssetUrl(base, assetsPath, "favicon.ico"),
        sizes: "any",
      },
      injectTo: "head",
    },
    {
      tag: "link",
      attrs: {
        rel: "apple-touch-icon",
        href: getAssetUrl(base, assetsPath, "apple-touch-icon.png"),
      },
      injectTo: "head",
    },
    {
      tag: "link",
      attrs: {
        rel: "manifest",
        href: getAssetUrl(base, assetsPath, "manifest.webmanifest"),
      },
      injectTo: "head",
    },
  ];

  if (hasSvgIcon) {
    tags.splice(1, 0, {
      tag: "link",
      attrs: {
        rel: "icon",
        href: getAssetUrl(base, assetsPath, "icon.svg"),
        type: "image/svg+xml",
      },
      injectTo: "head",
    });
  }

  return tags;
}

export default function favgenVitePlugin(
  options: FavgenVitePluginOptions,
): Plugin {
  const assetsPath = normalizeAssetsPath(options.assetsPath);
  const paletteSize = options.colors ?? 64;
  const sourcePath = options.source;

  let config: ResolvedConfig | null = null;
  let tempDirPath: string | null = null;
  let generatedAssets: GeneratedAsset[] = [];
  let hasSvgIcon = false;

  return {
    name: "favgen-vite-plugin",
    apply: "build",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    async buildStart() {
      if (!config) {
        throw new Error("favgen-vite-plugin: Vite config is not resolved.");
      }

      if (!sourcePath || sourcePath.trim().length === 0) {
        throw new Error("favgen-vite-plugin: `source` option is required.");
      }

      if (!isValidPaletteSize(paletteSize)) {
        throw new Error(
          "favgen-vite-plugin: `colors` must be an integer between 2 and 256.",
        );
      }

      const resolvedSourcePath = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.resolve(config.root, sourcePath);

      tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), "favgen-vite-"));
      await produceIcons(resolvedSourcePath, tempDirPath, paletteSize);

      const fileNames = (await fs.readdir(tempDirPath)).sort();
      hasSvgIcon = fileNames.includes("icon.svg");

      const assets = await Promise.all(
        fileNames.map(async (filename) => ({
          filename,
          source: await fs.readFile(path.join(tempDirPath as string, filename)),
        })),
      );

      generatedAssets = assets.map((asset) =>
        asset.filename === "manifest.webmanifest"
          ? {
              ...asset,
              source: rewriteManifest(
                asset.source,
                config?.base ?? "/",
                assetsPath,
              ),
            }
          : asset,
      );
    },
    generateBundle() {
      generatedAssets.forEach((asset) => {
        this.emitFile({
          type: "asset",
          fileName: assetsPath
            ? path.posix.join(assetsPath, asset.filename)
            : asset.filename,
          source: asset.source,
        });
      });
    },
    transformIndexHtml() {
      return getHtmlTags(config?.base ?? "/", assetsPath, hasSvgIcon);
    },
    async closeBundle() {
      if (tempDirPath) {
        await fs.rm(tempDirPath, { recursive: true, force: true });
      }
    },
  };
}
