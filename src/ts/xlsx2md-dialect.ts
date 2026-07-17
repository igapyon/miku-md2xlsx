import { blockToRows, blankRow } from "./markdown-blocks.ts";
import { extractText } from "./markdown-parser.ts";
import { finalizeSheet, sanitizeSheetName, uniqueSheetName } from "./sheet-builder.ts";
import { styleRoleForTableCell } from "./markdown-table-compat.ts";
import {
  isBookMarker,
  looksLikeSheetMarker,
  looksLikeTableMarker,
  parseSheetMarker,
  parseTableMarker
} from "./xlsx2md-dialect-parser.ts";
import type { CellModel, Md2XlsxOptions, RowModel, SheetModel } from "./types.ts";
import type { Xlsx2mdTableRange } from "./xlsx2md-dialect-parser.ts";

interface DialectOptions {
  headerRow: boolean;
  tableStyle: NonNullable<Md2XlsxOptions["tableStyle"]>;
  title?: string;
}

export function buildXlsx2mdDialectSheets(tree: any, options: DialectOptions): SheetModel[] {
  const usedNames = new Set<string>();
  const sheets: SheetModel[] = [];
  const prefaceRows: RowModel[] = [];
  let current: SheetModel | undefined;
  let pendingTableRange: Xlsx2mdTableRange | undefined;

  for (const child of tree.children ?? []) {
    const headingText = child.type === "heading" ? extractText(child).trim() : "";
    if (pendingTableRange && child.type !== "table") {
      throw dialectSyntaxError(child, "A Table: marker must be followed immediately by a Markdown table.");
    }
    if (child.type === "heading" && child.depth === 1 && isBookMarker(headingText)) {
      continue;
    }
    if (child.type === "heading" && child.depth === 2) {
      const sheetName = parseSheetMarker(headingText);
      if (sheetName !== undefined) {
        if (current) {
          sheets.push(finalizeSheet(current));
        }
        current = {
          name: uniqueSheetName(sheetName, usedNames),
          rows: sheets.length === 0 ? prefaceRows.splice(0) : []
        };
        pendingTableRange = undefined;
        continue;
      }
      if (looksLikeSheetMarker(headingText)) {
        throw dialectSyntaxError(child, "Invalid Sheet: marker. Expected: ## Sheet: <name>");
      }
    }
    if (child.type === "heading" && child.depth === 3) {
      const tableRange = parseTableMarker(headingText);
      if (tableRange) {
        pendingTableRange = tableRange;
        continue;
      }
      if (looksLikeTableMarker(headingText)) {
        throw dialectSyntaxError(child, "Invalid Table: marker. Expected: ### Table: N (A1-C4)");
      }
    }

    const targetRows = current?.rows ?? prefaceRows;
    const rows = blockToRows(child, options);
    if (child.type === "table" && pendingTableRange) {
      placeTableRows(targetRows, rows, pendingTableRange, options);
      pendingTableRange = undefined;
      continue;
    }
    pendingTableRange = undefined;
    appendFlowRows(targetRows, child, rows);
  }

  if (pendingTableRange) {
    throw new Error("Invalid miku-xlsx2md dialect: a Table: marker at end of input has no Markdown table.");
  }

  if (current) {
    sheets.push(finalizeSheet(current));
  } else {
    sheets.push(finalizeSheet({
      name: sanitizeSheetName(options.title ?? "Sheet1"),
      rows: prefaceRows
    }));
  }
  return sheets;
}

function placeTableRows(target: RowModel[], rows: RowModel[], range: Xlsx2mdTableRange, options: DialectOptions): void {
  const declaredHeight = range.endRow - range.startRow + 1;
  const declaredWidth = range.endCol - range.startCol + 1;
  const rowCount = Math.max(rows.length, declaredHeight);
  const displacedRows = displaceFlowRowsFromTableBand(target, range.startRow, rowCount);
  overlayTableRows(target, rows, range, rowCount, declaredWidth, options);
  appendDisplacedFlowRows(target, displacedRows);
}

function displaceFlowRowsFromTableBand(target: RowModel[], startRow: number, rowCount: number): RowModel[] {
  const displacedRows: RowModel[] = [];
  for (let offset = 0; offset < rowCount; offset += 1) {
    const rowIndex = startRow + offset;
    const existing = target[rowIndex];
    if (existing && existing.kind !== "blank" && existing.kind !== "table") {
      displacedRows.push(existing);
      target[rowIndex] = blankRow();
    }
  }
  return displacedRows;
}

function overlayTableRows(
  target: RowModel[],
  rows: RowModel[],
  range: Xlsx2mdTableRange,
  rowCount: number,
  declaredWidth: number,
  options: DialectOptions
): void {
  for (let offset = 0; offset < rowCount; offset += 1) {
    const rowIndex = range.startRow + offset;
    while (target.length <= rowIndex) {
      target.push(blankRow());
    }
    const existing = target[rowIndex];
    const cells = [...existing.cells];
    while (cells.length < range.startCol) {
      cells.push(emptyCell());
    }
    const sourceCells = rows[offset]?.cells ?? [];
    const columnCount = Math.max(sourceCells.length, declaredWidth);
    for (let columnOffset = 0; columnOffset < columnCount; columnOffset += 1) {
      cells[range.startCol + columnOffset] = sourceCells[columnOffset] ?? {
        value: "",
        styleRole: styleRoleForTableCell(offset, options.headerRow, options.tableStyle)
      };
    }
    target[rowIndex] = { ...existing, kind: "table", cells };
  }
}

function appendDisplacedFlowRows(target: RowModel[], displacedRows: RowModel[]): void {
  target.push(...displacedRows);
}

function appendFlowRows(target: RowModel[], child: any, rows: RowModel[]): void {
  if (child.type === "heading" && rows.length > 0 && target.length > 0) {
    const previous = target[target.length - 1];
    if (previous.kind !== "blank" && previous.kind !== "heading" && previous.kind !== "title") {
      target.push(blankRow());
    }
  }
  target.push(...rows);
}

function emptyCell(): CellModel {
  return { value: "", styleRole: "normal" };
}

function dialectSyntaxError(child: any, message: string): Error {
  const line = child.position?.start?.line;
  const location = Number.isInteger(line) ? ` at Markdown line ${line}` : "";
  return new Error(`Invalid miku-xlsx2md dialect${location}: ${message}`);
}
