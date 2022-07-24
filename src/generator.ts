import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import toIco from "to-ico";

const iconConfigs = [
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

async function produceIcons(inputSvgFilePath: string, outputDirPath: string) {
  const icon = sharp(inputSvgFilePath);

  try {
    await fs.access(outputDirPath);
  } catch (e) {
    if (e instanceof Error && e.message.includes("ENOENT")) {
      fs.mkdir(outputDirPath);
    } else {
      throw e;
    }
  }

  iconConfigs.forEach(async (cfg) => {
    const { pxSize, colorsPaletteSize, padding, name } = cfg;
    let outputIcon = icon
      .clone()
      .resize(pxSize, pxSize)
      .png({ compressionLevel: 9, colors: colorsPaletteSize });
    if (padding) {
      outputIcon = outputIcon.extend({
        top: padding,
        left: padding,
        bottom: padding,
        right: padding,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    }

    let outputBuffer = await outputIcon.toBuffer();
    if (name.endsWith(".ico")) {
      outputBuffer = await toIco(outputBuffer);
    }

    return fs.writeFile(path.join(outputDirPath, name), outputBuffer);
  });

  const manifestFile = {
    icons: [
      { src: "/favicon-192.png", type: "image/png", sizes: "192x192" },
      { src: "/favicon-512.png", type: "image/png", sizes: "512x512" },
    ],
  };
  const manifestText = JSON.stringify(manifestFile, null, 2);
  fs.writeFile(path.join(outputDirPath, "manifest.webmanifest"), manifestText);
}

export default produceIcons;
