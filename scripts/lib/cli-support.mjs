import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import { md2xlsx } from "../../dist/core.js";
import packageJson from "../../package.json" with { type: "json" };

const usage = `Usage:
  npm run cli -- <input.md> --out <output.xlsx> [options]

Options:
  --out <file>              Output .xlsx path
  --sheet-mode <mode>       single or heading (default: single)
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
  const workbook = md2xlsx(markdown, options);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, workbook);
}
