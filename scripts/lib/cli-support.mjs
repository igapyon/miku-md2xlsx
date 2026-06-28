import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { markdownToXlsxModel, md2xlsx } from "../../dist/core.js";
import packageJson from "../../package.json" with { type: "json" };

const usage = `miku-md2xlsx converts a Markdown file into an Excel .xlsx workbook.
It is a local file converter: the input Markdown is read from disk and the
generated workbook is written to the --out path.

Usage:
  npm run cli -- <input.md> --out <output.xlsx> [options]
  node bundle/miku-md2xlsx.mjs <input.md> --out <output.xlsx> [options]
  npm run cli -- --version
  npm run cli -- --help

Default behavior:
  The input file is read as UTF-8 Markdown. The output workbook is written to
  --out. Parent directories for --out are created when missing.

Inputs:
  <input.md>                Input Markdown file path

Outputs:
  --out <file> is the generated Excel .xlsx workbook. Terminal stdout is only
  used for --help and --version; conversion progress is not a machine-readable
  output contract.

Generated artifacts:
  The generated workbook is safe to regenerate from the Markdown input and CLI
  options. Build commands may also generate dist/ and bundle/ artifacts.

Overwrite behavior:
  Existing --out files are overwritten.

Diagnostics / warnings:
  CLI usage errors and unexpected runtime errors are written to stderr. Missing,
  remote, and absolute image paths remain visible as workbook text references.

Exit codes:
  0  success, --help, or --version
  1  conversion or file-system failure
  2  invalid CLI usage

Options:
  --out <file>              Output .xlsx path
  --sheet-mode <mode>       single or heading (default: single)
  --sheet-heading-depth <n> Heading depth for sheet splits: 1 or 2 (default: 1)
  --title <value>           Workbook title or first sheet name
  --table-style <mode>      plain or bordered (default: bordered)
  --no-header-row           Do not style first Markdown table row as a header
  --help                    Show this help
  --version                 Show version

Examples:
  npm run cli -- ./sample.md --out ./sample.xlsx
  npm run cli -- ./sample.md --out ./sample.xlsx --sheet-mode heading
  npm run cli -- ./book.md --out ./book.xlsx --sheet-mode heading --sheet-heading-depth 2

Markdown handling notes:
  - Headings, paragraphs, lists, tables, code blocks, horizontal rules, links,
    common inline styles, and local PNG/JPEG/GIF image references are supported.
  - Table cell values are written as strings. Numeric-looking and date-like
    Markdown text is not inferred as Excel numbers or dates.
  - Relative local image references are embedded best-effort when the asset file
    exists next to the input Markdown. Missing, remote, and absolute image paths
    remain visible as text references.
  - miku-xlsx2md merge markers in table cells are treated as Excel merges:
    [←M←] extends a merge to the left, and [↑M↑] extends a merge upward.
  - A cell containing a single Markdown link is emitted as an Excel hyperlink
    when the target can be represented by Excel.

Sheet mode notes:
  - single: create one worksheet from the whole Markdown document.
  - heading: split worksheets at headings matching --sheet-heading-depth.
  - Use --sheet-heading-depth 2 for miku-xlsx2md-style Markdown where # is the
    workbook title and ## headings are worksheet names.
`;

export class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliUsageError";
    this.exitCode = 2;
  }
}

function readOption(args, index, name) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new CliUsageError(`${name} requires a value.`);
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
    throw new CliUsageError("--sheet-heading-depth must be 1 or 2.");
  }
  return Number(value);
}

function readSheetMode(value) {
  if (value !== "single" && value !== "heading") {
    throw new CliUsageError("--sheet-mode must be single or heading.");
  }
  return value;
}

function readTableStyle(value) {
  if (value !== "plain" && value !== "bordered") {
    throw new CliUsageError("--table-style must be plain or bordered.");
  }
  return value;
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
      options.sheetMode = readSheetMode(readOption(args, i, arg));
      i += 1;
    } else if (arg === "--sheet-heading-depth") {
      options.sheetHeadingDepth = readSheetHeadingDepth(readOption(args, i, arg));
      i += 1;
    } else if (arg === "--title") {
      options.title = readOption(args, i, arg);
      i += 1;
    } else if (arg === "--table-style") {
      options.tableStyle = readTableStyle(readOption(args, i, arg));
      i += 1;
    } else if (arg === "--no-header-row") {
      options.headerRow = false;
    } else if (arg.startsWith("--")) {
      throw new CliUsageError(`Unknown option: ${arg}`);
    } else if (!input) {
      input = arg;
    } else {
      throw new CliUsageError(`Unexpected argument: ${arg}`);
    }
  }

  if (!input) {
    throw new CliUsageError("Input Markdown file is required.");
  }
  if (!out) {
    throw new CliUsageError("--out <file> is required.");
  }

  const markdown = await readFile(input, "utf8");
  options.imageAssets = await collectImageAssets(markdown, input);
  const workbook = md2xlsx(markdown, options);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, workbook);
}
