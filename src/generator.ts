import fs from "fs/promises";
import path from "path";
import sharp, { Sharp } from "sharp";
import toIco from "to-ico";
import { optimize as optimizeSvg } from "svgo";
import isSvg from "is-svg";

type IconConfig = {
  name: string;
  pxSize?: number;
  colorsPaletteSize?: number;
  padding?: number;
};

const baseIconConfigs: IconConfig[] = [
  {
    name: "icon.svg",
  },
  {
    // no colors palette size otherwise its color profile is off
    // which causes problems with converting to ico
    name: "favicon.ico",
    pxSize: 32,
  },
  {
    name: "icon-192.png",
    pxSize: 192,
    colorsPaletteSize: 64,
  },
  {
    name: "icon-512.png",
    pxSize: 512,
    colorsPaletteSize: 64,
  },
  {
    name: "icon-mask.png",
    pxSize: 512,
    colorsPaletteSize: 64,
    // 512 - (52 * 2) = 408 which stays in the recommended 409px safe zone
    padding: 52,
  },
  {
    name: "apple-touch-icon.png",
    pxSize: 180,
    colorsPaletteSize: 64,
    padding: 20,
  },
];

function buildPng(
  rawBuffer: Buffer,
  { pxSize, colorsPaletteSize, padding }: IconConfig,
): Sharp {
  if (pxSize === undefined) {
    throw Error("PNG output size is not defined.");
  }

  const resizePxSize = padding ? pxSize - padding * 2 : pxSize;
  if (resizePxSize <= 0) {
    throw Error("Padding is too large for the output size.");
  }

  const outputIcon = sharp(rawBuffer)
    .resize(resizePxSize, resizePxSize)
    .png({ compressionLevel: 9, colors: colorsPaletteSize });

  return padding
    ? outputIcon.extend({
        top: padding,
        left: padding,
        bottom: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
    : outputIcon;
}

function getPngBuffer(rawBuffer: Buffer, cfg: IconConfig): Promise<Buffer> {
  return buildPng(rawBuffer, cfg).toBuffer();
}

function getIcoBuffer(rawBuffer: Buffer, cfg: IconConfig): Promise<Buffer> {
  return buildPng(rawBuffer, cfg)
    .toBuffer()
    .then((buf) => toIco(buf, { resize: true }));
}

function getSvgBuffer(rawBuffer: Buffer): Buffer {
  const optimizedSvg = optimizeSvg(rawBuffer, {
    multipass: true,
  });

  if (optimizedSvg.error !== undefined) {
    throw Error(optimizedSvg.error);
  }

  return Buffer.from(optimizedSvg.data);
}

function getIconBuffer(
  rawBuffer: Buffer,
  cfg: IconConfig,
): Buffer | Promise<Buffer> {
  const iconName = cfg.name;
  const iconExtension = path.extname(iconName);
  switch (iconExtension) {
    case ".svg":
      return getSvgBuffer(rawBuffer);
    case ".png":
      return getPngBuffer(rawBuffer, cfg);
    case ".ico":
      return getIcoBuffer(rawBuffer, cfg);
    default:
      throw Error(`Extension ${iconExtension} is not recognized.`);
  }
}

async function produceIcons(
  inputFilePath: string,
  outputDirPath: string,
  paletteSize: number = 64,
) {
  await fs.access(inputFilePath);
  await fs.mkdir(outputDirPath, { recursive: true });

  const rawIconBuf = await fs.readFile(inputFilePath);
  const isSvgBuf = isSvg(rawIconBuf);

  const iconConfigs = baseIconConfigs
    .filter((cfg) => isSvgBuf || cfg.name !== "icon.svg")
    .map((cfg) => {
    const mappedCfg = { ...cfg };

    if (mappedCfg.name.endsWith(".png")) {
      mappedCfg.colorsPaletteSize = paletteSize;
    }

    return mappedCfg;
  });

  const iconsGenerationSeries = iconConfigs.map(async (cfg) => {
    const outputBuffer = await getIconBuffer(rawIconBuf, cfg);

    return fs.writeFile(path.join(outputDirPath, cfg.name), outputBuffer);
  });

  await Promise.all(iconsGenerationSeries);

  const manifestFile = {
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
  };
  const manifestText = JSON.stringify(manifestFile, null, 2);
  await fs.writeFile(path.join(outputDirPath, "manifest.webmanifest"), manifestText);
}

export default produceIcons;
