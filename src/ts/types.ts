export type SheetMode = "single" | "heading";
export type TableStyleMode = "plain" | "bordered";
export type CellStyleRole = "normal" | "title" | "heading" | "tableHeader" | "tableCell" | "code" | "separator";
export type RowKind = "title" | "heading" | "paragraph" | "list" | "table" | "code" | "separator" | "blank";

export interface Md2XlsxOptions {
  sheetMode?: SheetMode;
  title?: string;
  tableStyle?: TableStyleMode;
  headerRow?: boolean;
}

export interface WorkbookModel {
  sheets: SheetModel[];
}

export interface SheetModel {
  name: string;
  rows: RowModel[];
  columnHints?: number[];
}

export interface RowModel {
  kind: RowKind;
  cells: CellModel[];
}

export interface CellModel {
  value: string;
  styleRole?: CellStyleRole;
}
