const path = require("path");
const { Command } = require("commander");
const PKG = require("../package.json");
const produceIcons = require("../lib/generator").default;

const CWD = process.cwd();

const program = new Command();

program.name(PKG.name).description(PKG.description).version(PKG.version);

program
  .description("Produce a set of favicons from SVG input")
  .argument("<inputPath>", "SVG icon path")
  .option(
    "-o, --output <outputPath>",
    "Output directory path",
    path.join(CWD, "__favicons__"),
  )
  .action((filepath, { output: outputDir }) => {
    const inputPath = path.join(CWD, filepath);
    const outputPath = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(CWD, outputDir);
    produceIcons(inputPath, outputPath);
  });

program.parse();
