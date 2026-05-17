import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const xlsx2mdDir = path.join(rootDir, "workplace", "miku-xlsx2md");
const outputDir = path.join(rootDir, "tests", "fixtures", "from-xlsx2md");
const tempDir = path.join(rootDir, "workplace", "generated-fixtures");

const markdownFixtures = [
  {
    input: "tests/fixtures/xlsx2md-basic-sample01.xlsx",
    output: "xlsx2md-basic-sample01.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample01.xlsx",
    output: "table-basic-sample01.md"
  },
  {
    input: "tests/fixtures/rich/rich-markdown-escape-sample01.xlsx",
    output: "rich-markdown-escape-sample01.md"
  }
];

const imageFixture = {
  input: "tests/fixtures/image/image-basic-sample01.xlsx",
  output: "image-basic-sample01.md",
  zip: "image-basic-sample01-xlsx2md.zip"
};

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function readUint16(data, offset) {
  return data[offset] | (data[offset + 1] << 8);
}

function readUint32(data, offset) {
  return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
}

function unzipStoredEntries(data) {
  const decoder = new TextDecoder();
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= data.length && readUint32(data, offset) === 0x04034b50) {
    const method = readUint16(data, offset + 8);
    const compressedSize = readUint32(data, offset + 18);
    const fileNameLength = readUint16(data, offset + 26);
    const extraLength = readUint16(data, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = decoder.decode(data.slice(nameStart, nameStart + fileNameLength));
    if (method !== 0) {
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }
    entries.set(name, data.slice(dataStart, dataStart + compressedSize));
    offset = dataStart + compressedSize;
  }
  return entries;
}

async function writeAssetEntries(zipPath) {
  const entries = unzipStoredEntries(await readFile(zipPath));
  for (const [name, data] of entries) {
    if (!name.startsWith("output/assets/")) {
      continue;
    }
    const relativeName = name.replace(/^output\//, "");
    const target = path.join(outputDir, relativeName);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }
}

if (!existsSync(path.join(xlsx2mdDir, "package.json"))) {
  throw new Error("workplace/miku-xlsx2md is required. Clone igapyon/miku-xlsx2md into workplace first.");
}

await mkdir(outputDir, { recursive: true });
await mkdir(tempDir, { recursive: true });

run("npm", ["run", "build:core"], xlsx2mdDir);

for (const fixture of markdownFixtures) {
  run(process.execPath, [
    "scripts/miku-xlsx2md-cli.mjs",
    fixture.input,
    "--out",
    path.join(outputDir, fixture.output)
  ], xlsx2mdDir);
}

const imageZipPath = path.join(tempDir, imageFixture.zip);
run(process.execPath, [
  "scripts/miku-xlsx2md-cli.mjs",
  imageFixture.input,
  "--out",
  path.join(outputDir, imageFixture.output),
  "--zip",
  imageZipPath
], xlsx2mdDir);
await writeAssetEntries(imageZipPath);
