[![npm](https://img.shields.io/npm/v/favgen?style=flat-square)](https://www.npmjs.com/package/favgen)

This is a simple CLI tool to generate an optimized set of favicons from a single input file. Icons are optimized in terms of both size and quantity (nowadays you don't need that many of them). They are produced according to [this article](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) which served as an inspiration for the tool.

Use it like this: `npx favgen /path/to/input -o /path/to/output`.

You can tweak the following settings by giving additional commands:
- output directory by providing `-o` option with a path (`__favicon__` by default)
- icon prefix by providing `--prefix` option with a name (`favicon` by default)
- colors palette size by providing `--colors` with a number between 2 and 256
- producing 16x16 .ico file by setting `--include16` flag

Input file can be in any of the following formats: JPEG, PNG, WebP, GIF, AVIF, TIFF or SVG (anything [sharp library](https://sharp.pixelplumbing.com/) accepts).

By default, the following set of favicons is produced:
- `favicon.svg` if input file was SVG and `favicon.png` 32x32 otherwise
- `favicon.ico` 32x32
- `favicon-192.png` 192x192 (for Android devices)
- `favicon-512.png` 192x192 (for Android devices)
- `apple-touch-icon.png` 180x180 (original image is resized to 140x140 and 20px transparent padding is added on each side; rationale for this is given in the article)

Additionally, a sample `manifest.webmanifest` file is produced which shows how favicons for Android devices are supposed to be included.

Besides that, PNG output is optimized by `sharp` (which uses `pngquant`) and SVG output is optimized by [SVGO](https://github.com/svg/svgo).
Also, color palette is reduced to 64 colors by default in order to reduce assets’ size.

The tool can be also used as API:
```js
const { produceIcons } = require("favgen")
const inputFilePath = "favicon.svg"
const outputDirPath = "__favicons__"
const prefix = "favicon" // default value
const paletteSize = 64 // default value
const include16 = true // default is false
produceIcons(inputFilePath, outputDirPath, prefix, paletteSize, include16)
```
