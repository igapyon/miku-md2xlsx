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
    input: "tests/fixtures/chart/chart-basic-sample01.xlsx",
    output: "chart-basic-sample01.md",
    zip: "chart-basic-sample01-xlsx2md.zip"
  },
  {
    input: "tests/fixtures/chart/chart-mixed-sample01.xlsx",
    output: "chart-mixed-sample01.md",
    zip: "chart-mixed-sample01-xlsx2md.zip"
  },
  {
    input: "tests/fixtures/display/display-format-sample01.xlsx",
    output: "display-format-sample01.md"
  },
  {
    input: "tests/fixtures/edge/edge-empty-sample01.xlsx",
    output: "edge-empty-sample01.md"
  },
  {
    input: "tests/fixtures/edge/edge-weird-sheetname-sample01.xlsx",
    output: "edge-weird-sheetname-sample01.md"
  },
  {
    input: "tests/fixtures/formula/formula-basic-sample01.xlsx",
    output: "formula-basic-sample01.md"
  },
  {
    input: "tests/fixtures/formula/formula-crosssheet-sample01.xlsx",
    output: "formula-crosssheet-sample01.md"
  },
  {
    input: "tests/fixtures/formula/formula-shared-sample01.xlsx",
    output: "formula-shared-sample01.md"
  },
  {
    input: "tests/fixtures/formula/formula-spill-sample01.xlsx",
    output: "formula-spill-sample01.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample01.xlsx",
    output: "table-basic-sample01.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample02.xlsx",
    output: "table-basic-sample02.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample03.xlsx",
    output: "table-basic-sample03.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample11.xlsx",
    output: "table-basic-sample11.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample12.xlsx",
    output: "table-basic-sample12.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample13.xlsx",
    output: "table-basic-sample13.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample14.xlsx",
    output: "table-basic-sample14.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample15.xlsx",
    output: "table-basic-sample15.md"
  },
  {
    input: "tests/fixtures/table/table-basic-sample16.xlsx",
    output: "table-basic-sample16.md"
  },
  {
    input: "tests/fixtures/table/table-border-priority-sample01.xlsx",
    output: "table-border-priority-sample01.md"
  },
  {
    input: "tests/fixtures/table/grid-layout-sample-01.xlsx",
    output: "grid-layout-sample-01.md"
  },
  {
    input: "tests/fixtures/rich/rich-markdown-escape-sample01.xlsx",
    output: "rich-markdown-escape-sample01.md"
  },
  {
    input: "tests/fixtures/narrative/narrative-vs-table-sample01.xlsx",
    output: "narrative-vs-table-sample01.md"
  },
  {
    input: "tests/fixtures/link/hyperlink-basic-sample01.xlsx",
    output: "hyperlink-basic-sample01.md"
  },
  {
    input: "tests/fixtures/merge/merge-multiline-sample01.xlsx",
    output: "merge-multiline-sample01.md"
  },
  {
    input: "tests/fixtures/merge/merge-pattern-sample01.xlsx",
    output: "merge-pattern-sample01.md"
  },
  {
    input: "tests/fixtures/rich/rich-text-github-sample01.xlsx",
    output: "rich-text-github-sample01.md"
  },
  {
    input: "tests/fixtures/rich/rich-usecase-sample01.xlsx",
    output: "rich-usecase-sample01.md"
  },
  {
    input: "tests/fixtures/named-range/named-range-sample01.xlsx",
    output: "named-range-sample01.md"
  },
  {
    input: "tests/fixtures/shape/shape-basic-sample01.xlsx",
    output: "shape-basic-sample01.md",
    zip: "shape-basic-sample01-xlsx2md.zip"
  },
  {
    input: "tests/fixtures/shape/shape-block-arrow-sample01.xlsx",
    output: "shape-block-arrow-sample01.md",
    zip: "shape-block-arrow-sample01-xlsx2md.zip"
  },
  {
    input: "tests/fixtures/shape/shape-callout-sample01.xlsx",
    output: "shape-callout-sample01.md",
    zip: "shape-callout-sample01-xlsx2md.zip"
  },
  {
    input: "tests/fixtures/shape/shape-flowchart-sample01.xlsx",
    output: "shape-flowchart-sample01.md",
    zip: "shape-flowchart-sample01-xlsx2md.zip"
  }
];

const imageFixtures = [
  {
    input: "tests/fixtures/image/image-basic-sample01.xlsx",
    output: "image-basic-sample01.md",
    zip: "image-basic-sample01-xlsx2md.zip"
  },
  {
    input: "tests/fixtures/image/image-basic-sample02.xlsx",
    output: "image-basic-sample02/image-basic-sample02.md",
    zip: "image-basic-sample02-xlsx2md.zip"
  }
];

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

async function writeAssetEntries(zipPath, fixtureDir) {
  const entries = unzipStoredEntries(await readFile(zipPath));
  for (const [name, data] of entries) {
    if (!name.startsWith("output/assets/")) {
      continue;
    }
    const relativeName = name.replace(/^output\//, "");
    const target = path.join(fixtureDir, relativeName);
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
  const target = path.join(outputDir, fixture.output);
  await mkdir(path.dirname(target), { recursive: true });
  const args = [
    "scripts/miku-xlsx2md-cli.mjs",
    fixture.input,
    "--out",
    target
  ];
  if (fixture.zip) {
    const zipPath = path.join(tempDir, fixture.zip);
    args.push("--zip", zipPath);
    run(process.execPath, args, xlsx2mdDir);
    await writeAssetEntries(zipPath, path.dirname(target));
  } else {
    run(process.execPath, args, xlsx2mdDir);
  }
}

for (const fixture of imageFixtures) {
  const target = path.join(outputDir, fixture.output);
  const fixtureDir = path.dirname(target);
  const imageZipPath = path.join(tempDir, fixture.zip);
  await mkdir(fixtureDir, { recursive: true });
  run(process.execPath, [
    "scripts/miku-xlsx2md-cli.mjs",
    fixture.input,
    "--out",
    target,
    "--zip",
    imageZipPath
  ], xlsx2mdDir);
  await writeAssetEntries(imageZipPath, fixtureDir);
}
