import { collectImageRefs, extractText, parseMarkdown } from "./markdown-parser.ts";
import type { Md2XlsxOptions, RowModel, SheetModel, WorkbookModel } from "./types.ts";

function blankRow(): RowModel {
  return { kind: "blank", cells: [{ value: "" }] };
}

function textRow(kind: RowModel["kind"], value: string, styleRole: RowModel["cells"][number]["styleRole"] = "normal"): RowModel {
  return { kind, cells: [{ value, styleRole }] };
}

function imageRow(value: string, imageRefs: RowModel["imageRefs"]): RowModel {
  return { kind: "image", cells: [{ value, styleRole: "normal" }], imageRefs };
}

function listItemText(item: any): string {
  const parts: string[] = [];
  for (const child of item.children ?? []) {
    if (child.type === "paragraph") {
      parts.push(extractText(child).trim());
    }
  }
  return parts.filter(Boolean).join(" ");
}

function appendListRows(rows: RowModel[], node: any, depth = 0): void {
  const ordered = Boolean(node.ordered);
  let index = Number(node.start ?? 1);
  for (const item of node.children ?? []) {
    const marker = ordered ? `${index}.` : "-";
    const indent = "  ".repeat(depth);
    const text = listItemText(item);
    if (text) {
      rows.push(textRow("list", `${indent}${marker} ${text}`));
    }
    for (const child of item.children ?? []) {
      if (child.type === "list") {
        appendListRows(rows, child, depth + 1);
      }
    }
    index += 1;
  }
}

function styleRoleForTableCell(rowIndex: number, headerRow: boolean, tableStyle: Md2XlsxOptions["tableStyle"]): RowModel["cells"][number]["styleRole"] {
  return headerRow && rowIndex === 0 ? "tableHeader" : tableStyle === "plain" ? "normal" : "tableCell";
}

function repairEscapedPipeCells(values: string[], expectedColumns: number): string[] {
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

function tableRows(node: any, headerRow: boolean, tableStyle: Md2XlsxOptions["tableStyle"]): RowModel[] {
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

function paragraphTableRows(text: string, headerRow: boolean, tableStyle: Md2XlsxOptions["tableStyle"]): RowModel[] | undefined {
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

function blockToRows(node: any, options: Required<Pick<Md2XlsxOptions, "headerRow" | "tableStyle">>): RowModel[] {
  switch (node.type) {
    case "heading":
      return [textRow(node.depth === 1 ? "title" : "heading", extractText(node).trim(), node.depth === 1 ? "title" : "heading")];
    case "paragraph": {
      const text = extractText(node).trim();
      if (!text) {
        return [];
      }
      const table = paragraphTableRows(text, options.headerRow, options.tableStyle);
      if (table) {
        return table;
      }
      const imageRefs = collectImageRefs(node);
      return imageRefs.length ? [imageRow(text, imageRefs)] : [textRow("paragraph", text)];
    }
    case "list": {
      const rows: RowModel[] = [];
      appendListRows(rows, node);
      return rows;
    }
    case "table":
      return tableRows(node, options.headerRow, options.tableStyle);
    case "code":
      return [textRow("code", String(node.value ?? ""), "code")];
    case "thematicBreak":
      return [textRow("separator", "", "separator")];
    default:
      return [];
  }
}

function sanitizeSheetName(name: string): string {
  const sanitized = name.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
  return (sanitized || "Sheet").slice(0, 31);
}

function uniqueSheetName(base: string, used: Set<string>): string {
  const clean = sanitizeSheetName(base);
  let candidate = clean;
  let suffix = 2;
  while (used.has(candidate)) {
    const tail = ` ${suffix}`;
    candidate = `${clean.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function computeColumnHints(rows: RowModel[]): number[] {
  const hints: number[] = [];
  for (const row of rows) {
    row.cells.forEach((cell, index) => {
      const width = Math.min(Math.max([...cell.value].length + 2, 10), 48);
      hints[index] = Math.max(hints[index] ?? 0, width);
    });
  }
  return hints.length ? hints : [16];
}

function finalizeSheet(sheet: SheetModel): SheetModel {
  return {
    ...sheet,
    rows: sheet.rows.length ? sheet.rows : [blankRow()],
    columnHints: computeColumnHints(sheet.rows)
  };
}

export function markdownToWorkbook(markdown: string, options: Md2XlsxOptions = {}): WorkbookModel {
  const tree = parseMarkdown(markdown);
  const headerRow = options.headerRow ?? true;
  const tableStyle = options.tableStyle ?? "bordered";
  const sheetHeadingDepth = options.sheetHeadingDepth ?? 1;

  if (options.sheetMode !== "heading") {
    const name = options.title ?? "Sheet1";
    const rows = (tree.children ?? []).flatMap((child: any) => blockToRows(child, { headerRow, tableStyle }));
    return { sheets: [finalizeSheet({ name: sanitizeSheetName(name), rows })], imageAssets: options.imageAssets };
  }

  const usedNames = new Set<string>();
  const sheets: SheetModel[] = [];
  let current: SheetModel = { name: uniqueSheetName(options.title ?? "Sheet1", usedNames), rows: [] };
  const prefaceRows: RowModel[] = [];
  let hasSplit = false;

  for (const child of tree.children ?? []) {
    const rows = blockToRows(child, { headerRow, tableStyle });
    if (child.type === "heading" && child.depth === sheetHeadingDepth) {
      if (hasSplit && current.rows.length) {
        sheets.push(finalizeSheet(current));
      }
      current = { name: uniqueSheetName(extractText(child), usedNames), rows: hasSplit ? [] : [...prefaceRows] };
      current.rows.push(...rows);
      hasSplit = true;
      continue;
    }
    if (hasSplit) {
      current.rows.push(...rows);
    } else {
      prefaceRows.push(...rows);
    }
  }
  if (hasSplit && (current.rows.length || sheets.length === 0)) {
    sheets.push(finalizeSheet(current));
  } else if (!hasSplit) {
    sheets.push(finalizeSheet({ ...current, rows: prefaceRows }));
  }
  return { sheets, imageAssets: options.imageAssets };
}
