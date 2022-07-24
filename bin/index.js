const path = require("path");
const { Command, Option, InvalidArgumentError } = require("commander");
const PKG = require("../package.json");
const produceIcons = require("../lib/generator").default;

const CWD = process.cwd();

const program = new Command();

program.name(PKG.name).description(PKG.description).version(PKG.version);

program
  .description("Produce a set of favicons from a single input file.")
  .argument("<inputPath>", "Input icon path")
  .addOption(
    new Option("-o, --output <path>", "Output directory path").default(
      path.join(CWD, "__favicons__"),
      "__favicons__",
    ),
  )
  .option("--prefix <name>", "Icon prefix", "favicon")
  .option("--colors <number>", "Color paleete size, between 2 and 256", 64)
  .option("--include16", "Produce 16x16 .ico file", false)
  .action((filepath, { output: outputDir, prefix, colors, include16 }) => {
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
    produceIcons(inputPath, outputPath, prefix, colorsPaletteSize, include16);
  });

program.parse();
