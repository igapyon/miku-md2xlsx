import type { SheetModel } from "./types.ts";
import { columnName } from "./xlsx-xml.ts";

const LEFT_MERGE_MARKER = "[←M←]";
const UP_MERGE_MARKER = "[↑M↑]";

export interface MergeRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

function cellValue(sheet: SheetModel, rowIndex: number, cellIndex: number): string {
  return sheet.rows[rowIndex]?.cells[cellIndex]?.value ?? "";
}

export function isMergeMarker(value: string): boolean {
  return value === LEFT_MERGE_MARKER || value === UP_MERGE_MARKER;
}

export function cellKey(rowIndex: number, cellIndex: number): string {
  return `${rowIndex}:${cellIndex}`;
}

export function mergeRangeRef(range: MergeRange): string {
  return `${columnName(range.startCol)}${range.startRow + 1}:${columnName(range.endCol)}${range.endRow + 1}`;
}

export function mergeRanges(sheet: SheetModel): MergeRange[] {
  const ranges: MergeRange[] = [];
  for (const [rowIndex, row] of sheet.rows.entries()) {
    for (const [cellIndex, cell] of row.cells.entries()) {
      if (isMergeMarker(cell.value)) {
        continue;
      }

      let endCol = cellIndex;
      while (cellValue(sheet, rowIndex, endCol + 1) === LEFT_MERGE_MARKER) {
        endCol += 1;
      }

      let endRow = rowIndex;
      while (endRow + 1 < sheet.rows.length) {
        const nextRowContinues = Array.from({ length: endCol - cellIndex + 1 }, (_, offset) => (
          cellValue(sheet, endRow + 1, cellIndex + offset) === UP_MERGE_MARKER
        )).every(Boolean);
        if (!nextRowContinues) {
          break;
        }
        endRow += 1;
      }

      if (endCol > cellIndex || endRow > rowIndex) {
        ranges.push({ startRow: rowIndex, startCol: cellIndex, endRow, endCol });
      }
    }
  }
  return ranges;
}

export function coveredMergeCells(ranges: MergeRange[]): Set<string> {
  const covered = new Set<string>();
  for (const range of ranges) {
    for (let row = range.startRow; row <= range.endRow; row += 1) {
      for (let col = range.startCol; col <= range.endCol; col += 1) {
        if (row !== range.startRow || col !== range.startCol) {
          covered.add(cellKey(row, col));
        }
      }
    }
  }
  return covered;
}
