const path = require("path");
const { Command, Option } = require("commander");
const PKG = require("../package.json");
const produceIcons = require("../lib/generator").default;

const CWD = process.cwd();

const program = new Command();

program.name(PKG.name).description(PKG.description).version(PKG.version);

program
  .description("Produce a set of favicons from SVG input")
  .argument("<inputPath>", "SVG icon path")
  .addOption(
    new Option("-o, --output <outputPath>", "Output directory path").default(
      path.join(CWD, "__favicons__"),
      "__favicons__",
    ),
  )
  .action((filepath, { output: outputDir }) => {
    const inputPath = path.join(CWD, filepath);
    const outputPath = path.isAbsolute(outputDir)
      ? outputDir
      : path.join(CWD, outputDir);
    produceIcons(inputPath, outputPath);
  });

program.parse();
