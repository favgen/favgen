import fs from "fs/promises";
import os from "os";
import path from "path";

import { describe, it, expect } from "vitest";

import { FavgenWebpackPlugin } from "../lib/index.js";

class SyncHook {
  taps = [];

  tap(_name, callback) {
    this.taps.push(callback);
  }

  call(...args) {
    this.taps.forEach((callback) => callback(...args));
  }
}

class AsyncSeriesHook {
  taps = [];

  tapPromise(_options, callback) {
    this.taps.push(callback);
  }

  async promise(...args) {
    for (const callback of this.taps) {
      await callback(...args);
    }
  }
}

class RawSource {
  constructor(content) {
    this.content = content;
  }

  source() {
    return this.content;
  }
}

async function withTempDir(runTest) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "favgen-webpack-test-"));
  try {
    await runTest(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function writeSvgIcon(filepath) {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    '<rect width="512" height="512" rx="96" fill="#0abf53"/>',
    '<circle cx="256" cy="256" r="140" fill="#ffffff"/>',
    "</svg>",
  ].join("");

  await fs.writeFile(filepath, svg);
}

async function writePngIcon(filepath) {
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  await fs.writeFile(filepath, Buffer.from(pngBase64, "base64"));
}

function createCompiler({ root, publicPath, htmlText }) {
  const compilation = {
    assets: {
      "index.html": new RawSource(htmlText),
    },
    hooks: {
      processAssets: new AsyncSeriesHook(),
    },
    emitAsset(name, asset) {
      this.assets[name] = asset;
    },
    updateAsset(name, asset) {
      this.assets[name] = asset;
    },
  };

  const compiler = {
    options: {
      context: root,
      output: {
        publicPath,
      },
    },
    hooks: {
      thisCompilation: new SyncHook(),
    },
    webpack: {
      Compilation: {
        PROCESS_ASSETS_STAGE_ADDITIONS: 1000,
      },
      sources: {
        RawSource,
      },
    },
  };

  return { compiler, compilation };
}

async function runPluginBuild({
  plugin,
  root,
  publicPath = "/",
  htmlText = "<html><head></head><body></body></html>",
}) {
  const { compiler, compilation } = createCompiler({ root, publicPath, htmlText });
  plugin.apply(compiler);
  compiler.hooks.thisCompilation.call(compilation);
  await compilation.hooks.processAssets.promise();

  const readAsset = (name) => {
    const asset = compilation.assets[name];
    return Buffer.isBuffer(asset.source())
      ? asset.source().toString("utf8")
      : String(asset.source());
  };

  return {
    assets: compilation.assets,
    readAsset,
  };
}

describe("FavgenWebpackPlugin", () => {
  it("emits article assets and injects links for SVG input", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.join(tempDir, "icon.svg");
      await writeSvgIcon(source);

      const plugin = new FavgenWebpackPlugin({
        source,
        assetsPath: "favicons",
      });

      const { assets, readAsset } = await runPluginBuild({
        plugin,
        root: tempDir,
        publicPath: "/app/",
      });

      expect(Object.keys(assets).sort()).toEqual([
        "favicons/apple-touch-icon.png",
        "favicons/favicon.ico",
        "favicons/icon-192.png",
        "favicons/icon-512.png",
        "favicons/icon-mask.png",
        "favicons/icon.svg",
        "favicons/manifest.webmanifest",
        "index.html",
      ]);

      const html = readAsset("index.html");
      expect(html).toContain('href="/app/favicons/favicon.ico"');
      expect(html).toContain('href="/app/favicons/icon.svg"');
      expect(html).toContain('href="/app/favicons/apple-touch-icon.png"');
      expect(html).toContain('href="/app/favicons/manifest.webmanifest"');

      const manifest = JSON.parse(readAsset("favicons/manifest.webmanifest"));
      expect(manifest.icons).toEqual([
        { src: "/app/favicons/icon-192.png", type: "image/png", sizes: "192x192" },
        {
          src: "/app/favicons/icon-mask.png",
          type: "image/png",
          sizes: "512x512",
          purpose: "maskable",
        },
        { src: "/app/favicons/icon-512.png", type: "image/png", sizes: "512x512" },
      ]);
    });
  });

  it("omits icon.svg output and tag for raster source", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.join(tempDir, "icon.png");
      await writePngIcon(source);

      const plugin = new FavgenWebpackPlugin({ source });
      const { assets, readAsset } = await runPluginBuild({
        plugin,
        root: tempDir,
      });

      expect(Object.keys(assets).sort()).toEqual([
        "apple-touch-icon.png",
        "favicon.ico",
        "icon-192.png",
        "icon-512.png",
        "icon-mask.png",
        "index.html",
        "manifest.webmanifest",
      ]);

      const html = readAsset("index.html");
      expect(html).toContain('href="/favicon.ico"');
      expect(html).toContain('href="/apple-touch-icon.png"');
      expect(html).toContain('href="/manifest.webmanifest"');
      expect(html).not.toContain("icon.svg");
    });
  });

  it("uses relative URLs when publicPath is ./", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.join(tempDir, "icon.svg");
      await writeSvgIcon(source);

      const plugin = new FavgenWebpackPlugin({
        source,
        assetsPath: "static/icons",
      });
      const { readAsset } = await runPluginBuild({
        plugin,
        root: tempDir,
        publicPath: "./",
      });

      const html = readAsset("index.html");
      expect(html).toContain('href="static/icons/favicon.ico"');
      expect(html).toContain('href="static/icons/icon.svg"');
      expect(html).toContain('href="static/icons/apple-touch-icon.png"');
      expect(html).toContain('href="static/icons/manifest.webmanifest"');

      const manifest = JSON.parse(readAsset("static/icons/manifest.webmanifest"));
      expect(manifest.icons.map((icon) => icon.src)).toEqual([
        "static/icons/icon-192.png",
        "static/icons/icon-mask.png",
        "static/icons/icon-512.png",
      ]);
    });
  });

  it("throws on invalid colors option", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.join(tempDir, "icon.svg");
      await writeSvgIcon(source);

      const plugin = new FavgenWebpackPlugin({ source, colors: 999 });

      await expect(
        runPluginBuild({
          plugin,
          root: tempDir,
        }),
      ).rejects.toThrow(/`colors` must be an integer between 2 and 256\./);
    });
  });
});
