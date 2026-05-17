import type { RowModel } from "./types.ts";

const MIN_COLUMN_WIDTH = 10;
const MAX_COLUMN_WIDTH = 48;
const TEXT_BLOCK_MIN_WIDTH = 28;
const CODE_BLOCK_MIN_WIDTH = 32;

function minimumWidthForRow(row: RowModel): number {
  switch (row.kind) {
    case "paragraph":
    case "list":
    case "heading":
    case "title":
      return TEXT_BLOCK_MIN_WIDTH;
    case "code":
      return CODE_BLOCK_MIN_WIDTH;
    default:
      return MIN_COLUMN_WIDTH;
  }
}

export function computeColumnHints(rows: RowModel[]): number[] {
  const hints: number[] = [];
  for (const row of rows) {
    const rowMinimum = minimumWidthForRow(row);
    row.cells.forEach((cell, index) => {
      const minimum = index === 0 ? rowMinimum : MIN_COLUMN_WIDTH;
      const width = Math.min(Math.max([...cell.value].length + 2, minimum), MAX_COLUMN_WIDTH);
      hints[index] = Math.max(hints[index] ?? 0, width);
    });
  }
  return hints.length ? hints : [16];
}
