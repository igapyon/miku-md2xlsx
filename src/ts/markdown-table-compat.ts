import { extractText } from "./markdown-parser.ts";
import type { Md2XlsxOptions, RowModel } from "./types.ts";

export function styleRoleForTableCell(rowIndex: number, headerRow: boolean, tableStyle: Md2XlsxOptions["tableStyle"]): RowModel["cells"][number]["styleRole"] {
  return headerRow && rowIndex === 0 ? "tableHeader" : tableStyle === "plain" ? "normal" : "tableCell";
}

export function repairEscapedPipeCells(values: string[], expectedColumns: number): string[] {
  if (expectedColumns < 1 || values.length <= expectedColumns) {
    return values;
  }
  const repaired: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    let value = values[index];
    while (value.endsWith("\\") && repaired.length + (values.length - index) > expectedColumns && index + 1 < values.length) {
      index += 1;
      value = `${value}| ${values[index].replace(/^\s+/, "")}`;
    }
    repaired.push(value);
  }
  return repaired;
}

export function tableRows(node: any, headerRow: boolean, tableStyle: Md2XlsxOptions["tableStyle"]): RowModel[] {
  const rawRows = (node.children ?? []).map((row: any) => (row.children ?? []).map((cell: any) => extractText(cell).trim()));
  const expectedColumns = rawRows[0]?.length ?? 0;
  return rawRows.map((row, rowIndex) => ({
    kind: "table",
    cells: repairEscapedPipeCells(row, expectedColumns).map((value) => ({
      value,
      styleRole: styleRoleForTableCell(rowIndex, headerRow, tableStyle)
    }))
  }));
}

export function paragraphTableRows(text: string, headerRow: boolean, tableStyle: Md2XlsxOptions["tableStyle"]): RowModel[] | undefined {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2 || !isMarkdownTableSeparator(lines[1])) {
    return undefined;
  }
  const rawRows = [lines[0], ...lines.slice(2)].map((line) => splitMarkdownTableLine(line).map(unescapeMarkdownTableCell));
  const expectedColumns = rawRows[0]?.length ?? 0;
  if (expectedColumns < 1 || rawRows.some((row) => row.length !== expectedColumns)) {
    return undefined;
  }
  return rawRows.map((row, rowIndex) => ({
    kind: "table",
    cells: row.map((value) => ({
      value,
      styleRole: styleRoleForTableCell(rowIndex, headerRow, tableStyle)
    }))
  }));
}

function splitMarkdownTableLine(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cell = "";
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "|" && trimmed[index - 1] !== "\\") {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableLine(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function unescapeMarkdownTableCell(value: string): string {
  return value.replace(/\\([\\`*{}[\]()#+\-.!_|~])/g, "$1");
}
