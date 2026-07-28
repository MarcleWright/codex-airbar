const fs = require("node:fs");
const path = require("node:path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const root = path.join(__dirname, "..");
const sourceDir = path.join(root, "src");
const outputDir = path.join(root, ".protected-src");
const coreFiles = ["main.js", "preload.js", "status-reader.js", "codex-cli.js", "session-recovery.js"];

const options = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.45,
  deadCodeInjection: false,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const fileName of coreFiles) {
  const inputPath = path.join(sourceDir, fileName);
  const outputPath = path.join(outputDir, fileName);
  const source = fs.readFileSync(inputPath, "utf8");
  const result = JavaScriptObfuscator.obfuscate(source, options);
  fs.writeFileSync(outputPath, `${result.getObfuscatedCode()}\n`, "utf8");
}

console.log(`Protected ${coreFiles.length} core files into ${path.relative(root, outputDir)}.`);
