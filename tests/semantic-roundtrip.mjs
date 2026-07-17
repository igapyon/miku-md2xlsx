import { mkdtemp, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const xlsx2mdDir = path.join(rootDir, "workplace", "miku-xlsx2md");
const tempDir = await mkdtemp(path.join(tmpdir(), "miku-md2xlsx-semantic-roundtrip-"));

process.stdout.write(`[semantic-roundtrip] output directory: ${tempDir}\n`);

const cases = [
  {
    name: "basic",
    fixture: "xlsx2md-basic-sample01.md",
    tokens: ["Table: 001", "項番", "登録日", "何かの登録日"]
  },
  {
    name: "dense-table",
    fixture: "table-basic-sample13.md",
    tokens: ["Table: 001", "Table: 004", "方眼紙風のためにセル結合が多用されます", "Sabro"]
  },
  {
    name: "display-format",
    fixture: "display-format-sample01.md",
    tokens: ["¥1,024,768", "98.7%", "令和8年3月17日"]
  },
  {
    name: "formula",
    fixture: "formula-basic-sample01.md",
    tokens: ["基本数式サンプル", "arith", "15", "OK", "2024/3/17"]
  },
  {
    name: "formula-crosssheet",
    fixture: "formula-crosssheet-sample01.md",
    tokens: ["複数シート参照サンプル", "CrossValue", "日本語参照値", "sum_range", "10"]
  },
  {
    name: "hyperlink",
    fixture: "hyperlink-basic-sample01.md",
    tokens: ["[Open example](https://example.com/)", "Jump to Other", "Other!A1"]
  },
  {
    name: "named-range",
    fixture: "named-range-sample01.md",
    tokens: ["definedNames サンプル", "BaseName元", "BaseRange1", "30", "CrossRef CrossRef"]
  },
  {
    name: "rich-usecase",
    fixture: "rich-usecase-sample01.md",
    tokens: [
      "[Apple](https://www.apple.com/)",
      "[Google](https://www.google.com/)",
      "Apple の製品が<ins>購入できます</ins>。",
      "実店舗とともに<br>ネットショップでもお世話になっています。",
      "トルツメ: この部分は文面から外すことを提案。"
    ]
  },
  {
    name: "merge",
    fixture: "merge-pattern-sample01.md",
    tokens: ["[←M←]", "[↑M↑]", "※横結合のサンプルです", "※2x2結合のサンプルです"]
  },
  {
    name: "shape-flowchart",
    fixture: "shape-flowchart-sample01.md",
    tokens: ["フローチャート図形サンプル", "Table: 001", "値A", "2026年", "32,012"]
  },
  {
    name: "chart",
    fixture: "chart-basic-sample01.md",
    tokens: ["Chart: 001", "Title: 棒グラフのグラフ", "Type: Bar Chart", "categories: 'chart-basic'!$B$4:$B$7"]
  },
  {
    name: "image",
    fixture: "image-basic-sample01.md",
    tokens: ["Image: 001", "File: assets/image/image_001.png", "![image_001.png](assets/image/image_001.png)"]
  },
  {
    name: "image-chart",
    fixture: "image-basic-sample02/image-basic-sample02.md",
    tokens: [
      "Chart: 001",
      "Title: このグラフのタイトル",
      "Type: Line Chart",
      "Image: 001",
      "File: assets/image/image_001.png",
      "![image_001.png](assets/image/image_001.png)"
    ]
  }
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
}

function normalizeMarkdown(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\\([\\`*{}[\]()#+\-.!_|~$])/g, "$1")
    .replace(/\*\*\*|\*\*|\*|~~/g, "")
    .replace(/\r\n/g, "\n");
}

function assertContainsAll(source, tokens, label) {
  const normalized = normalizeMarkdown(source);
  const missing = tokens.filter((token) => !normalized.includes(token));
  if (missing.length) {
    throw new Error(`${label} is missing semantic token(s): ${missing.join(", ")}`);
  }
}

function sheetNames(value) {
  return Array.from(value.matchAll(/^## Sheet:\s*(.+)$/gm), (match) => match[1].trim());
}

function tableAnchors(value) {
  let currentSheet = "";
  const anchors = new Set();
  for (const line of value.split(/\r?\n/)) {
    const sheet = line.match(/^## Sheet:\s*(.+)$/);
    if (sheet) {
      currentSheet = sheet[1].trim();
      continue;
    }
    const table = line.match(/^### Table:\s*\d+\s*\(([A-Z]+\d+-[A-Z]+\d+)\)\s*$/i);
    if (table) {
      anchors.add(`${currentSheet}:${table[1].toUpperCase()}`);
    }
  }
  return Array.from(anchors).sort();
}

function assertEqualStructure(original, returned, label) {
  const originalSheets = sheetNames(original);
  const returnedSheets = sheetNames(returned);
  if (JSON.stringify(returnedSheets) !== JSON.stringify(originalSheets)) {
    throw new Error(`${label} sheet names differ: expected ${JSON.stringify(originalSheets)}, received ${JSON.stringify(returnedSheets)}`);
  }
  const originalTables = tableAnchors(original);
  const returnedTables = tableAnchors(returned);
  if (JSON.stringify(returnedTables) !== JSON.stringify(originalTables)) {
    throw new Error(`${label} table anchors differ: expected ${JSON.stringify(originalTables)}, received ${JSON.stringify(returnedTables)}`);
  }
}

if (!existsSync(path.join(xlsx2mdDir, "package.json"))) {
  throw new Error("workplace/miku-xlsx2md is required for semantic round-trip checks.");
}

run("npm", ["run", "build:core"], { cwd: xlsx2mdDir });

for (const testCase of cases) {
  const fixturePath = path.join(rootDir, "tests", "fixtures", "from-xlsx2md", testCase.fixture);
  const xlsxPath = path.join(tempDir, `${testCase.name}.xlsx`);
  const returnedMarkdownPath = path.join(tempDir, `${testCase.name}.returned.md`);
  const returnedZipPath = path.join(tempDir, `${testCase.name}.returned.zip`);

  const originalMarkdown = await readFile(fixturePath, "utf8");
  assertContainsAll(originalMarkdown, testCase.tokens, `${testCase.fixture} original Markdown`);

  run(process.execPath, [
    "scripts/miku-md2xlsx-cli.mjs",
    fixturePath,
    "--out",
    xlsxPath,
    "--input-dialect",
    "miku-xlsx2md"
  ]);

  run(process.execPath, [
    "scripts/miku-xlsx2md-cli.mjs",
    xlsxPath,
    "--out",
    returnedMarkdownPath,
    "--zip",
    returnedZipPath
  ], { cwd: xlsx2mdDir });

  const returnedMarkdown = await readFile(returnedMarkdownPath, "utf8");
  assertContainsAll(returnedMarkdown, testCase.tokens, `${testCase.fixture} returned Markdown`);
  assertEqualStructure(originalMarkdown, returnedMarkdown, `${testCase.fixture} semantic structure`);
  process.stdout.write(`[semantic-roundtrip] ${testCase.fixture}\n`);
  process.stdout.write(`  xlsx: ${xlsxPath}\n`);
  process.stdout.write(`  returned md: ${returnedMarkdownPath}\n`);
  process.stdout.write(`  returned zip: ${returnedZipPath}\n`);
}

process.stdout.write(`[semantic-roundtrip] ${cases.length} fixture(s) passed\n`);
