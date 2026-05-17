import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const bundleDir = path.resolve(rootDir, "bundle");
const productName = "miku-md2xlsx";
const sourceArchiveCandidates = [
  ".gitignore",
  "LICENSE",
  "README.md",
  "TODO.md",
  "docs",
  "package-lock.json",
  "package.json",
  "scripts",
  "src",
  "tests",
  "tsconfig.json",
  "vitest.config.ts"
];

async function pathExists(relPath) {
  try {
    await fs.access(path.resolve(rootDir, relPath));
    return true;
  } catch {
    return false;
  }
}

async function createSourceArchive(outputPath) {
  const sources = [];
  for (const relPath of sourceArchiveCandidates) {
    if (await pathExists(relPath)) {
      sources.push(relPath);
    }
  }
  await execFileAsync("tar", ["-czf", outputPath, ...sources], { cwd: rootDir });
}

async function main() {
  await fs.mkdir(bundleDir, { recursive: true });
  const outputPath = path.resolve(bundleDir, `${productName}.mjs`);
  const sourcesPath = path.resolve(bundleDir, `${productName}-sources.tgz`);

  await build({
    entryPoints: ["src/ts/core.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    outfile: path.resolve(rootDir, "dist/core.js"),
    sourcemap: false
  });

  await build({
    entryPoints: ["scripts/miku-md2xlsx-cli.mjs"],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    outfile: outputPath
  });
  await fs.chmod(outputPath, 0o755);
  await createSourceArchive(sourcesPath);

  console.log("[build:bundle] generated dist/core.js");
  console.log(`[build:bundle] generated ${path.relative(rootDir, outputPath)}`);
  console.log(`[build:bundle] generated ${path.relative(rootDir, sourcesPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
