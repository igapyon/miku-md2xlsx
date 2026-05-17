import { extractText } from "./markdown-parser.ts";
import { blockToRows, blankRow } from "./markdown-blocks.ts";
import { computeColumnHints } from "./column-hints.ts";
import type { Md2XlsxOptions, RowModel, SheetModel } from "./types.ts";

interface SheetBuildOptions {
  headerRow: boolean;
  tableStyle: NonNullable<Md2XlsxOptions["tableStyle"]>;
  sheetMode: Md2XlsxOptions["sheetMode"];
  sheetHeadingDepth: NonNullable<Md2XlsxOptions["sheetHeadingDepth"]>;
  title?: string;
}

export function buildSheets(tree: any, options: SheetBuildOptions): SheetModel[] {
  if (options.sheetMode !== "heading") {
    const name = options.title ?? "Sheet1";
    const rows: RowModel[] = [];
    for (const child of tree.children ?? []) {
      appendBlockRows(rows, child, options);
    }
    return [finalizeSheet({ name: sanitizeSheetName(name), rows })];
  }

  const usedNames = new Set<string>();
  const sheets: SheetModel[] = [];
  let current: SheetModel = { name: uniqueSheetName(options.title ?? "Sheet1", usedNames), rows: [] };
  const prefaceRows: RowModel[] = [];
  let hasSplit = false;

  for (const child of tree.children ?? []) {
    const rows = blockToRows(child, options);
    if (child.type === "heading" && child.depth === options.sheetHeadingDepth) {
      if (hasSplit && current.rows.length) {
        sheets.push(finalizeSheet(current));
      }
      current = { name: uniqueSheetName(extractText(child), usedNames), rows: hasSplit ? [] : [...prefaceRows] };
      current.rows.push(...rows);
      hasSplit = true;
      continue;
    }
    if (hasSplit) {
      appendRows(current.rows, child, rows);
    } else {
      appendRows(prefaceRows, child, rows);
    }
  }
  if (hasSplit && (current.rows.length || sheets.length === 0)) {
    sheets.push(finalizeSheet(current));
  } else if (!hasSplit) {
    sheets.push(finalizeSheet({ ...current, rows: prefaceRows }));
  }
  return sheets;
}

function appendBlockRows(rows: RowModel[], child: any, options: SheetBuildOptions): void {
  appendRows(rows, child, blockToRows(child, options));
}

function appendRows(target: RowModel[], child: any, rows: RowModel[]): void {
  if (child.type === "heading" && shouldInsertBlankBeforeHeading(target)) {
    target.push(blankRow());
  }
  target.push(...rows);
}

function shouldInsertBlankBeforeHeading(rows: RowModel[]): boolean {
  if (!rows.length) {
    return false;
  }
  const previous = rows[rows.length - 1];
  return previous.kind !== "blank" && previous.kind !== "heading" && previous.kind !== "title";
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

function finalizeSheet(sheet: SheetModel): SheetModel {
  const rows = sheet.rows.length ? sheet.rows : [blankRow()];
  return {
    ...sheet,
    rows,
    columnHints: computeColumnHints(rows)
  };
}
