import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { markdownToXlsxModel, md2xlsx } from "../../dist/core.js";
import packageJson from "../../package.json" with { type: "json" };

const usage = `Usage:
  npm run cli -- <input.md> --out <output.xlsx> [options]

Options:
  --out <file>              Output .xlsx path
  --sheet-mode <mode>       single or heading (default: single)
  --sheet-heading-depth <n> Heading depth for sheet splits: 1 or 2 (default: 1)
  --title <value>           Workbook title or first sheet name
  --table-style <mode>      plain or bordered (default: bordered)
  --no-header-row           Do not style first Markdown table row as a header
  --help                    Show this help
  --version                 Show version
`;

function readOption(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function isLocalRelativeImagePath(value) {
  return !isAbsolute(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("//");
}

function contentTypeForPath(value) {
  const lower = value.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  return "image/png";
}

function readSheetHeadingDepth(value) {
  if (value !== "1" && value !== "2") {
    throw new Error("--sheet-heading-depth must be 1 or 2.");
  }
  return Number(value);
}

async function collectImageAssets(markdown, inputPath) {
  const inputDir = dirname(resolve(inputPath));
  const model = markdownToXlsxModel(markdown);
  const paths = model.sheets.flatMap((sheet) => sheet.rows.flatMap((row) => (row.imageRefs ?? []).map((ref) => ref.path)));
  const uniquePaths = Array.from(new Set(paths)).filter(isLocalRelativeImagePath);
  const assets = [];
  for (const imagePath of uniquePaths) {
    try {
      assets.push({
        path: imagePath,
        data: await readFile(resolve(inputDir, imagePath)),
        contentType: contentTypeForPath(imagePath)
      });
    } catch {
      // Missing assets are kept as text references. Embedding is best-effort.
    }
  }
  return assets;
}

export async function main(args) {
  if (args.includes("--help") || args.length === 0) {
    process.stdout.write(usage);
    return;
  }
  if (args.includes("--version")) {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  let input = "";
  let out = "";
  const options = {
    sheetMode: "single",
    sheetHeadingDepth: 1,
    tableStyle: "bordered",
    headerRow: true
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out") {
      out = readOption(args, i, arg);
      i += 1;
    } else if (arg === "--sheet-mode") {
      options.sheetMode = readOption(args, i, arg);
      i += 1;
    } else if (arg === "--sheet-heading-depth") {
      options.sheetHeadingDepth = readSheetHeadingDepth(readOption(args, i, arg));
      i += 1;
    } else if (arg === "--title") {
      options.title = readOption(args, i, arg);
      i += 1;
    } else if (arg === "--table-style") {
      options.tableStyle = readOption(args, i, arg);
      i += 1;
    } else if (arg === "--no-header-row") {
      options.headerRow = false;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!input) {
      input = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!input) {
    throw new Error("Input Markdown file is required.");
  }
  if (!out) {
    throw new Error("--out <file> is required.");
  }

  const markdown = await readFile(input, "utf8");
  options.imageAssets = await collectImageAssets(markdown, input);
  const workbook = md2xlsx(markdown, options);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, workbook);
}
