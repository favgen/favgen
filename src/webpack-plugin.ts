import fs from "fs/promises";
import os from "os";
import path from "path";
import produceIcons from "./generator";

export type FavgenWebpackPluginOptions = {
  source: string;
  colors?: number;
  assetsPath?: string;
};

type GeneratedAsset = {
  filename: string;
  source: Buffer;
};

type RawSource = {
  source: () => string | Buffer;
};

type RawSourceConstructor = new (source: string | Buffer) => RawSource;

type Compilation = {
  assets: Record<string, RawSource>;
  hooks: {
    processAssets: {
      tapPromise: (
        options: { name: string; stage: number },
        callback: () => Promise<void>,
      ) => void;
    };
  };
  emitAsset: (name: string, asset: RawSource) => void;
  updateAsset: (name: string, asset: RawSource) => void;
};

type Compiler = {
  options: {
    context?: string;
    output?: {
      publicPath?: string | "auto";
    };
  };
  hooks: {
    thisCompilation: {
      tap: (name: string, callback: (compilation: Compilation) => void) => void;
    };
  };
  webpack: {
    Compilation: {
      PROCESS_ASSETS_STAGE_ADDITIONS: number;
      PROCESS_ASSETS_STAGE_REPORT?: number;
    };
    sources: {
      RawSource: RawSourceConstructor;
    };
  };
};

function normalizeAssetsPath(rawPath: string | undefined): string {
  if (!rawPath) {
    return "";
  }

  return rawPath.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isValidPaletteSize(size: number): boolean {
  return Number.isInteger(size) && size >= 2 && size <= 256;
}

function normalizePublicPath(publicPath: string | "auto" | undefined): string {
  if (!publicPath || publicPath === "auto") {
    return "/";
  }

  return publicPath;
}

function getAssetUrl(publicPath: string, assetsPath: string, filename: string): string {
  const relativePath = assetsPath
    ? path.posix.join(assetsPath, filename)
    : filename;
  const normalizedPublicPath = publicPath.trim();

  if (normalizedPublicPath === "." || normalizedPublicPath === "./") {
    return relativePath;
  }

  if (/^https?:\/\//.test(normalizedPublicPath)) {
    return new URL(relativePath, normalizedPublicPath).toString();
  }

  const publicPathWithSlash = normalizedPublicPath.endsWith("/")
    ? normalizedPublicPath
    : `${normalizedPublicPath}/`;

  return `${publicPathWithSlash}${relativePath}`;
}

function rewriteManifest(
  manifestBuffer: Buffer,
  publicPath: string,
  assetsPath: string,
): Buffer {
  const manifest = JSON.parse(manifestBuffer.toString("utf8")) as {
    icons?: Array<Record<string, unknown>>;
  };

  if (Array.isArray(manifest.icons)) {
    manifest.icons = manifest.icons.map((icon) => {
      const sourcePath = icon.src;
      const iconFilename = typeof sourcePath === "string"
        ? path.posix.basename(sourcePath)
        : "";

      return {
        ...icon,
        src: getAssetUrl(publicPath, assetsPath, iconFilename),
      };
    });
  }

  return Buffer.from(JSON.stringify(manifest, null, 2));
}

function getHtmlTagStrings(
  publicPath: string,
  assetsPath: string,
  hasSvgIcon: boolean,
): string[] {
  const tags = [
    `<link rel="icon" href="${getAssetUrl(publicPath, assetsPath, "favicon.ico")}" sizes="any">`,
    `<link rel="apple-touch-icon" href="${getAssetUrl(publicPath, assetsPath, "apple-touch-icon.png")}">`,
    `<link rel="manifest" href="${getAssetUrl(publicPath, assetsPath, "manifest.webmanifest")}">`,
  ];

  if (hasSvgIcon) {
    tags.splice(
      1,
      0,
      `<link rel="icon" href="${getAssetUrl(publicPath, assetsPath, "icon.svg")}" type="image/svg+xml">`,
    );
  }

  return tags;
}

function injectTagsIntoHtml(htmlText: string, tags: string[]): string {
  const missingTags = tags.filter((tag) => !htmlText.includes(tag));
  if (missingTags.length === 0) {
    return htmlText;
  }

  const tagsBlock = `${missingTags.join("\n")}\n`;
  if (/<\/head>/i.test(htmlText)) {
    return htmlText.replace(/<\/head>/i, `${tagsBlock}</head>`);
  }

  return `${tagsBlock}${htmlText}`;
}

export default class FavgenWebpackPlugin {
  private readonly sourcePath: string;

  private readonly paletteSize: number;

  private readonly assetsPath: string;

  constructor(options: FavgenWebpackPluginOptions) {
    this.sourcePath = options.source;
    this.paletteSize = options.colors ?? 64;
    this.assetsPath = normalizeAssetsPath(options.assetsPath);
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap("favgen-webpack-plugin", (compilation) => {
      const emitStage = compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS;
      const injectStage = compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT
        ?? emitStage + 1000;
      const { RawSource } = compiler.webpack.sources;
      let htmlTags: string[] = [];

      compilation.hooks.processAssets.tapPromise(
        { name: "favgen-webpack-plugin", stage: emitStage },
        async () => {
          if (!this.sourcePath || this.sourcePath.trim().length === 0) {
            throw new Error("favgen-webpack-plugin: `source` option is required.");
          }
          if (!isValidPaletteSize(this.paletteSize)) {
            throw new Error(
              "favgen-webpack-plugin: `colors` must be an integer between 2 and 256.",
            );
          }

          const projectRoot = compiler.options.context ?? process.cwd();
          const publicPath = normalizePublicPath(compiler.options.output?.publicPath);
          const resolvedSourcePath = path.isAbsolute(this.sourcePath)
            ? this.sourcePath
            : path.resolve(projectRoot, this.sourcePath);

          const tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), "favgen-webpack-"));

          try {
            await produceIcons(resolvedSourcePath, tempDirPath, this.paletteSize);
            const iconFilenames = (await fs.readdir(tempDirPath)).sort();
            const hasSvgIcon = iconFilenames.includes("icon.svg");

            const generatedAssets = await Promise.all(
              iconFilenames.map(async (filename) => ({
                filename,
                source: await fs.readFile(path.join(tempDirPath, filename)),
              })),
            );

            generatedAssets.forEach((asset) => {
              const outputFilename = this.assetsPath
                ? path.posix.join(this.assetsPath, asset.filename)
                : asset.filename;
              const outputSource = asset.filename === "manifest.webmanifest"
                ? rewriteManifest(asset.source, publicPath, this.assetsPath)
                : asset.source;

              compilation.emitAsset(outputFilename, new RawSource(outputSource));
            });

            htmlTags = getHtmlTagStrings(publicPath, this.assetsPath, hasSvgIcon);
          } finally {
            await fs.rm(tempDirPath, { recursive: true, force: true });
          }
        },
      );

      compilation.hooks.processAssets.tapPromise(
        { name: "favgen-webpack-plugin-html-injection", stage: injectStage },
        async () => {
          if (htmlTags.length === 0) {
            return;
          }

          Object.entries(compilation.assets).forEach(([filename, asset]) => {
            if (!filename.endsWith(".html")) {
              return;
            }

            const currentSource = asset.source();
            const htmlText = Buffer.isBuffer(currentSource)
              ? currentSource.toString("utf8")
              : String(currentSource);
            const nextHtmlText = injectTagsIntoHtml(htmlText, htmlTags);

            if (nextHtmlText !== htmlText) {
              compilation.updateAsset(filename, new RawSource(nextHtmlText));
            }
          });
        },
      );
    });
  }
}
