[![npm](https://img.shields.io/npm/v/favgen?style=flat-square)](https://www.npmjs.com/package/favgen)

This is a simple CLI tool to generate an optimized set of favicons from a single input file. Icons are optimized in terms of both size and quantity (nowadays you don't need that many of them). They are produced according to [this article](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) which served as an inspiration for the tool.

## CLI usage

Use it like this: `npx favgen /path/to/input -o /path/to/output`.

You can tweak the following settings by giving additional commands:
- output directory by providing `-o` option with a path (`__favicons__` by default)
- colors palette size by providing `--colors` with a number between 2 and 256 (64 by default)

Input file can be in any of the following formats: JPEG, PNG, WebP, GIF, AVIF, TIFF or SVG (anything [sharp library](https://sharp.pixelplumbing.com/) accepts).

By default, the following set of favicons is produced:
- `icon.svg` (only if input file is SVG)
- `favicon.ico` 32x32
- `icon-192.png` 192x192 (for Android devices)
- `icon-512.png` 512x512 (for Android devices)
- `icon-mask.png` 512x512 with safe padding (for Android maskable icon support)
- `apple-touch-icon.png` 180x180 (original image is resized to 140x140 and 20px transparent padding is added on each side; rationale for this is given in the article)

Additionally, a sample `manifest.webmanifest` file is produced which includes regular and maskable Android icons.

Besides that, PNG output is optimized by `sharp` (which uses `pngquant`) and SVG output is optimized by [SVGO](https://github.com/svg/svgo).
Also, color palette is reduced to 64 colors by default in order to reduce assets’ size.

## JS API usage

The tool can be also used as API:
```js
const { produceIcons } = require("favgen")
const inputFilePath = "icon.svg"
const outputDirPath = "__favicons__"
const paletteSize = 64 // default value
produceIcons(inputFilePath, outputDirPath, paletteSize)
```

## Vite plugin usage

Install:
```bash
npm i favgen
```

Configure in `vite.config.js` or `vite.config.ts`:
```js
import { defineConfig } from "vite"
import { favgenVitePlugin } from "favgen"

export default defineConfig({
  plugins: [
    favgenVitePlugin({
      source: "src/assets/logo.svg",
      colors: 64,
      assetsPath: "favicons",
    }),
  ],
})
```

Vite plugin options:
- `source` (required): path to source image (SVG, PNG, JPEG, WebP, GIF, AVIF, TIFF)
- `colors` (optional): PNG palette size between 2 and 256 (`64` by default)
- `assetsPath` (optional): subdirectory where generated assets are emitted (e.g. `favicons`)

The plugin runs on build and:
- generates favicon assets using the same logic as CLI/API
- emits them into the final build output
- injects links into built HTML:
  - `favicon.ico`
  - `icon.svg` (only when source is SVG)
  - `apple-touch-icon.png`
  - `manifest.webmanifest`

Generated files:
- `icon.svg` (only for SVG source)
- `favicon.ico`
- `icon-192.png`
- `icon-512.png`
- `icon-mask.png`
- `apple-touch-icon.png`
- `manifest.webmanifest`

Manifest icon URLs and injected HTML links are automatically adjusted for Vite `base` and `assetsPath` settings.

## Webpack plugin usage

Install:
```bash
npm i favgen
```

Configure in your webpack config:
```js
const FavgenWebpackPlugin = require("favgen").FavgenWebpackPlugin

module.exports = {
  // ...rest of config
  plugins: [
    new FavgenWebpackPlugin({
      source: "src/assets/logo.svg",
      colors: 64,
      assetsPath: "favicons",
    }),
  ],
}
```

Webpack plugin options:
- `source` (required): path to source image (SVG, PNG, JPEG, WebP, GIF, AVIF, TIFF)
- `colors` (optional): PNG palette size between 2 and 256 (`64` by default)
- `assetsPath` (optional): subdirectory where generated assets are emitted (e.g. `favicons`)

The plugin runs during webpack compilation and:
- generates favicon assets using the same logic as CLI/API
- emits assets into compilation output
- injects links into generated `.html` assets:
  - `favicon.ico`
  - `icon.svg` (only when source is SVG)
  - `apple-touch-icon.png`
  - `manifest.webmanifest`

Manifest icon URLs and injected HTML links are automatically adjusted for webpack `output.publicPath` and `assetsPath`.
