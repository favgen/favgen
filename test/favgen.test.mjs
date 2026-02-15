import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

import sharp from "sharp";
import { describe, it, expect } from "vitest";

import { produceIcons } from "../lib/index.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = path.join(PROJECT_ROOT, "bin", "index.js");

const SVG_OUTPUT_FILES = [
  "apple-touch-icon.png",
  "favicon.ico",
  "icon-192.png",
  "icon-512.png",
  "icon-mask.png",
  "icon.svg",
  "manifest.webmanifest",
];

const RASTER_OUTPUT_FILES = [
  "apple-touch-icon.png",
  "favicon.ico",
  "icon-192.png",
  "icon-512.png",
  "icon-mask.png",
  "manifest.webmanifest",
];

async function withTempDir(runTest) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "favgen-test-"));
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
  await sharp({
    create: {
      width: 1024,
      height: 768,
      channels: 4,
      background: { r: 15, g: 110, b: 210, alpha: 1 },
    },
  })
    .png()
    .toFile(filepath);
}

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
}

async function getOutputFiles(outputDir) {
  const files = await fs.readdir(outputDir);
  return files.sort();
}

async function getOpaqueBounds(filepath) {
  const { data, info } = await sharp(filepath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  return {
    width,
    height,
    minX,
    minY,
    maxX,
    maxY,
  };
}

describe("produceIcons API", () => {
  it("generates the exact article file set for SVG input", async () => {
    await withTempDir(async (tempDir) => {
      const inputPath = path.join(tempDir, "input.svg");
      const outputPath = path.join(tempDir, "output");
      await writeSvgIcon(inputPath);

      await produceIcons(inputPath, outputPath);

      const files = await getOutputFiles(outputPath);
      expect(files).toEqual(SVG_OUTPUT_FILES);

      const svgIcon = await fs.readFile(path.join(outputPath, "icon.svg"), "utf8");
      expect(svgIcon).toContain("<svg");

      const manifestText = await fs.readFile(
        path.join(outputPath, "manifest.webmanifest"),
        "utf8",
      );
      const manifest = JSON.parse(manifestText);
      expect(manifest).toEqual({
        icons: [
          { src: "/icon-192.png", type: "image/png", sizes: "192x192" },
          {
            src: "/icon-mask.png",
            type: "image/png",
            sizes: "512x512",
            purpose: "maskable",
          },
          { src: "/icon-512.png", type: "image/png", sizes: "512x512" },
        ],
      });
    });
  });

  it("generates the exact article file set for raster input", async () => {
    await withTempDir(async (tempDir) => {
      const inputPath = path.join(tempDir, "input.png");
      const outputPath = path.join(tempDir, "output");
      await writePngIcon(inputPath);

      await produceIcons(inputPath, outputPath);

      const files = await getOutputFiles(outputPath);
      expect(files).toEqual(RASTER_OUTPUT_FILES);
    });
  });

  it("produces expected output image dimensions", async () => {
    await withTempDir(async (tempDir) => {
      const inputPath = path.join(tempDir, "input.png");
      const outputPath = path.join(tempDir, "output");
      await writePngIcon(inputPath);

      await produceIcons(inputPath, outputPath);

      const icon192 = await sharp(path.join(outputPath, "icon-192.png")).metadata();
      const icon512 = await sharp(path.join(outputPath, "icon-512.png")).metadata();
      const iconMask = await sharp(path.join(outputPath, "icon-mask.png")).metadata();
      const appleTouch = await sharp(path.join(outputPath, "apple-touch-icon.png")).metadata();

      expect(icon192.width).toBe(192);
      expect(icon192.height).toBe(192);
      expect(icon512.width).toBe(512);
      expect(icon512.height).toBe(512);
      expect(iconMask.width).toBe(512);
      expect(iconMask.height).toBe(512);
      expect(appleTouch.width).toBe(180);
      expect(appleTouch.height).toBe(180);
    });
  });

  it("keeps required safe-zone padding for maskable and apple icons", async () => {
    await withTempDir(async (tempDir) => {
      const inputPath = path.join(tempDir, "input.png");
      const outputPath = path.join(tempDir, "output");
      await writePngIcon(inputPath);

      await produceIcons(inputPath, outputPath);

      const appleBounds = await getOpaqueBounds(path.join(outputPath, "apple-touch-icon.png"));
      expect(appleBounds).toEqual({
        width: 180,
        height: 180,
        minX: 20,
        minY: 20,
        maxX: 159,
        maxY: 159,
      });

      const maskBounds = await getOpaqueBounds(path.join(outputPath, "icon-mask.png"));
      expect(maskBounds).toEqual({
        width: 512,
        height: 512,
        minX: 52,
        minY: 52,
        maxX: 459,
        maxY: 459,
      });
    });
  });
});

describe("CLI", () => {
  it("supports absolute input paths and creates nested output directories", async () => {
    await withTempDir(async (tempDir) => {
      const inputPath = path.join(tempDir, "input.png");
      const outputPath = path.join(tempDir, "nested", "icons", "output");
      await writePngIcon(inputPath);

      const result = runCli([inputPath, "-o", outputPath]);
      expect(result.status).toBe(0);

      const files = await getOutputFiles(outputPath);
      expect(files).toEqual(RASTER_OUTPUT_FILES);
    });
  });

  it("rejects invalid colors palette values", async () => {
    await withTempDir(async (tempDir) => {
      const inputPath = path.join(tempDir, "input.png");
      const outputPath = path.join(tempDir, "output");
      await writePngIcon(inputPath);

      const result = runCli([inputPath, "-o", outputPath, "--colors", "300"]);
      expect(result.status).not.toBe(0);
      expect(`${result.stderr}\n${result.stdout}`).toMatch(
        /Color palette size must be a number between 2 and 256\./,
      );
    });
  });

  it("fails with ENOENT when the input file is missing", async () => {
    await withTempDir(async (tempDir) => {
      const missingInputPath = path.join(tempDir, "missing.png");
      const outputPath = path.join(tempDir, "output");

      const result = runCli([missingInputPath, "-o", outputPath]);
      expect(result.status).not.toBe(0);
      expect(`${result.stderr}\n${result.stdout}`).toMatch(/ENOENT|no such file/i);
    });
  });
});
