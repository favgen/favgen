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
    name: "favicon.svg",
  },
  {
    // no colors palette size otherwise its color profile is off
    // which causes problems with converting to ico
    name: "favicon.ico",
    pxSize: 32,
  },
  {
    name: "favicon-192.png",
    pxSize: 192,
    colorsPaletteSize: 64,
  },
  {
    name: "favicon-512.png",
    pxSize: 512,
    colorsPaletteSize: 64,
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
  const outputIcon = sharp(rawBuffer)
    .resize(pxSize, pxSize)
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
    .then((buf) => toIco(buf));
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
  prefix: string = "favicon",
  paletteSize: number = 64,
  include16: boolean = false,
) {
  await fs.access(inputFilePath);

  try {
    await fs.access(outputDirPath);
  } catch (e) {
    if (e instanceof Error && e.message.includes("ENOENT")) {
      fs.mkdir(outputDirPath);
    } else {
      throw e;
    }
  }

  const rawIconBuf = await fs.readFile(inputFilePath);
  const isSvgBuf = isSvg(rawIconBuf);

  let iconConfigs = baseIconConfigs.map((cfg) => {
    const mappedCfg = { ...cfg };
    if (!isSvgBuf && mappedCfg.name.endsWith(".svg")) {
      mappedCfg.name = mappedCfg.name.replace(".svg", ".png");
      mappedCfg.pxSize = 32;
    }

    mappedCfg.name = mappedCfg.name.replace("favicon", prefix);

    if (mappedCfg.name.endsWith(".png")) {
      mappedCfg.colorsPaletteSize = paletteSize;
    }

    return mappedCfg;
  });
  if (include16) {
    const ico = iconConfigs.find((cfg) =>
      cfg.name.endsWith(".ico"),
    ) as IconConfig;
    const icoNameWithoutExt = ico.name.slice(0, -4);
    iconConfigs.push({ ...ico, name: `${icoNameWithoutExt}-32.ico` });
    iconConfigs.push({
      ...ico,
      name: `${icoNameWithoutExt}-16.ico`,
      pxSize: 16,
    });
    iconConfigs = iconConfigs.filter((cfg) => cfg !== ico);
  }

  const iconsGenerationSeries = iconConfigs.map(async (cfg) => {
    const iconName = cfg.name.replace("favicon", prefix);
    const iconCfg = cfg.name.endsWith("png")
      ? { ...cfg, colorsPaletteSize: paletteSize, name: iconName }
      : { ...cfg, name: iconName };
    const outputBuffer = await getIconBuffer(rawIconBuf, iconCfg);

    return fs.writeFile(path.join(outputDirPath, iconCfg.name), outputBuffer);
  });

  await Promise.all(iconsGenerationSeries);

  const manifestFile = {
    icons: [
      { src: `/${prefix}-192.png`, type: "image/png", sizes: "192x192" },
      { src: `/${prefix}-512.png`, type: "image/png", sizes: "512x512" },
    ],
  };
  const manifestText = JSON.stringify(manifestFile, null, 2);
  fs.writeFile(path.join(outputDirPath, "manifest.webmanifest"), manifestText);
}

export default produceIcons;
