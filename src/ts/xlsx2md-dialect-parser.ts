export interface Xlsx2mdTableRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const EXCEL_MAX_ROW = 1_048_576;
const EXCEL_MAX_COLUMN = 16_384;

export function isBookMarker(value: string): boolean {
  return /^Book:\s*/i.test(value);
}

export function looksLikeSheetMarker(value: string): boolean {
  return /^Sheet\s*:/i.test(value);
}

export function parseSheetMarker(value: string): string | undefined {
  const match = value.match(/^Sheet:\s*(.+?)\s*$/i);
  return match?.[1];
}

export function looksLikeTableMarker(value: string): boolean {
  return /^Table\s*:/i.test(value);
}

export function parseTableMarker(value: string): Xlsx2mdTableRange | undefined {
  const match = value.match(/^Table:\s*\d+\s*\(([A-Z]+)(\d+)-([A-Z]+)(\d+)\)\s*$/i);
  if (!match) {
    return undefined;
  }
  const startRow = Number(match[2]) - 1;
  const startCol = columnIndex(match[1]);
  const endRow = Number(match[4]) - 1;
  const endCol = columnIndex(match[3]);
  if (
    startRow < 0 || startRow >= EXCEL_MAX_ROW ||
    startCol < 0 || startCol >= EXCEL_MAX_COLUMN ||
    endRow < startRow || endRow >= EXCEL_MAX_ROW ||
    endCol < startCol || endCol >= EXCEL_MAX_COLUMN
  ) {
    return undefined;
  }
  return { startRow, startCol, endRow, endCol };
}

function columnIndex(value: string): number {
  let result = 0;
  for (const character of value.toUpperCase()) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result - 1;
}
