import fs from "fs/promises";
import os from "os";
import path from "path";

import { describe, it, expect } from "vitest";

import { favgenVitePlugin } from "../lib/index.js";

function createEmitContext() {
  const emitted = [];
  return {
    emitted,
    context: {
      emitFile(file) {
        emitted.push(file);
      },
    },
  };
}

async function withTempDir(runTest) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "favgen-vite-test-"));
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

async function runPluginBuild(plugin, resolvedConfig) {
  plugin.configResolved(resolvedConfig);
  await plugin.buildStart.call({});
  const { emitted, context } = createEmitContext();
  plugin.generateBundle.call(context);
  const htmlTags = plugin.transformIndexHtml();
  await plugin.closeBundle.call({});
  return { emitted, htmlTags };
}

describe("favgenVitePlugin", () => {
  it("emits article assets and injects HTML tags for SVG input", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.join(tempDir, "icon.svg");
      await writeSvgIcon(source);

      const plugin = favgenVitePlugin({ source, assetsPath: "favicons" });
      const { emitted, htmlTags } = await runPluginBuild(plugin, {
        root: tempDir,
        base: "/app/",
      });

      const emittedNames = emitted.map((asset) => asset.fileName).sort();
      expect(emittedNames).toEqual([
        "favicons/apple-touch-icon.png",
        "favicons/favicon.ico",
        "favicons/icon-192.png",
        "favicons/icon-512.png",
        "favicons/icon-mask.png",
        "favicons/icon.svg",
        "favicons/manifest.webmanifest",
      ]);

      const tagHrefs = htmlTags.map((tag) => tag.attrs.href);
      expect(tagHrefs).toEqual([
        "/app/favicons/favicon.ico",
        "/app/favicons/icon.svg",
        "/app/favicons/apple-touch-icon.png",
        "/app/favicons/manifest.webmanifest",
      ]);

      const manifestAsset = emitted.find(
        (asset) => asset.fileName === "favicons/manifest.webmanifest",
      );
      expect(manifestAsset).toBeDefined();
      const manifest = JSON.parse(manifestAsset.source.toString("utf8"));
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

  it("does not inject icon.svg tag for raster input", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.join(tempDir, "icon.png");
      await writePngIcon(source);

      const plugin = favgenVitePlugin({ source });
      const { emitted, htmlTags } = await runPluginBuild(plugin, {
        root: tempDir,
        base: "/",
      });

      const emittedNames = emitted.map((asset) => asset.fileName).sort();
      expect(emittedNames).toEqual([
        "apple-touch-icon.png",
        "favicon.ico",
        "icon-192.png",
        "icon-512.png",
        "icon-mask.png",
        "manifest.webmanifest",
      ]);

      const tagHrefs = htmlTags.map((tag) => tag.attrs.href);
      expect(tagHrefs).toEqual([
        "/favicon.ico",
        "/apple-touch-icon.png",
        "/manifest.webmanifest",
      ]);
    });
  });

  it("supports relative base path in generated URLs", async () => {
    await withTempDir(async (tempDir) => {
      const source = path.join(tempDir, "icon.svg");
      await writeSvgIcon(source);

      const plugin = favgenVitePlugin({ source, assetsPath: "static/icons" });
      const { htmlTags, emitted } = await runPluginBuild(plugin, {
        root: tempDir,
        base: "./",
      });

      expect(htmlTags.map((tag) => tag.attrs.href)).toEqual([
        "static/icons/favicon.ico",
        "static/icons/icon.svg",
        "static/icons/apple-touch-icon.png",
        "static/icons/manifest.webmanifest",
      ]);

      const manifestAsset = emitted.find(
        (asset) => asset.fileName === "static/icons/manifest.webmanifest",
      );
      const manifest = JSON.parse(manifestAsset.source.toString("utf8"));
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

      const plugin = favgenVitePlugin({ source, colors: 300 });
      plugin.configResolved({
        root: tempDir,
        base: "/",
      });

      await expect(plugin.buildStart.call({})).rejects.toThrow(
        /`colors` must be an integer between 2 and 256\./,
      );
    });
  });
});
