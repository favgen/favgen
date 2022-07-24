const path = require("path");
const { Command, Option, InvalidArgumentError } = require("commander");
const PKG = require("../package.json");
const produceIcons = require("../lib/generator").default;

const CWD = process.cwd();

const program = new Command();

program.name(PKG.name).description(PKG.description).version(PKG.version);

program
  .description("Produce a set of favicons from SVG input")
  .argument("<inputPath>", "SVG icon path")
  .addOption(
    new Option("-o, --output <path>", "Output directory path").default(
      path.join(CWD, "__favicons__"),
      "__favicons__",
    ),
  )
  .option("--colors <number>", "Color paleete size, between 2 and 256", 64)
  .action((filepath, { output: outputDir, colors }) => {
    const colorsPaletteSize = parseInt(colors, 10);
    const isValidPaletteSize =
      Number.isNaN(colorsPaletteSize) ||
      colorsPaletteSize < 2 ||
      colorsPaletteSize > 256;
    if (isValidPaletteSize) {
      throw new InvalidArgumentError(
        "Color palette size must be a number between 2 and 256.",
      );
    }

    const inputPath = path.join(CWD, filepath);
    const outputPath = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(CWD, outputDir);
    produceIcons(inputPath, outputPath, colorsPaletteSize);
  });

program.parse();
