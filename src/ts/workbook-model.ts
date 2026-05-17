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

function tableRows(node: any, headerRow: boolean, tableStyle: Md2XlsxOptions["tableStyle"]): RowModel[] {
  return (node.children ?? []).map((row: any, rowIndex: number) => ({
    kind: "table",
    cells: (row.children ?? []).map((cell: any) => ({
      value: extractText(cell).trim(),
      styleRole: headerRow && rowIndex === 0 ? "tableHeader" : tableStyle === "plain" ? "normal" : "tableCell"
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

  if (options.sheetMode !== "heading") {
    const name = options.title ?? "Sheet1";
    const rows = (tree.children ?? []).flatMap((child: any) => blockToRows(child, { headerRow, tableStyle }));
    return { sheets: [finalizeSheet({ name: sanitizeSheetName(name), rows })], imageAssets: options.imageAssets };
  }

  const usedNames = new Set<string>();
  const sheets: SheetModel[] = [];
  let current: SheetModel = { name: uniqueSheetName(options.title ?? "Sheet1", usedNames), rows: [] };

  for (const child of tree.children ?? []) {
    if (child.type === "heading" && (child.depth === 1 || child.depth === 2)) {
      if (current.rows.length) {
        sheets.push(finalizeSheet(current));
      }
      current = { name: uniqueSheetName(extractText(child), usedNames), rows: [] };
      current.rows.push(...blockToRows(child, { headerRow, tableStyle }));
      continue;
    }
    current.rows.push(...blockToRows(child, { headerRow, tableStyle }));
  }
  if (current.rows.length || sheets.length === 0) {
    sheets.push(finalizeSheet(current));
  }
  return { sheets, imageAssets: options.imageAssets };
}
