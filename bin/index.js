#!/usr/bin/env node

const path = require("path");
const { Command, InvalidArgumentError } = require("commander");
const PKG = require("../package.json");
const { produceIcons } = require("../lib");

const CWD = process.cwd();

const program = new Command();

program.name(PKG.name).description(PKG.description).version(PKG.version);

program
  .description("Produce a set of favicons from a single input file.")
  .argument("<inputPath>", "Input icon path")
  .option("-o, --output <path>", "Output directory path", "__favicons__")
  .option("--colors <number>", "Color paleete size, between 2 and 256", 64)
  .action(async (filepath, { output: outputDir, colors }) => {
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

    const inputPath = path.isAbsolute(filepath)
      ? filepath
      : path.join(CWD, filepath);
    const outputPath = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(CWD, outputDir);
    await produceIcons(inputPath, outputPath, colorsPaletteSize);
  });

program.parse();
