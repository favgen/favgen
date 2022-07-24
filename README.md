![npm](https://img.shields.io/npm/v/favgen?style=flat-square)

This is a simple CLI tool to generate an optimized set of favicons from a single input file. Icons are optimized in terms of both size and quantity (nowadays you don't that many of them). They are produced according to [this article](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) which served as an inspiration for the tool.

You can provide a file with any extension that [sharp library](https://sharp.pixelplumbing.com/) accepts.

By default, the following set of favicons is produced:
- `favicon.svg` if input file was SVG and `favicon.png` 32x32 otherwise
- `favicon.ico` 32x32
- `favicon-192.png` 192x192 (for Android devices)
- `favicon-512.png` 192x192 (for Android devices)
- `apple-touch-icon.png` 180x180 (original image is resized to 140x140 and 20px padding transparent padding is added on each side; rationale is given in the article)

Additionally, a sample `manifest.webmanifest` file is produced which shows how favicons for Android devices are supposed to be included.

Besides that, PNG output is optimized by `sharp` (which uses `pngquant`) and SVG output is optimized by [SVGO](https://github.com/svg/svgo).
Also, color palette is reduced to 64 colors by default in order to reduce assets’ size.

You can tweak the following settings by providing additional commands:
- output directory by setting `-o` option (`__favicon__` by default)
- icon prefix (`favicon` by default)
- colors palette size by providing `--colors` followed by a number between 2 and 256
- producing 16x16 .ico file by providing `--include16` flag

The tool can also be used as an API:
```js
const { produceIcons } = require("favgen")
const inputFilePath = "favicon.svg"
const outputDirPath = "__favicons__"
const prefix = "blueberry"
const paletteSize = 64
const include16 = true
produceIcons(inputFilePath, outputDirPath, prefix, paletteSize, include16)
```
