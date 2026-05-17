import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import packageJson from "../package.json" with { type: "json" };

const execFileAsync = promisify(execFile);
const bundlePath = "bundle/miku-md2xlsx.mjs";

async function runBundle(args) {
  return execFileAsync(process.execPath, [bundlePath, ...args], {
    encoding: "utf8"
  });
}

async function main() {
  const version = await runBundle(["--version"]);
  if (version.stdout.trim() !== packageJson.version) {
    throw new Error(`Unexpected bundle version output: ${version.stdout}`);
  }

  const help = await runBundle(["--help"]);
  if (!help.stdout.includes("Usage:") || !help.stdout.includes("--sheet-heading-depth")) {
    throw new Error("Bundle help output did not include the expected usage text.");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "miku-md2xlsx-bundle-"));
  const inputPath = path.join(tempDir, "sample.md");
  const outputPath = path.join(tempDir, "sample.xlsx");
  await fs.writeFile(inputPath, "# Bundle Smoke\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n", "utf8");
  await runBundle([inputPath, "--out", outputPath, "--sheet-mode", "heading"]);
  const stat = await fs.stat(outputPath);
  if (stat.size < 100) {
    throw new Error("Bundle conversion smoke output XLSX was unexpectedly small.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
